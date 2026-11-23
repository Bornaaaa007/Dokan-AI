import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductReview, checkEligible, orderHasProduct } from './rules.mjs';

const OID = '00000000-0000-4000-8000-0000000000a1';
const PID = '00000000-0000-4000-8000-0000000000b1';
const U = '00000000-0000-4000-8000-000000000001';

test('validateProductReview accepts a good review and trims the text', () => {
  const r = validateProductReview({ order_id: OID.toUpperCase(), rating: 4, body: '  Fabric is soft and the colour is true.  ' });
  assert.equal(r.ok, true);
  assert.equal(r.value.body, 'Fabric is soft and the colour is true.');
  assert.equal(r.value.order_id, OID);
});
test('validateProductReview refuses bad input', () => {
  const ok = { order_id: OID, rating: 5, body: 'Good quality, fits well.' };
  assert.equal(validateProductReview(null).ok, false);
  assert.equal(validateProductReview([]).ok, false);
  assert.equal(validateProductReview({ ...ok, order_id: 'x' }).ok, false);
  assert.equal(validateProductReview({ ...ok, rating: 0 }).ok, false);
  assert.equal(validateProductReview({ ...ok, rating: 4.5 }).ok, false);
  assert.equal(validateProductReview({ ...ok, rating: '5' }).ok, false);
  assert.equal(validateProductReview({ ...ok, body: 'short' }).ok, false);
  assert.equal(validateProductReview({ ...ok, body: 'x'.repeat(501) }).ok, false);
  assert.equal(validateProductReview({ ...ok, body: 5 }).ok, false);
});
test('orderHasProduct matches the product id in order items', () => {
  assert.equal(orderHasProduct({ items: [{ product_id: PID }] }, PID), true);
  assert.equal(orderHasProduct({ items: [{ product_id: PID.toUpperCase() }] }, PID), true);
  assert.equal(orderHasProduct({ items: [{ product_id: 'other' }] }, PID), false);
  assert.equal(orderHasProduct({ items: null }, PID), false);
});
test('checkEligible: only the owner of a delivered order that holds the product', () => {
  const order = { id: OID, customer_id: U, status: 'delivered', items: [{ product_id: PID }] };
  assert.equal(checkEligible({ order, userId: U, productId: PID }), null);
  assert.equal(checkEligible({ order: null, userId: U, productId: PID }).code, 'not_eligible');
  assert.equal(checkEligible({ order, userId: 'someone-else', productId: PID }).code, 'not_eligible');
  assert.equal(checkEligible({ order, userId: U, productId: 'other' }).code, 'not_eligible');
  for (const status of ['placed', 'accepted', 'packed', 'shipped', 'cancelled'])
    assert.equal(checkEligible({ order: { ...order, status }, userId: U, productId: PID }).code, 'not_delivered');
});

test('checkEligible: a refunded delivered order is refused', () => {
  const order = { id: OID, customer_id: U, status: 'delivered', payment_status: 'refunded', items: [{ product_id: PID }] };
  assert.equal(checkEligible({ order, userId: U, productId: PID }).code, 'order_refunded');
  assert.equal(checkEligible({ order: { ...order, payment_status: 'released' }, userId: U, productId: PID }), null);
  assert.equal(checkEligible({ order: { ...order, payment_status: 'held' }, userId: U, productId: PID }), null);
});
