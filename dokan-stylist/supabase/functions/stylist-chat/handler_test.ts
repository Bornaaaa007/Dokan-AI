// Run:  node --experimental-strip-types --no-warnings handler_test.ts
// Tests the whole request flow with an in-memory database and a stand-in for Gemini's extraction step.
// (The stand-in is for TESTING ONLY. The deployed function calls the real Gemini API.)
import assert from "node:assert/strict";
import catalog from "./testdata/catalog.json" with { type: "json" };
import { createHandler } from "./handler.ts";
import type { Db, Msg, ShopRow } from "./handler.ts";
import { fallbackReply, sanitizeExtracted } from "./gemini.ts";
import type { Ai, Extracted } from "./gemini.ts";
import { AUDIENCE_FILTER } from "./rules.ts";
import type { DbProduct } from "./logic.ts";

const CUSTOMER = "00000000-0000-4000-8000-000000000009";
const products = catalog.products as unknown as DbProduct[];
const shopEntries = Object.entries(catalog.shops as Record<string, { name: string; owner_id: string }>);

function makeDb(opts: { unverified?: string[]; flaggedOwners?: string[]; profile?: { gender: string; age_group: string }; catalog?: () => DbProduct[] } = {}) {
  const convs = new Map<string, { id: string; messages: Msg[]; budget: number | null; bundle: unknown }>();
  let n = 0;
  const db: Db = {
    async getConversation(id) { const c = convs.get(id); return c ? { id: c.id, messages: c.messages } : null; },
    async saveConversation(row) {
      const id = row.id ?? `00000000-0000-4000-a000-${String(++n).padStart(12, "0")}`;
      convs.set(id, { id, messages: row.messages, budget: row.budget, bundle: row.bundle });
      return id;
    },
    async getProfile() { return opts.profile ?? null; },
    async getProducts(aud) {
      const f = AUDIENCE_FILTER[aud];
      return (opts.catalog ? opts.catalog() : products).filter((p) => p.status === "active" && p.age_group === f.age && f.genders.includes(p.gender));
    },
    async getShops(ids) {
      const m = new Map<string, ShopRow>();
      for (const [id, s] of shopEntries) if (ids.includes(id)) m.set(id, { ...s, verified: !(opts.unverified ?? []).includes(s.name) });
      return m;
    },
    async getFlaggedOwnerIds(ids) { return new Set(ids.filter((i) => (opts.flaggedOwners ?? []).includes(i))); },
  };
  return { db, convs };
}

// Stand-in for Gemini's extraction (regex based). Only used here.
const fakeAi = (failExtract = false): Ai => ({
  async extract({ message }): Promise<Extracted> {
    if (failExtract) throw new Error("boom");
    const m = message.toLowerCase();
    const budget = m.match(/(\d[\d,.]*\s*(?:k|taka|lakh|hazar)?)/)?.[1] ?? null;
    return sanitizeExtracted({
      intent: /pizza|weather/.test(m) ? "off_topic" : /wedding|interview|eid|party|casual|\d/.test(m) || /woman|man\b|son|daughter/.test(m) ? "outfit_request" : "greeting",
      occasion: /wedding/.test(m) ? "wedding" : /interview/.test(m) ? "interview" : /eid/.test(m) ? "eid" : null,
      audience: /young woman|my wife|girl/.test(m) ? "female_adult" : /\bmale\b|\bman\b|\bguy\b/.test(m) ? "male_adult"
        : /my son/.test(m) ? "male_child" : /my daughter/.test(m) ? "female_child" : null,
      for_self: !/my son|my daughter/.test(m),
      budget_text: /not too expensive/.test(m) ? "not too expensive" : budget,
      colors: /maroon/.test(m) ? ["maroon"] : [], language: "en",
    });
  },
  async reply(facts) { return { text: fallbackReply(facts), source: "fallback" }; },
});

const call = async (h: ReturnType<typeof createHandler>, body: unknown, method = "POST") => {
  const res = await h(new Request("http://x/stylist-chat", { method, body: method === "POST" ? JSON.stringify(body) : undefined }));
  return { status: res.status, json: await res.json().catch(() => null) };
};

let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ok  " + name); };

await test("wedding outfit, 5000 BDT, profile fills in 'who' (customer profile = young woman)", async () => {
  const { db, convs } = makeDb({ profile: { gender: "female", age_group: "adult" } });
  const r = await call(createHandler(db, fakeAi()), { message: "I need a wedding outfit, budget 5000 taka", user_id: CUSTOMER });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.status, "ok");
  assert.ok(r.json.data.bundle.total <= 5000);
  assert.equal(r.json.data.bundle.remaining, 5000 - r.json.data.bundle.total);
  assert.ok(r.json.data.bundle.alternatives.length >= 1);
  assert.equal(convs.size, 1);
});

await test("multi-turn memory: hi -> wedding -> young woman -> 5k", async () => {
  const { db, convs } = makeDb();
  const h = createHandler(db, fakeAi());
  const t1 = await call(h, { message: "hi" });
  assert.equal(t1.json.data.ask, "occasion");
  const id = t1.json.data.conversation_id;
  const t2 = await call(h, { message: "wedding", conversation_id: id });
  assert.equal(t2.json.data.ask, "audience");
  const t3 = await call(h, { message: "for a young woman", conversation_id: id });
  assert.equal(t3.json.data.ask, "budget");
  const t4 = await call(h, { message: "5k", conversation_id: id });
  assert.equal(t4.json.data.status, "ok");
  assert.equal(t4.json.data.conversation_id, id);
  assert.equal(convs.get(id)!.messages.length, 8);
});

await test("100 taka: honest 'not enough', no products, realistic minimum given", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi()), { message: "wedding outfit for a young woman, 100 taka" });
  assert.equal(r.json.data.status, "too_low");
  assert.equal(r.json.data.bundle, null);
  assert.ok(r.json.data.min_required_total > 100);
  assert.match(r.json.data.reply, /not enough/);
});

await test("1 lakh: too high, still shows the best look we have", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi()), { message: "wedding outfit for a young woman, 1 lakh" });
  assert.equal(r.json.data.status, "too_high");
  assert.ok(r.json.data.bundle.items.length > 0);
  assert.ok(r.json.data.bundle.remaining > 50000);
});

await test("2000 BDT wedding: partial look explains the minimum", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi()), { message: "wedding outfit for a young woman, 2000 taka" });
  assert.equal(r.json.data.status, "partial");
  assert.ok(r.json.data.bundle.total <= 2000);
  assert.ok(r.json.data.bundle.left_out.length > 0);
});

await test("male interview, 5k", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi()), { message: "interview outfit for a man, 5k" });
  assert.equal(r.json.data.status, "ok");
  assert.ok(r.json.data.bundle.items.length >= 4 && r.json.data.bundle.total <= 5000);
});

await test("occasion we have no looks for (woman + interview)", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi()), { message: "interview outfit for a young woman, 5000" });
  assert.equal(r.json.data.status, "unsupported");
});

await test("vague budget ('not too expensive') asks for a number", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi()), { message: "wedding outfit for a young woman, not too expensive" });
  assert.equal(r.json.data.ask, "budget_number");
});

await test("off-topic is declined politely", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi()), { message: "what is the weather" });
  assert.equal(r.json.data.status, "off_topic");
  assert.equal(r.json.data.bundle, null);
});

await test("products from unverified shops are never recommended", async () => {
  const { db } = makeDb({ unverified: ["Nilima Boutique", "Rongdhonu Collection"] });
  const r = await call(createHandler(db, fakeAi()), { message: "wedding outfit for a young woman, 8000 taka" });
  for (const it of r.json.data.bundle?.items ?? []) assert.ok(!["Nilima Boutique", "Rongdhonu Collection"].includes(it.shop_name));
});

await test("fraud-badged seller is flagged when they are the only option", async () => {
  const gentry = shopEntries.find(([, s]) => s.name === "Gentry Formals")![1];
  const { db } = makeDb({ flaggedOwners: [gentry.owner_id] });
  const r = await call(createHandler(db, fakeAi()), { message: "interview outfit for a man, 5k" });
  assert.ok(r.json.data.bundle.items.some((i: { seller_flagged: boolean }) => i.seller_flagged));
  assert.match(r.json.data.reply, /caution/);
});

// ---------- Challenge 2: honest bundle ----------
const WOMAN = "wedding outfit for a young woman, ";

await test("thin catalog: no shoes in the shop -> partial look, says which piece is missing, true total", async () => {
  const { db } = makeDb({ catalog: () => products.filter((p) => p.category !== "shoes") });
  const r = await call(createHandler(db, fakeAi()), { message: WOMAN + "5000 taka" });
  const d = r.json.data;
  assert.equal(d.status, "partial");
  assert.deepEqual(d.bundle.missing, ["Shoes"]);
  assert.ok(d.bundle.items.length > 0 && d.bundle.items.every((i: { slot: string }) => i.slot !== "shoes"));
  assert.equal(d.bundle.total, d.bundle.items.reduce((t: number, i: { price: number }) => t + i.price, 0));
  assert.match(d.reply, /no shoes in stock for this look/i);
  assert.ok(d.bundle.total <= 5000);
});

await test("budget below the minimum: too_low gives the cheapest complete total and real single items, no bundle", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi()), { message: WOMAN + "800 taka" });
  const d = r.json.data;
  assert.equal(d.status, "too_low");
  assert.equal(d.bundle, null);
  assert.equal(d.min_required_total, 2750);
  assert.ok(d.affordable.length > 0 && d.affordable.every((i: { price: number }) => i.price <= 800));
  assert.match(d.reply, /cheapest complete look in our shop is 2,750 BDT/);
  assert.match(d.reply, /single items/);
});

const lookFor = async (db: Db, budget = "5000 taka") => {
  const r = await call(createHandler(db, fakeAi()), { message: WOMAN + budget });
  return r.json.data;
};
const recheckBody = (d: { bundle: { items: { product_id: string; slot: string; name: string; price: number }[] }; state: { audience: string; occasion: string } }, budget = 5000) => ({
  action: "recheck", audience: d.state.audience, occasion: d.state.occasion, budget,
  items: d.bundle.items.map((i) => ({ product_id: i.product_id, slot: i.slot, name: i.name, price: i.price })),
});

await test("recheck: nothing changed -> unchanged, no message", async () => {
  const { db } = makeDb();
  const d = await lookFor(db);
  const r = await call(createHandler(db, fakeAi()), recheckBody(d));
  assert.equal(r.status, 200);
  assert.equal(r.json.data.status, "unchanged");
  assert.equal(r.json.data.changed, false);
});

await test("recheck: item sold out after the bundle was built -> says so and offers a replacement within budget", async () => {
  let soldOut: string | null = null;
  const { db } = makeDb({ catalog: () => products.map((p) => (p.id === soldOut ? { ...p, variants: p.variants.map((v) => ({ ...v, stock: 0 })) } : p)) });
  const d = await lookFor(db);
  soldOut = d.bundle.items.find((i: { slot: string }) => i.slot === "outfit").product_id;     // sells out while the shopper is looking
  const r = await call(createHandler(db, fakeAi()), recheckBody(d));
  const x = r.json.data;
  assert.equal(x.status, "repaired");
  assert.equal(x.changed, true);
  assert.equal(x.gone[0].product_id, soldOut);
  assert.equal(x.gone[0].reason, "sold_out");
  assert.equal(x.replacements.length, 1);
  assert.notEqual(x.replacements[0].item.product_id, soldOut);
  assert.ok(x.bundle.total <= 5000);
  assert.ok(x.bundle.items.every((i: { product_id: string }) => i.product_id !== soldOut));
  assert.match(x.reply, /sold out/);
  assert.match(x.reply, /replaced/);
});

await test("recheck: the product was deleted and nothing else fits -> reported, bundle shrinks, never faked", async () => {
  let hide: (p: DbProduct) => boolean = () => false;
  const { db } = makeDb({ catalog: () => products.filter((p) => !hide(p)) });
  const d = await lookFor(db);
  hide = (p) => p.category === "clothing" && ["sari", "three-piece"].includes(p.custom_category ?? "");
  const r = await call(createHandler(db, fakeAi()), recheckBody(d));
  const x = r.json.data;
  assert.equal(x.status, "partial");
  assert.deepEqual(x.unfilled, ["Sari / outfit"]);
  assert.ok(x.bundle.items.every((i: { slot: string }) => i.slot !== "outfit"));
  assert.match(x.reply, /No replacement fits your budget/);
});

await test("recheck: a seller raised the price over budget -> look is rebuilt inside the budget, never over", async () => {
  let bump = 0;
  const { db } = makeDb({ catalog: () => products.map((p) => ({ ...p, price: p.price + bump, discount_price: p.discount_price === null ? null : p.discount_price + bump })) });
  const d = await lookFor(db);
  bump = 1500;
  const r = await call(createHandler(db, fakeAi()), recheckBody(d));
  const x = r.json.data;
  assert.equal(x.status, "rebuilt");
  assert.ok(x.price_changes.length > 0);
  assert.ok(x.bundle === null || x.bundle.total <= 5000);
  assert.match(x.reply, /changed from/);
});

await test("recheck: bad input is rejected", async () => {
  const { db } = makeDb();
  const h = createHandler(db, fakeAi());
  assert.equal((await call(h, { action: "recheck" })).status, 400);
  assert.equal((await call(h, { action: "recheck", audience: "female_adult", occasion: "wedding", budget: -5, items: [{ product_id: "p001", slot: "outfit" }] })).status, 400);
  assert.equal((await call(h, { action: "recheck", audience: "female_adult", occasion: "wedding", budget: 5000, items: [{ product_id: "../x", slot: "outfit" }] })).status, 400);
  assert.equal((await call(h, { action: "recheck", audience: "female_adult", occasion: "wedding", budget: 5000, items: [] })).status, 400);
});

await test("bad requests", async () => {
  const { db } = makeDb();
  const h = createHandler(db, fakeAi());
  assert.equal((await call(h, { message: "   " })).status, 400);
  assert.equal((await call(h, { message: "x".repeat(501) })).status, 400);
  assert.equal((await call(h, {}, "GET")).status, 405);
  assert.equal((await call(h, {}, "OPTIONS")).status === 405, false);
});

await test("if Gemini is down the client gets a clear 503, nothing is faked", async () => {
  const { db } = makeDb();
  const r = await call(createHandler(db, fakeAi(true)), { message: "wedding outfit for a young woman, 5000" });
  assert.equal(r.status, 503);
  assert.equal(r.json.error.code, "ai_unavailable");
});

await test("sanitizeExtracted rejects bad model output", () => {
  const e = sanitizeExtracted({ intent: "hack", occasion: "funeral", audience: 7, budget_text: "  5k ", colors: ["Maroon", 3, ""], language: "fr" });
  assert.equal(e.intent, "greeting"); assert.equal(e.occasion, null); assert.equal(e.audience, null);
  assert.equal(e.budget_text, "5k"); assert.deepEqual(e.colors, ["maroon"]); assert.equal(e.language, "en");
  return Promise.resolve();
});

console.log(`\n${passed} tests passed`);
