// Pure logic for the AI stylist: budget parsing, product matching, bundle building.
// No network, no database, no Gemini in this file, so it can be unit-tested.

import type { Audience, SlotRule } from "./rules.ts";
import { AUDIENCE_FILTER, TOO_HIGH_FACTOR, UPGRADE_SLACK } from "./rules.ts";

// ---------- Types ----------
export interface Variant { size: string; color: string; stock: number }
export interface DbProduct {
  id: string;
  shop_id: string;
  name: string;
  category: string;
  custom_category: string | null;
  gender: string;
  age_group: string;
  colors: string[];
  occasion_tags: string[];
  image_urls: string[];
  price: number;
  discount_price: number | null;
  variants: Variant[];
  status: string;
}
export interface ShopInfo { name: string; owner_id: string }

export interface BundleItem {
  slot: string;
  label: string;
  product_id: string;
  name: string;
  price: number;                 // price actually charged (discount applied)
  original_price: number | null; // set only when discounted
  shop_id: string;
  shop_name: string;
  seller_flagged: boolean;       // seller currently has an active fraud badge
  image_url: string | null;
  sizes: string[];               // sizes in stock
  colors: string[];
}

export type BundleStatus = "ok" | "partial" | "too_low" | "too_high" | "no_match";

export interface BundleResult {
  status: BundleStatus;
  items: BundleItem[];
  total: number;
  unavailable: string[];   // slots with no matching product in the catalog
  dropped: string[];       // slots left out because of the budget
  minRequired: number;     // cheapest total of the required slots
  minFull: number;         // cheapest total including optional slots
  maxPossible: number;     // most expensive possible look
}

interface Candidate { p: DbProduct; price: number; flagged: boolean; shopName: string }

// ---------- Budget parsing ----------
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function toAsciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/**
 * Turns "5k", "5,000", "5000 taka", "৳5000", "৫০০০", "5 hazar", "1.5 lakh" into a number of BDT.
 * minPlain: smallest bare number accepted (use 100 on full chat messages so ages like "25" are ignored).
 */
export function parseBudget(text: string | null | undefined, minPlain = 1): number | null {
  if (!text) return null;
  let s = toAsciiDigits(text).toLowerCase();
  s = s.replace(/(\d),(?=\d)/g, "$1");                                  // 5,000 and 1,00,000
  s = s.replace(/(?:৳|\btk\.?|\bbdt)\s*(\d[\d.]*)/g, "$1 taka");        // ৳5000, tk 5000
  s = s.replace(/টাকা/g, " taka").replace(/হাজার/g, " hazar").replace(/লাখ|লক্ষ/g, " lakh");

  const re = /(\d+(?:\.\d+)?)\s*(k|hazar|hajar|thousand|lakhs?|lacs?|taka|tk|bdt)?\b/g;
  const explicit: number[] = [];
  const plain: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(m[1]);
    const unit = m[2];
    if (!unit) { plain.push(n); continue; }
    const mult = /^(k|hazar|hajar|thousand)$/.test(unit) ? 1000 : /^(lakh|lac)/.test(unit) ? 100000 : 1;
    explicit.push(Math.round(n * mult));
  }
  if (explicit.length) return explicit[0];
  const ok = plain.filter((n) => n >= minPlain);
  return ok.length ? Math.round(ok[0]) : null;
}

// ---------- Product helpers ----------
export const productPrice = (p: DbProduct): number => p.discount_price ?? p.price;
export const sizesInStock = (p: DbProduct): string[] =>
  [...new Set((p.variants ?? []).filter((v) => v.stock > 0).map((v) => v.size))];
export const isInStock = (p: DbProduct): boolean => (p.variants ?? []).some((v) => v.stock > 0);

export function matchesAudience(p: DbProduct, audience: Audience): boolean {
  const f = AUDIENCE_FILTER[audience];
  return f.genders.includes(p.gender) && p.age_group === f.age;
}

export function matchesSlot(p: DbProduct, slot: SlotRule): boolean {
  if (p.category !== slot.category) return false;
  if (slot.custom && !(p.custom_category && slot.custom.includes(p.custom_category))) return false;
  if (slot.tags && !p.occasion_tags.some((t) => slot.tags!.includes(t))) return false;
  return true;
}

const colorMatches = (p: DbProduct, prefs: string[]): boolean =>
  prefs.length > 0 && p.colors.some((c) => prefs.some((x) => c.includes(x) || x.includes(c)));

// Clean sellers first: a seller with an active fraud badge is used only if nobody else sells that item.
const pool = (cands: Candidate[]): Candidate[] => {
  const clean = cands.filter((c) => !c.flagged);
  return clean.length ? clean : cands;
};

function pickHighest(cands: Candidate[], cap: number, colors: string[]): Candidate | null {
  const within = cands.filter((c) => c.price <= cap);
  if (!within.length) return null;
  const preferred = within.filter((c) => colorMatches(c.p, colors));
  const list = preferred.length ? preferred : within;
  return list[list.length - 1]; // cands are sorted ascending, so last = most expensive
}

// ---------- Bundle builder ----------
export interface BuildContext {
  audience: Audience;             // who the look is for: only products for this audience are used
  budget: number;
  colors: string[];
  shops: Map<string, ShopInfo>;
  flaggedOwnerIds: Set<string>;   // seller user ids with an active fraud badge
  excludeIds?: Set<string>;       // used to build alternatives
}

export function buildBundle(slots: SlotRule[], products: DbProduct[], ctx: BuildContext): BundleResult {
  const exclude = ctx.excludeIds ?? new Set<string>();
  const empty: BundleResult = {
    status: "no_match", items: [], total: 0, unavailable: [], dropped: [],
    minRequired: 0, minFull: 0, maxPossible: 0,
  };

  // 1. Candidates per slot (in stock, active, matching, sorted cheapest first)
  const slotCands = new Map<string, Candidate[]>();
  const active: SlotRule[] = [];
  const unavailable: string[] = [];
  for (const slot of slots) {
    const cands: Candidate[] = products
      .filter((p) => p.status === "active" && isInStock(p) && !exclude.has(p.id) && matchesAudience(p, ctx.audience) && matchesSlot(p, slot))
      .map((p) => {
        const shop = ctx.shops.get(p.shop_id);
        return {
          p, price: productPrice(p), shopName: shop?.name ?? "Unknown shop",
          flagged: shop ? ctx.flaggedOwnerIds.has(shop.owner_id) : false,
        };
      })
      .sort((a, b) => a.price - b.price);
    if (cands.length === 0) { unavailable.push(slot.label); continue; }
    slotCands.set(slot.slot, cands);
    active.push(slot);
  }
  if (active.length === 0) return { ...empty, unavailable };

  // If every remaining slot is optional, treat the first one as required.
  let required = active.filter((s) => !s.optional);
  if (required.length === 0) required = [active[0]];
  const optional = active.filter((s) => !required.includes(s));

  const cheapest = (s: SlotRule): Candidate => pool(slotCands.get(s.slot)!)[0];
  const dearest = (s: SlotRule): Candidate => { const p = pool(slotCands.get(s.slot)!); return p[p.length - 1]; };
  const minRequired = required.reduce((t, s) => t + cheapest(s).price, 0);
  const minFull = active.reduce((t, s) => t + cheapest(s).price, 0);
  const maxPossible = active.reduce((t, s) => t + dearest(s).price, 0);
  const base = { unavailable, minRequired, minFull, maxPossible };

  // 2. Start from the cheapest option in every required slot, dropping low-priority slots if needed.
  const chosen = new Map<string, Candidate>();
  const keptSlots: SlotRule[] = [];
  const dropped: string[] = [];
  let total = 0;
  for (const s of required) { const c = cheapest(s); chosen.set(s.slot, c); keptSlots.push(s); total += c.price; }
  let partial = false;
  while (total > ctx.budget && keptSlots.length > 1) {
    const s = keptSlots.pop()!;
    total -= chosen.get(s.slot)!.price;
    chosen.delete(s.slot);
    dropped.push(s.label);
    partial = true;
  }
  if (total > ctx.budget) {
    // Not even the first (most important) slot fits
    return { ...empty, ...base, status: "too_low", dropped: [...dropped, ...required.slice(0, 1).map((s) => s.label)] };
  }

  // 3. Add optional slots, in priority order, while the cheapest option still fits.
  for (const s of optional) {
    const c = cheapest(s);
    if (!partial && total + c.price <= ctx.budget) {
      chosen.set(s.slot, c); keptSlots.push(s); total += c.price;
    } else dropped.push(s.label);
  }

  // 4. Upgrade pass: spend within each slot's share of the budget (never pad to reach the budget).
  const byShare = [...keptSlots].sort((a, b) => b.share - a.share);
  for (const s of byShare) {
    const current = chosen.get(s.slot)!;
    const remaining = ctx.budget - (total - current.price);
    const cap = Math.min(ctx.budget * s.share * UPGRADE_SLACK, remaining);
    const better = pickHighest(pool(slotCands.get(s.slot)!), cap, ctx.colors);
    if (better && better.p.id !== current.p.id && better.price >= current.price) {
      total += better.price - current.price;
      chosen.set(s.slot, better);
    }
  }

  // 5. Output
  const items: BundleItem[] = keptSlots.map((s) => {
    const c = chosen.get(s.slot)!;
    return {
      slot: s.slot, label: s.label, product_id: c.p.id, name: c.p.name, price: c.price,
      original_price: c.p.discount_price !== null && c.p.discount_price < c.p.price ? c.p.price : null,
      shop_id: c.p.shop_id, shop_name: c.shopName, seller_flagged: c.flagged,
      image_url: c.p.image_urls?.[0] ?? null, sizes: sizesInStock(c.p), colors: c.p.colors,
    };
  });
  const status: BundleStatus = partial ? "partial" : ctx.budget > maxPossible * TOO_HIGH_FACTOR ? "too_high" : "ok";
  return { ...base, status, items, total, dropped };
}

// ---------- Guard for AI-written text ----------
/** All numbers (100 and above) that appear in a piece of text, with Bangla digits and commas handled. */
export function numbersInText(text: string): number[] {
  const s = toAsciiDigits(text).replace(/(\d),(?=\d)/g, "$1");
  return (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n >= 100);
}

/** True when every number of 100+ in the reply is one we gave the model (prices, totals, budget...). */
export function replyUsesOnlyKnownNumbers(reply: string, allowed: Set<number>): boolean {
  return numbersInText(reply).every((n) => allowed.has(n));
}
