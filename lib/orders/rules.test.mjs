import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderInput, computeCommission, commissionRate, checkTransition, parseListQuery } from './rules.mjs';

const P = '00000000-0000-4000-8000-000000000030';
const addr = { name: 'Rina', phone: '+880 1711-000000', line1: 'House 4, Road 2', city: 'Dhaka' };
const good = () => ({ items: [{ product_id: P, size: 'M', color: 'Maroon', qty: 2 }], delivery_address: addr });

test('commission bands: 2% under 500, 3% under 1000, 5% from 1000', () => {
  assert.equal(commissionRate(499), 0.02);
  assert.equal(commissionRate(500), 0.03);
  assert.equal(commissionRate(999), 0.03);
  assert.equal(commissionRate(1000), 0.05);
});
test('commission is on item price only and the amount is rounded per line', () => {
  assert.deepEqual(computeCommission([{ unit_price: 2500, qty: 1 }]), { item_total: 2500, commission_amount: 125, commission_rate: 0.05 });
  assert.deepEqual(computeCommission([{ unit_price: 450, qty: 3 }]), { item_total: 1350, commission_amount: 27, commission_rate: 0.02 });
  const mixed = computeCommission([{ unit_price: 999, qty: 1 }, { unit_price: 1000, qty: 1 }]);
  assert.equal(mixed.commission_amount, 30 + 50);
  assert.equal(mixed.commission_rate, 0.04);
  assert.equal(computeCommission([]).commission_amount, 0);
});
test('a valid order is cleaned; same line twice is merged; method defaults to sandbox', () => {
  const b = good(); b.items.push({ product_id: P.toUpperCase(), size: 'm', color: 'maroon', qty: 3 });
  const { errors, value } = validateOrderInput(b);
  assert.deepEqual(errors, []);
  assert.deepEqual(value.items, [{ product_id: P, size: 'M', color: 'maroon', qty: 5 }]);
  assert.equal(value.payment_method, 'sandbox');
  assert.equal(value.delivery_address.phone, '+8801711000000');
});
test('bad items, qty, method and address are rejected', () => {
  const bad = (patch) => validateOrderInput({ ...good(), ...patch }).errors.length > 0;
  assert.ok(bad({ items: [] }));
  assert.ok(bad({ items: [{ product_id: 'x', size: 'M', qty: 1 }] }));
  assert.ok(bad({ items: [{ product_id: P, size: 'M', qty: 0 }] }));
  assert.ok(bad({ items: [{ product_id: P, size: 'M', qty: 1.5 }] }));
  assert.ok(bad({ items: [{ product_id: P, size: 'M', qty: 11 }] }));
  assert.ok(bad({ items: [{ product_id: P, size: 'M', qty: 6 }, { product_id: P, size: 'M', qty: 6 }] }));
  assert.ok(bad({ payment_method: 'crypto' }));
  assert.ok(bad({ delivery_address: undefined }));
  assert.ok(bad({ delivery_address: { ...addr, phone: '123' } }));
  assert.ok(bad({ delivery_address: { ...addr, city: '' } }));
  assert.equal(validateOrderInput({ ...good(), payment_method: 'COD' }).value.payment_method, 'cod');
});
test('status moves one step forward, cancel only before shipping', () => {
  const o = (status, payment_status = 'held') => ({ status, payment_status });
  const t = (order, to, actor) => checkTransition({ order, to, actor });
  assert.equal(t(o('placed'), 'accepted', 'seller'), null);
  assert.equal(t(o('accepted'), 'packed', 'seller'), null);
  assert.equal(t(o('packed'), 'shipped', 'seller'), null);
  assert.equal(t(o('shipped'), 'delivered', 'seller'), null);
  assert.equal(t(o('placed'), 'packed', 'seller').code, 'bad_transition');
  assert.equal(t(o('shipped'), 'cancelled', 'seller').code, 'bad_transition');
  assert.equal(t(o('delivered'), 'cancelled', 'admin').code, 'bad_transition');
  assert.equal(t(o('cancelled'), 'accepted', 'admin').code, 'bad_transition');
});
test('customers can only cancel before acceptance or confirm a shipped order', () => {
  const o = (status) => ({ status, payment_status: 'held' });
  assert.equal(checkTransition({ order: o('placed'), to: 'cancelled', actor: 'customer' }), null);
  assert.equal(checkTransition({ order: o('shipped'), to: 'delivered', actor: 'customer' }), null);
  assert.equal(checkTransition({ order: o('accepted'), to: 'cancelled', actor: 'customer' }).code, 'customer_cannot');
  assert.equal(checkTransition({ order: o('placed'), to: 'accepted', actor: 'customer' }).code, 'customer_cannot');
});
test('an unpaid order cannot be accepted, packed or shipped, but can be cancelled', () => {
  for (const ps of ['pending', 'failed']) {
    assert.equal(checkTransition({ order: { status: 'placed', payment_status: ps }, to: 'accepted', actor: 'seller' }).code, 'payment_required');
    assert.equal(checkTransition({ order: { status: 'placed', payment_status: ps }, to: 'cancelled', actor: 'customer' }), null);
  }
});
test('list query: defaults and errors', () => {
  const p = (s) => parseListQuery(new URLSearchParams(s));
  assert.deepEqual(p('').value, { as: 'customer', status: undefined, page: 1, limit: 20 });
  assert.ok(p('as=boss').errors.length);
  assert.ok(p('status=lost').errors.length);
  assert.ok(p('limit=999').errors.length);
});
