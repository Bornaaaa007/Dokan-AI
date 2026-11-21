// Run:  node --experimental-strip-types logic_test.ts      (Node 22+)
//   or: deno test logic_test.ts                            (if you have Deno)
import assert from "node:assert/strict";
import catalog from "./testdata/catalog.json" with { type: "json" };
import { buildBundle, isInStock, numbersInText, parseBudget, replyUsesOnlyKnownNumbers } from "./logic.ts";
import type { DbProduct, ShopInfo } from "./logic.ts";
import { AUDIENCES, OCCASIONS, RULES } from "./rules.ts";
import type { Audience } from "./rules.ts";

const products = catalog.products as unknown as DbProduct[];
const shops = new Map<string, ShopInfo>(Object.entries(catalog.shops as Record<string, ShopInfo>));
const byId = new Map(products.map((p) => [p.id, p]));
const ctx = (audience: Audience, budget: number, extra = {}) =>
  ({ audience, budget, colors: [] as string[], shops, flaggedOwnerIds: new Set<string>(), ...extra });

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log("  ok  " + name); };

// ---------- budget parsing ----------
test("parseBudget understands common formats", () => {
  const cases: [string, number | null][] = [
    ["5k", 5000], ["5K", 5000], ["5000", 5000], ["5,000", 5000], ["5000 taka", 5000], ["tk 5000", 5000],
    ["৳5000", 5000], ["৫০০০", 5000], ["৫ হাজার", 5000], ["5 hazar", 5000], ["2.5k", 2500],
    ["1 lakh", 100000], ["1.5 lakh", 150000], ["১ লাখ", 100000], ["1,00,000", 100000], ["100 taka", 100],
    ["not too expensive", null], ["", null],
  ];
  for (const [text, want] of cases) assert.equal(parseBudget(text), want, `"${text}"`);
});
test("parseBudget ignores ages in a full message", () => {
  assert.equal(parseBudget("I am 25 and need a wedding outfit under 5000", 100), 5000);
  assert.equal(parseBudget("I am 25 and my budget is 5k", 100), 5000);
  assert.equal(parseBudget("I am 25 and need a wedding outfit", 100), null);
});

// ---------- scenarios from the requirements doc ----------
test("young woman, wedding, 5000 BDT: sari + shoes + jewelry within budget", () => {
  const r = buildBundle(RULES.female_adult.wedding!, products, ctx("female_adult", 5000));
  assert.equal(r.status, "ok");
  assert.ok(r.total <= 5000, `total ${r.total}`);
  const slots = r.items.map((i) => i.slot);
  for (const s of ["outfit", "shoes", "jewelry"]) assert.ok(slots.includes(s), "missing " + s);
});
test("male interview, 5000 BDT: shirt, trousers, shoes, watch", () => {
  const r = buildBundle(RULES.male_adult.interview!, products, ctx("male_adult", 5000));
  assert.equal(r.status, "ok");
  assert.ok(r.total <= 5000);
  const slots = r.items.map((i) => i.slot);
  for (const s of ["shirt", "trousers", "shoes", "watch"]) assert.ok(slots.includes(s), "missing " + s);
});
test("100 BDT is impossible", () => {
  for (const [aud, occ] of [["female_adult", "wedding"], ["male_adult", "interview"]] as const) {
    const r = buildBundle(RULES[aud][occ]!, products, ctx(aud, 100));
    assert.equal(r.status, "too_low");
    assert.equal(r.items.length, 0);
    assert.ok(r.minRequired > 100);
  }
});
test("2000 BDT wedding: partial look, says what is left out", () => {
  const r = buildBundle(RULES.female_adult.wedding!, products, ctx("female_adult", 2000));
  assert.equal(r.status, "partial");
  assert.ok(r.total <= 2000);
  assert.ok(r.dropped.length > 0);
});
test("1 lakh BDT is too high: best available look, money left over", () => {
  const r = buildBundle(RULES.female_adult.wedding!, products, ctx("female_adult", 100000));
  assert.equal(r.status, "too_high");
  assert.ok(r.items.length > 0 && r.total < 100000 / 2);
});
test("budget with a little slack never pads up to the budget", () => {
  const r = buildBundle(RULES.female_adult.casual!, products, ctx("female_adult", 20000));
  assert.ok(r.total < 20000);
});

// ---------- safety rules ----------
test("out-of-stock and hidden products are never recommended", () => {
  const banned = new Set(products.filter((p) => !isInStock(p) || p.status !== "active").map((p) => p.id));
  assert.ok(banned.size >= 2);
  for (const aud of AUDIENCES) for (const occ of OCCASIONS) {
    const slots = RULES[aud][occ]; if (!slots) continue;
    for (let b = 300; b <= 120000; b += 700) {
      for (const it of buildBundle(slots, products, ctx(aud, b)).items) assert.ok(!banned.has(it.product_id), it.name);
    }
  }
});
test("total never exceeds budget, items always match audience (sweep)", () => {
  let runs = 0;
  for (const aud of AUDIENCES) for (const occ of OCCASIONS) {
    const slots = RULES[aud][occ]; if (!slots) continue;
    for (let b = 100; b <= 150000; b += 350) {
      const r = buildBundle(slots, products, ctx(aud, b)); runs++;
      assert.ok(r.total <= b, `${aud}/${occ}/${b}: total ${r.total}`);
      if (r.status === "too_low" || r.status === "no_match") assert.equal(r.items.length, 0);
      else assert.ok(r.items.length > 0);
      for (const it of r.items) {
        const p = byId.get(it.product_id)!;
        assert.ok(p.age_group === aud.split("_")[1], `${aud}: ${p.name} age ${p.age_group}`);
        assert.ok([aud.split("_")[0], "unisex"].includes(p.gender), `${aud}: ${p.name} gender ${p.gender}`);
      }
    }
  }
  assert.ok(runs > 1000);
});
test("discounted price is what counts", () => {
  const r = buildBundle(RULES.female_adult.wedding!, products, ctx("female_adult", 8000, { colors: ["maroon"] }));
  const sari = r.items.find((i) => i.slot === "outfit")!;
  assert.equal(sari.name, "Maroon Katan Silk Sari");
  assert.equal(sari.price, 3800);
  assert.equal(sari.original_price, 4200);
});
test("preferred colour is honoured when the budget allows", () => {
  const r = buildBundle(RULES.female_adult.wedding!, products, ctx("female_adult", 8000, { colors: ["maroon"] }));
  assert.ok(r.items.find((i) => i.slot === "outfit")!.colors.includes("maroon"));
});
test("seller with a fraud badge is avoided when another seller has the item", () => {
  const nilima = [...shops.values()].find((s) => s.name === "Nilima Boutique")!;
  const r = buildBundle(RULES.female_adult.wedding!, products, ctx("female_adult", 8000, { flaggedOwnerIds: new Set([nilima.owner_id]) }));
  assert.ok(r.items.every((i) => i.shop_name !== "Nilima Boutique"));
  assert.ok(r.items.every((i) => !i.seller_flagged));
});
test("flagged seller is still shown, with the flag, when it is the only seller", () => {
  const gentry = [...shops.values()].find((s) => s.name === "Gentry Formals")!;
  const r = buildBundle(RULES.male_adult.interview!, products, ctx("male_adult", 5000, { flaggedOwnerIds: new Set([gentry.owner_id]) }));
  assert.ok(r.items.some((i) => i.seller_flagged));
});
test("alternatives: excluded products are not used again", () => {
  const first = buildBundle(RULES.female_adult.wedding!, products, ctx("female_adult", 5000));
  const ids = new Set(first.items.filter((i) => i.slot === "outfit").map((i) => i.product_id));
  const alt = buildBundle(RULES.female_adult.wedding!, products, ctx("female_adult", 5000, { excludeIds: ids }));
  assert.ok(alt.items.length > 0);
  assert.ok(alt.items.every((i) => !ids.has(i.product_id)));
});
test("missing catalog items are reported, not invented", () => {
  const r = buildBundle(RULES.female_child.casual!, products, ctx("female_child", 5000));
  assert.ok(r.items.length > 0);
  const none = buildBundle(RULES.female_child.casual!, [], ctx("female_child", 5000));
  assert.equal(none.status, "no_match");
  assert.equal(none.items.length, 0);
});

// ---------- guard against invented numbers in the AI reply ----------
test("reply guard", () => {
  assert.deepEqual(numbersInText("Total ৳4,800, shoes 1350 and 5k budget"), [4800, 1350]);
  const allowed = new Set([4800, 1350, 5000]);
  assert.equal(replyUsesOnlyKnownNumbers("Your look costs 4,800 BDT with 200 left", allowed), false);
  assert.equal(replyUsesOnlyKnownNumbers("Your look costs 4,800 BDT, shoes 1350", allowed), true);
});

console.log(`\n${passed} tests passed`);
