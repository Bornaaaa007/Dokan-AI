import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanExtraction, buildUpdates, matchProduct, normalizeText, parseNumber } from './parseSellerMessage.mjs';

const P = (over) => ({ id: 'p-' + over.name, price: 2800, discount_price: null, custom_category: 'sari', colors: [], variants: [{ size: 'M', color: '', stock: 5 }, { size: 'L', color: '', stock: 2 }, { size: 'XL', color: '', stock: 1 }], ...over });
const KATAN = P({ name: 'Red Katan Sari', colors: ['red'] });
const SILK = P({ name: 'Maroon Silk Sari', colors: ['maroon'], price: 3500 });
const SHOES = P({ name: 'Black Heels', custom_category: 'heels', price: 1500, variants: [{ size: '38', color: '', stock: 4 }] });
const MINE = [KATAN, SILK, SHOES];

// What Gemini would return, already passed through cleanExtraction (Gemini itself is never called in tests).
const ext = (item) => cleanExtraction({ items: [{ source_text: '', product_name: '', sizes: [], only_these_sizes: false, sold_out: false, ...item }] });

test('English message: price and a per-size stock change on the right product', () => {
  const r = buildUpdates(ext({ product_name: 'Red katan sari', price: 2400, sizes: [{ size: 'M', stock: 3 }] }), MINE);
  assert.equal(r.updates.length, 1);
  const u = r.updates[0];
  assert.equal(u.product_id, KATAN.id);
  assert.equal(u.confidence, 'high');
  assert.equal(u.changes.price, 2400);
  assert.deepEqual(u.changes.variants, [{ size: 'M', stock: 3, was: 5 }]);
  assert.equal(u.patch.variants.length, 3);                       // PATCH body keeps every variant
  assert.equal(u.patch.variants.find((v) => v.size === 'L').stock, 2);
  assert.deepEqual(r.unmatched, []);
});

test('Bangla message: Bangla name, Bangla digits and an English translation from Gemini', () => {
  const raw = { items: [{ source_text: 'লাল কাতান শাড়ি এখন ২৪০০ টাকা', product_name: 'লাল কাতান শাড়ি', product_name_en: 'red katan sari', price: '২,৪০০', sizes: [], only_these_sizes: false, sold_out: false }] };
  const r = buildUpdates(cleanExtraction(raw), MINE);
  assert.equal(r.updates[0].product_id, KATAN.id);
  assert.equal(r.updates[0].changes.price, 2400);
});

test('a Bangla product name matches a Bangla-named product even with ী / ি spelling differences', () => {
  const bn = P({ name: 'লাল কাতান শাড়ী' });
  const r = matchProduct({ product_name: 'লাল কাতান শাড়ি', product_name_en: '' }, [bn, SHOES]);
  assert.equal(r.confidence, 'high');
  assert.equal(r.best.id, bn.id);
});

test('typo in the product name still matches (katn, saree)', () => {
  const r = buildUpdates(ext({ product_name: 'Red katn saree', price: 2500 }), MINE);
  assert.equal(r.updates[0].product_id, KATAN.id);
  assert.equal(r.updates[0].confidence, 'high');
});

test('a message with no product returns no updates and a warning', () => {
  const none = buildUpdates(cleanExtraction({ items: [] }), MINE);
  assert.deepEqual(none.updates, []);
  assert.match(none.warnings[0], /No product update/);
  const priceOnly = buildUpdates(ext({ price: 2400, source_text: 'price is 2400 now' }), MINE);   // numbers but no product name
  assert.deepEqual(priceOnly.updates, []);
  assert.deepEqual(priceOnly.unmatched, ['price is 2400 now']);
});

test('a product that is not in the seller list goes to unmatched, never to another product', () => {
  const r = buildUpdates(ext({ product_name: 'Blue Denim Jacket', price: 999, source_text: 'blue denim jacket 999' }), MINE);
  assert.deepEqual(r.updates, []);
  assert.deepEqual(r.unmatched, ['blue denim jacket 999']);
});

test('two similar products: needs_confirmation with choices, no product picked', () => {
  const twin = P({ name: 'Red Katan Sari Premium', colors: ['red'] });
  const r = buildUpdates(ext({ product_name: 'red sari', price: 2000 }), [KATAN, twin, SHOES]);
  const u = r.updates[0];
  assert.equal(u.confidence, 'low');
  assert.equal(u.product_id, null);
  assert.equal(u.needs_confirmation, true);
  assert.equal(r.needs_confirmation, true);
  assert.deepEqual(u.candidates.map((c) => c.product_id).sort(), [KATAN.id, twin.id].sort());
  assert.deepEqual(u.changes, {});
});

test('the seller picking a product (selections) turns a low match into a normal update', () => {
  const twin = P({ name: 'Red Katan Sari Premium', colors: ['red'] });
  const r = buildUpdates(ext({ product_name: 'red sari', price: 2000 }), [KATAN, twin], { selections: { 0: twin.id } });
  assert.equal(r.updates[0].product_id, twin.id);
  assert.equal(r.updates[0].changes.price, 2000);
});

test('a selection for a product the seller does not own is ignored', () => {
  const r = buildUpdates(ext({ product_name: 'zzz unknown', price: 2000, source_text: 'zzz' }), MINE, { selections: { 0: 'someone-elses-product' } });
  assert.deepEqual(r.updates, []);
  assert.ok(r.warnings.some((w) => /not in your shop/.test(w)));
});

test('invalid numbers are rejected: negative stock, fractional or huge price', () => {
  const neg = buildUpdates(ext({ product_name: 'Red Katan Sari', sizes: [{ size: 'M', stock: -2 }] }), MINE);
  assert.deepEqual(neg.updates, []);
  assert.ok(neg.warnings.some((w) => /whole number from 0/.test(w)));
  const frac = buildUpdates(ext({ product_name: 'Red Katan Sari', price: 2400.5 }), MINE);
  assert.deepEqual(frac.updates, []);
  assert.ok(frac.warnings.some((w) => /Price not changed/.test(w)));
  const huge = buildUpdates(ext({ product_name: 'Red Katan Sari', price: 99999999 }), MINE);
  assert.deepEqual(huge.updates, []);
});

test('a new price that breaks the discount rule is rejected (checkPrices)', () => {
  const disc = P({ name: 'Red Katan Sari', discount_price: 2500 });
  const r = buildUpdates(ext({ product_name: 'Red Katan Sari', price: 2400 }), [disc]);
  assert.deepEqual(r.updates, []);
  assert.ok(r.warnings.some((w) => /discount price/.test(w)));
});

test('"M and L only" zeroes the other sizes; an unknown size is skipped with a warning', () => {
  const r = buildUpdates(ext({ product_name: 'Red Katan Sari', sizes: [{ size: 'm', stock: 3 }, { size: 'L', stock: 1 }, { size: 'XXL', stock: 2 }], only_these_sizes: true }), MINE);
  const byS = Object.fromEntries(r.updates[0].patch.variants.map((v) => [v.size, v.stock]));
  assert.deepEqual(byS, { M: 3, L: 1, XL: 0 });
  assert.ok(r.warnings.some((w) => /no size XXL/.test(w)));
});

test('one total for several sizes is not guessed', () => {
  const r = buildUpdates(ext({ product_name: 'Red Katan Sari', price: 2400, stock: 3, sizes: [{ size: 'M' }, { size: 'L' }], only_these_sizes: true }), MINE);
  assert.equal(r.updates[0].changes.price, 2400);
  assert.ok(r.warnings.some((w) => /covers 2 sizes/.test(w)));
  assert.equal(r.updates[0].patch.variants.find((v) => v.size === 'M').stock, 5);   // M and L untouched, XL zeroed
});

test('sold out sets every size to 0; stock with no size on a multi-size product is not guessed', () => {
  const so = buildUpdates(ext({ product_name: 'Red Katan Sari', sold_out: true }), MINE);
  assert.ok(so.updates[0].patch.variants.every((v) => v.stock === 0));
  const loose = buildUpdates(ext({ product_name: 'Red Katan Sari', stock: 3 }), MINE);
  assert.deepEqual(loose.updates, []);
  assert.ok(loose.warnings.some((w) => /Say which size/.test(w)));
  const single = buildUpdates(ext({ product_name: 'Black Heels', stock: 7 }), MINE);
  assert.equal(single.updates[0].patch.variants[0].stock, 7);
});

test('no real change gives a warning, not an empty update', () => {
  const r = buildUpdates(ext({ product_name: 'Red Katan Sari', price: 2800 }), MINE);
  assert.deepEqual(r.updates, []);
  assert.ok(r.warnings.some((w) => /nothing to change/.test(w)));
});

test('helpers: Bangla digits, number parsing, text normalising', () => {
  assert.equal(parseNumber('৳২,৪০০'), 2400);
  assert.equal(parseNumber('2400 tk'), 2400);
  assert.equal(parseNumber('abc'), null);
  assert.equal(normalizeText('  Red,  KATAN!! '), 'red katan');
});
