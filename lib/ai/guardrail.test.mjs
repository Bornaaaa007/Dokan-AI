import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from './scenarios.mjs';
import { computeLimits, checkBudget } from './guardrail.mjs';
import { parseBudget } from './budget.mjs';

let n = 0;
const item = (custom, category, price, o = {}) => ({
  id: 'p' + ++n, name: custom + ' ' + price, custom_category: custom, category, price,
  discount_price: o.discount ?? null,
  gender: o.gender ?? 'female', age_group: o.age ?? 'adult',
  occasion_tags: o.tags ?? ['wedding'],
  status: o.status ?? 'active',
  variants: [{ size: 'free', color: 'x', stock: o.stock ?? 3 }],
});
const catalog = () => [
  item('sari', 'clothing', 1500), item('sari', 'clothing', 6500), item('three-piece', 'clothing', 3600),
  item('flats', 'shoes', 800), item('heels', 'shoes', 1350),
  item('bangles', 'jewelry', 450), item('bridal set', 'jewelry', 2600),
];
const wedding = SCENARIOS.wedding_woman;
const limitsOf = (extra = [], base = catalog()) => computeLimits([...base, ...extra], wedding);

test('limits come from the catalog', () => {
  const l = limitsOf();
  assert.equal(l.lowest, 2750);
  assert.equal(l.highest, 10450);
  assert.equal(l.floor, 1500);
  assert.deepEqual(l.missingSlots, []);
});

test('out-of-stock items are ignored', () => {
  assert.equal(limitsOf([item('sari', 'clothing', 1000, { stock: 0 })]).lowest, 2750);
});
test('hidden items are ignored', () => {
  assert.equal(limitsOf([item('sari', 'clothing', 1000, { status: 'hidden' })]).lowest, 2750);
});
test('discount price is used', () => {
  assert.equal(limitsOf([item('sari', 'clothing', 2000, { discount: 1400 })]).lowest, 2650);
});
test('men items are ignored for a woman scenario', () => {
  assert.equal(limitsOf([item('sari', 'clothing', 500, { gender: 'male' })]).lowest, 2750);
});
test('unisex items count', () => {
  assert.equal(limitsOf([item('flats', 'shoes', 300, { gender: 'unisex' })]).lowest, 2250);
});
test('child items are ignored for an adult scenario', () => {
  assert.equal(limitsOf([item('sari', 'clothing', 500, { age: 'child' })]).lowest, 2750);
});
test('items for other occasions are ignored', () => {
  assert.equal(limitsOf([item('sari', 'clothing', 500, { tags: ['formal'] })]).lowest, 2750);
});

test('missing jewelry is reported, not hidden', () => {
  const l = limitsOf([], catalog().filter((p) => p.category !== 'jewelry'));
  assert.deepEqual(l.missingSlots, ['jewelry']);
  const r = checkBudget(5000, l);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.missingSlots, ['jewelry']);
});
test('no main piece means unavailable', () => {
  const l = limitsOf([], catalog().filter((p) => p.category !== 'clothing'));
  assert.equal(checkBudget(5000, l).status, 'unavailable');
});

const status = (amount) => checkBudget(amount, limitsOf()).status;
test('thresholds', () => {
  assert.equal(status(100), 'too_low');
  assert.equal(status(1000), 'too_low');
  assert.equal(status(1499), 'too_low');
  assert.equal(status(1500), 'partial');
  assert.equal(status(2500), 'partial');
  assert.equal(status(2749), 'partial');
  assert.equal(status(2750), 'ok');
  assert.equal(status(5000), 'ok');
  assert.equal(status(10450), 'ok');
  assert.equal(status(20900), 'ok');
  assert.equal(status(20901), 'too_high');
  assert.equal(status(100000), 'too_high');
});
test('above typical is flagged', () => {
  assert.equal(checkBudget(5000, limitsOf()).aboveTypical, false);
  assert.equal(checkBudget(15000, limitsOf()).aboveTypical, true);
});
test('bad amounts are invalid', () => {
  assert.equal(status(null), 'invalid');
  assert.equal(status(0), 'invalid');
  assert.equal(status(-5), 'invalid');
  assert.equal(status(5000.5), 'invalid');
});
test('works with the parser', () => {
  assert.equal(checkBudget(parseBudget('hello'), limitsOf()).status, 'invalid');
  assert.equal(checkBudget(parseBudget('100 taka'), limitsOf()).status, 'too_low');
  assert.equal(checkBudget(parseBudget('1 lakh'), limitsOf()).status, 'too_high');
});
test('messages show the real numbers', () => {
  assert.match(checkBudget(100, limitsOf()).message, /2,750 BDT/);
  assert.match(checkBudget(100000, limitsOf()).message, /10,450 BDT/);
});
