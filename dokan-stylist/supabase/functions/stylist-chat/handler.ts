// The stylist-chat request flow. Database and Gemini are passed in, so this file is testable offline.
//
// Flow:  message -> Gemini extracts fields -> merge with chat memory -> ask for anything missing
//        -> guardrails + product search + bundle maths (plain code) -> Gemini writes the reply from facts -> save.

import type { Audience, Occasion } from "./rules.ts";
import { AUDIENCES, AUDIENCE_FILTER, OCCASIONS, RULES } from "./rules.ts";
import { buildBundle, parseBudget, repairBundle } from "./logic.ts";
import type { BundleItem, BundleRef, BundleResult, DbProduct, ShopInfo } from "./logic.ts";
import type { Ai, Facts, Language } from "./gemini.ts";
import { fallbackReply } from "./gemini.ts";

export interface Msg { role: "user" | "assistant"; text: string; created_at: string; meta?: Record<string, unknown> }
export interface State { occasion: Occasion | null; audience: Audience | null; budget: number | null; colors: string[] }
export type ShopRow = ShopInfo & { verified: boolean };

export interface Db {
  getConversation(id: string): Promise<{ id: string; messages: Msg[] } | null>;
  saveConversation(row: { id?: string; user_id: string | null; messages: Msg[]; budget: number | null; bundle: unknown }): Promise<string>;
  getProfile(userId: string): Promise<{ gender: string | null; age_group: string | null } | null>;
  getProducts(audience: Audience): Promise<DbProduct[]>;
  getShops(ids: string[]): Promise<Map<string, ShopRow>>;
  getFlaggedOwnerIds(ownerIds: string[]): Promise<Set<string>>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toAudience(gender: string | null, age: string | null): Audience | null {
  if ((gender === "female" || gender === "male") && (age === "adult" || age === "child" || age === "elderly")) {
    return `${gender}_${age}` as Audience;
  }
  return null;
}

const itemFacts = (items: BundleItem[]) =>
  items.map((i) => ({ label: i.label, name: i.name, price: i.price, original_price: i.original_price, shop: i.shop_name, seller_flagged: i.seller_flagged }));

// Re-checks a bundle that is already on the shopper's screen against live stock (used when a look is shown,
// when another look is picked, and right before "Add to cart"). Plain code only: no Gemini, nothing invented.
async function recheck(db: Db, body: { items?: unknown; audience?: unknown; occasion?: unknown; budget?: unknown }): Promise<Response> {
  const audience = AUDIENCES.find((a) => a === body.audience);
  const occasion = OCCASIONS.find((o) => o === body.occasion);
  const budget = typeof body.budget === "number" && Number.isFinite(body.budget) && body.budget > 0 ? Math.round(body.budget) : null;
  if (!audience || !occasion || budget === null) return fail(400, "bad_recheck", "Send audience, occasion and a positive budget.");
  const rules = RULES[audience][occasion];
  if (!rules) return fail(400, "bad_recheck", "No looks for this occasion.");
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 12) return fail(400, "bad_recheck", "Send 1 to 12 items.");
  const current: BundleRef[] = [];
  for (const raw of body.items as Record<string, unknown>[]) {
    if (!raw || typeof raw.product_id !== "string" || !/^[\w-]{1,64}$/.test(raw.product_id) || typeof raw.slot !== "string") {
      return fail(400, "bad_recheck", "Each item needs product_id and slot.");
    }
    current.push({
      product_id: raw.product_id, slot: raw.slot,
      name: typeof raw.name === "string" ? raw.name.slice(0, 80) : "This item",
      price: typeof raw.price === "number" && Number.isFinite(raw.price) ? raw.price : undefined,
    });
  }

  try {
    const all = await db.getProducts(audience);
    const shops = await db.getShops([...new Set(all.map((p) => p.shop_id))]);
    const verified = new Map([...shops].filter(([, s]) => s.verified));
    const live = all.filter((p) => verified.has(p.shop_id));
    const flagged = await db.getFlaggedOwnerIds([...new Set([...verified.values()].map((s) => s.owner_id))]);
    const ctx = { audience, budget, colors: [] as string[], shops: verified, flaggedOwnerIds: flagged };

    let fix = repairBundle(rules, current, live, ctx);
    let items = fix.items, total = fix.total, rebuilt = false;
    let leftOut: string[] = [], missing: string[] = fix.unfilled;
    if (fix.status === "over_budget") {
      // Prices rose: never go over the budget silently. Build a fresh look from live data instead.
      const fresh = buildBundle(rules, live, ctx);
      items = fresh.items; total = fresh.total; rebuilt = true; leftOut = fresh.dropped; missing = fresh.unavailable;
    }
    const changed = fix.status !== "unchanged" || fix.price_changes.length > 0;
    const facts: Facts = {
      status: rebuilt ? (items.length ? "partial" : "no_match") : fix.status === "unchanged" ? "ok" : fix.status === "empty" ? "no_match" : "partial",
      language: "en", occasion, audience, budget,
      items: itemFacts(items), total, remaining: budget - total, left_out: leftOut, missing,
      recheck: {
        gone: fix.gone.map((g) => ({ label: g.label, name: g.name, reason: g.reason })),
        replaced: fix.replacements.map((r) => ({ label: r.label, old_name: r.old_name, name: r.item.name, price: r.item.price, shop: r.item.shop_name })),
        unfilled: fix.unfilled, price_changes: fix.price_changes, rebuilt,
      },
    };
    return json(200, {
      data: {
        status: fix.status === "over_budget" ? "rebuilt" : fix.status, changed, reply: changed ? fallbackReply(facts) : "",
        gone: fix.gone, replacements: fix.replacements, unfilled: fix.unfilled, price_changes: fix.price_changes,
        bundle: items.length ? { items, total, budget, remaining: budget - total, left_out: leftOut, missing, alternatives: [] } : null,
      },
    });
  } catch (e) {
    console.error("stylist recheck error:", e);
    return fail(500, "internal", "Could not re-check stock. Please try again.");
  }
}

export function createHandler(db: Db, ai: Ai) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

    let body: { message?: unknown; conversation_id?: unknown; user_id?: unknown; action?: unknown; items?: unknown; audience?: unknown; occasion?: unknown; budget?: unknown };
    try { body = await req.json(); } catch { return fail(400, "bad_json", "Body must be JSON."); }
    if (body.action === "recheck") return recheck(db, body);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return fail(400, "empty_message", "Send a non-empty 'message'.");
    if (message.length > 500) return fail(400, "message_too_long", "Keep messages under 500 characters.");
    const userId = typeof body.user_id === "string" && UUID.test(body.user_id) ? body.user_id : null;
    const convId = typeof body.conversation_id === "string" && UUID.test(body.conversation_id) ? body.conversation_id : null;

    try {
      // ---- memory ----
      const conv = convId ? await db.getConversation(convId) : null;
      const history: Msg[] = conv?.messages ?? [];
      const lastState = ([...history].reverse().find((m) => m.role === "assistant")?.meta?.state ?? {}) as Partial<State>;
      const known: State = {
        occasion: lastState.occasion ?? null, audience: lastState.audience ?? null,
        budget: lastState.budget ?? null, colors: lastState.colors ?? [],
      };

      // ---- stage A: Gemini reads the message ----
      let ex;
      try {
        ex = await ai.extract({ message, recent: history.slice(-6).map((m) => ({ role: m.role, text: m.text })), known });
      } catch (e) {
        console.error("extract failed:", e);
        const detail = (e instanceof Error ? e.message : String(e)).slice(0, 600);
        return json(503, { error: { code: "ai_unavailable", message: "The stylist is busy right now. Please try again in a moment.", detail } });
      }

      // ---- merge with what we already knew ----
      const profile = userId ? await db.getProfile(userId) : null;
      const profileAudience = profile ? toAudience(profile.gender, profile.age_group) : null;
      const occasion = ex.occasion ?? known.occasion;
      const audience = ex.audience ?? known.audience ?? (ex.for_self ? profileAudience : null);
      const budgetFromText = parseBudget(ex.budget_text);
      const budget = budgetFromText ?? parseBudget(message, 100) ?? known.budget;
      const colors = ex.colors.length ? ex.colors : known.colors;
      const language: Language = ex.language;
      const state: State = { occasion, audience, budget, colors };

      // ---- decide what to do ----
      let facts: Facts = { status: "need_info", language, occasion, audience, budget };
      let result: BundleResult | null = null;
      const alternatives: { items: BundleItem[]; total: number; remaining: number }[] = [];

      if (ex.intent === "off_topic") {
        facts = { status: "off_topic", language };
      } else if (!occasion) {
        facts.ask = "occasion";
      } else if (!audience) {
        facts.ask = "audience";
      } else if ((ex.budget_text && budgetFromText === null) || (budget !== null && budget <= 0)) {
        facts.ask = "budget_number";
      } else if (budget === null) {
        facts.ask = "budget";
      } else {
        const rules = RULES[audience][occasion];
        if (!rules) {
          facts = { status: "unsupported", language, occasion, audience, supported_occasions: Object.keys(RULES[audience]) };
        } else {
          // ---- stage B + C: catalog search and bundle maths in plain code ----
          const all = await db.getProducts(audience);
          const shops = await db.getShops([...new Set(all.map((p) => p.shop_id))]);
          const verified = new Map([...shops].filter(([, s]) => s.verified));
          const products = all.filter((p) => verified.has(p.shop_id));
          const flagged = await db.getFlaggedOwnerIds([...new Set([...verified.values()].map((s) => s.owner_id))]);
          const base = { audience, budget, colors, shops: verified, flaggedOwnerIds: flagged };

          result = buildBundle(rules, products, base);

          if (result.status === "ok") {
            // up to 2 alternatives, each with a different main item
            const used = new Set(result.items.filter((i) => i.slot === rules[0].slot).map((i) => i.product_id));
            for (let n = 0; n < 2; n++) {
              const alt = buildBundle(rules, products, { ...base, excludeIds: used });
              if (alt.status !== "ok" || alt.items.length === 0) break;
              alternatives.push({ items: alt.items, total: alt.total, remaining: budget - alt.total });
              alt.items.filter((i) => i.slot === rules[0].slot).forEach((i) => used.add(i.product_id));
            }
          }

          facts = {
            status: result.status, language, occasion, audience, budget,
            items: itemFacts(result.items), total: result.total, remaining: budget - result.total,
            left_out: result.dropped, missing: result.unavailable,
            min_required_total: result.minRequired, min_full_total: result.minFull,
            affordable: result.affordable.map((i) => ({ label: i.label, name: i.name, price: i.price, shop: i.shop_name })),
          };
        }
      }

      // ---- stage D: Gemini writes the reply from the facts ----
      const reply = await ai.reply(facts);

      // ---- save ----
      const now = new Date().toISOString();
      const messages: Msg[] = [
        ...history,
        { role: "user", text: message, created_at: now },
        { role: "assistant", text: reply.text, created_at: now, meta: { state, status: facts.status } },
      ];
      const id = await db.saveConversation({
        id: conv?.id, user_id: userId, messages, budget,
        bundle: result && result.items.length ? { items: result.items.map((i) => i.product_id), total: result.total } : null,
      });

      const bundle = result && result.items.length
        ? {
          items: result.items, total: result.total, budget: budget!, remaining: budget! - result.total,
          left_out: result.dropped, missing: result.unavailable, alternatives,
        }
        : null;
      return json(200, {
        data: {
          conversation_id: id, status: facts.status, reply: reply.text, reply_source: reply.source,
          state, ask: facts.ask ?? null, bundle,
          min_required_total: result ? result.minRequired : null,
          missing: result ? result.unavailable : [],
          affordable: result ? result.affordable : [],
        },
      });
    } catch (e) {
      console.error("stylist-chat error:", e);
      return fail(500, "internal", "Something went wrong. Please try again.");
    }
  };
}