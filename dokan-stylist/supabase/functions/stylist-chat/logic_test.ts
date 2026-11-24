// Run:  node --experimental-strip-types logic_test.ts      (Node 22+)
//   or: deno test logic_test.ts                            (if you have Deno)
import assert from "node:assert/strict";
import catalog from "./testdata/catalog.json" with { type: "json" };
import { buildBundle, isInStock, numbersInText, parseBudget, repairBundle, replyUsesOnlyKnownNumbers } from "./logic.ts";
import { fallbackReply } from "./gemini.ts";
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

// ---------- Challenge 2: honest bundle ----------
const WEDDING = RULES.female_adult.wedding!;
const refs = (r: ReturnType<typeof buildBundle>) => r.items.map((i) => ({ product_id: i.product_id, slot: i.slot, name: i.name, price: i.price }));

test("thin catalog: an empty slot is named, the bundle is partial, and its total is the true total", () => {
  const noShoes = products.filter((p) => p.category !== "shoes");
  const r = buildBundle(WEDDING, noShoes, ctx("female_adult", 5000));
  assert.equal(r.status, "partial");                        // never "ok" while a piece is missing
  assert.deepEqual(r.unavailable, ["Shoes"]);
  assert.ok(r.items.length > 0);
  assert.ok(r.items.every((i) => i.slot !== "shoes"));      // no fake or filler item in the gap
  assert.equal(r.total, r.items.reduce((t, i) => t + i.price, 0));
  assert.ok(r.total <= 5000);
  const text = fallbackReply({
    status: r.status, language: "en", budget: 5000, total: r.total, remaining: 5000 - r.total, missing: r.unavailable,
    left_out: r.dropped, min_required_total: r.minRequired,
    items: r.items.map((i) => ({ label: i.label, name: i.name, price: i.price, original_price: i.original_price, shop: i.shop_name, seller_flagged: i.seller_flagged })),
  });
  assert.match(text, /no shoes in stock for this look/i);
});

test("thin catalog: nothing at all in the shop gives no_match and no items", () => {
  const r = buildBundle(WEDDING, [], ctx("female_adult", 5000));
  assert.equal(r.status, "no_match");
  assert.equal(r.items.length, 0);
  assert.equal(r.total, 0);
  assert.deepEqual(r.unavailable.sort(), WEDDING.map((s) => s.label).sort());
});

test("item sold out after the bundle was built: reported and replaced from the same slot, inside the budget", () => {
  const built = buildBundle(WEDDING, products, ctx("female_adult", 5000));
  const outfit = built.items.find((i) => i.slot === "outfit")!;
  const live = products.map((p) => (p.id === outfit.product_id ? { ...p, variants: p.variants.map((v) => ({ ...v, stock: 0 })) } : p));
  const fix = repairBundle(WEDDING, refs(built), live, ctx("female_adult", 5000));
  assert.equal(fix.status, "repaired");
  assert.deepEqual(fix.gone.map((g) => [g.product_id, g.reason]), [[outfit.product_id, "sold_out"]]);
  assert.equal(fix.replacements.length, 1);
  const rep = fix.replacements[0];
  assert.equal(rep.slot, "outfit");
  assert.notEqual(rep.item.product_id, outfit.product_id);
  assert.ok(isInStock(byId.get(rep.item.product_id)!));
  assert.ok(fix.total <= 5000);
  assert.equal(fix.items.length, built.items.length);
  assert.ok(fix.items.every((i) => i.product_id !== outfit.product_id));
});

test("item vanishes and nothing in that slot fits the budget: reported as unfilled, never faked", () => {
  const built = buildBundle(WEDDING, products, ctx("female_adult", 5000));
  const outfit = built.items.find((i) => i.slot === "outfit")!;
  const live = products.filter((p) => !(p.custom_category && ["sari", "three-piece"].includes(p.custom_category) && p.category === "clothing"));
  const fix = repairBundle(WEDDING, refs(built), live, ctx("female_adult", 5000));
  assert.equal(fix.status, "partial");
  assert.deepEqual(fix.unfilled, ["Sari / outfit"]);
  assert.equal(fix.gone[0].reason, "removed");
  assert.ok(fix.items.every((i) => i.slot !== "outfit"));
  assert.ok(fix.total <= 5000);
  assert.ok(outfit.product_id);
});

test("hidden (inactive) product is reported as inactive", () => {
  const built = buildBundle(WEDDING, products, ctx("female_adult", 5000));
  const shoes = built.items.find((i) => i.slot === "shoes")!;
  const live = products.map((p) => (p.id === shoes.product_id ? { ...p, status: "hidden" } : p));
  const fix = repairBundle(WEDDING, refs(built), live, ctx("female_adult", 5000));
  assert.equal(fix.gone[0].reason, "inactive");
  assert.ok(fix.replacements.length === 1 || fix.unfilled.length === 1);
});

test("nothing changed: status unchanged and no replacement", () => {
  const built = buildBundle(WEDDING, products, ctx("female_adult", 5000));
  const fix = repairBundle(WEDDING, refs(built), products, ctx("female_adult", 5000));
  assert.equal(fix.status, "unchanged");
  assert.equal(fix.gone.length, 0);
  assert.equal(fix.total, built.total);
});

test("a seller raised a price so the look no longer fits: over_budget, never silently over", () => {
  const built = buildBundle(WEDDING, products, ctx("female_adult", 5000));
  const live = products.map((p) => (built.items.some((i) => i.product_id === p.id) ? { ...p, price: p.price + 2000, discount_price: null } : p));
  const fix = repairBundle(WEDDING, refs(built), live, ctx("female_adult", 5000));
  assert.equal(fix.status, "over_budget");
  assert.equal(fix.within_budget, false);
  assert.ok(fix.price_changes.length > 0);
});

test("budget below the minimum: too_low with the cheapest REAL complete total and real partial alternatives", () => {
  const r = buildBundle(WEDDING, products, ctx("female_adult", 800));
  assert.equal(r.status, "too_low");
  assert.equal(r.items.length, 0);                            // no bundle that pretends to fit
  assert.equal(r.total, 0);
  assert.equal(r.minRequired, 2750);                          // cheapest sari + cheapest shoes + cheapest jewelry in the catalog
  assert.ok(r.affordable.length > 0);
  assert.ok(r.affordable.every((i) => i.price <= 800 && byId.has(i.product_id)));
  const text = fallbackReply({
    status: r.status, language: "en", budget: 800, min_required_total: r.minRequired,
    affordable: r.affordable.map((i) => ({ label: i.label, name: i.name, price: i.price, shop: i.shop_name })),
  });
  assert.match(text, /not enough/);
  assert.match(text, /cheapest complete look in our shop is 2,750 BDT/);
});

test("budget sweep: a look is never over budget, and too_low never returns items", () => {
  for (let b = 50; b <= 6000; b += 125) {
    const r = buildBundle(WEDDING, products, ctx("female_adult", b));
    assert.ok(r.total <= b, `budget ${b}`);
    if (r.status === "too_low") assert.equal(r.items.length, 0);
    if (r.status === "ok") assert.ok(r.unavailable.length === 0);
  }
});

// ---------- guard against invented numbers in the AI reply ----------
test("reply guard", () => {
  assert.deepEqual(numbersInText("Total ৳4,800, shoes 1350 and 5k budget"), [4800, 1350]);
  const allowed = new Set([4800, 1350, 5000]);
  assert.equal(replyUsesOnlyKnownNumbers("Your look costs 4,800 BDT with 200 left", allowed), false);
  assert.equal(replyUsesOnlyKnownNumbers("Your look costs 4,800 BDT, shoes 1350", allowed), true);
});

console.log(`\n${passed} tests passed`);
