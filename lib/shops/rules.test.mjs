import test from 'node:test';
import assert from 'node:assert/strict';
import { validateShopInput, validateVerification, addMonths, premiumExpiry, PREMIUM_PLANS } from './rules.mjs';

test('create needs a name; fields are cleaned', () => {
  assert.ok(validateShopInput({}).errors.length);
  const { errors, value } = validateShopInput({ name: '  Nilima   Boutique ', city: ' Dhaka ', social_url: 'https://facebook.com/nilima', nid_number: '1234 567-890' });
  assert.deepEqual(errors, []);
  assert.deepEqual(value, { name: 'Nilima Boutique', city: 'Dhaka', social_url: 'https://facebook.com/nilima', nid_number: '1234567890' });
});
test('bad names, links and NIDs are rejected', () => {
  assert.ok(validateShopInput({ name: 'x' }).errors.length);
  assert.ok(validateShopInput({ name: 'x'.repeat(81) }).errors.length);
  assert.ok(validateShopInput({ name: 'Shop', social_url: 'javascript:alert(1)' }).errors.length);
  assert.ok(validateShopInput({ name: 'Shop', nid_number: '12345' }).errors.length);
  assert.ok(validateShopInput({ name: 'Shop', nid_number: 'abcdefghij' }).errors.length);
  for (const ok of ['1234567890', '1234567890123', '12345678901234567']) assert.deepEqual(validateShopInput({ name: 'Shop', nid_number: ok }).errors, []);
});
test('patch only checks what was sent; empty values become null', () => {
  assert.deepEqual(validateShopInput({ city: 'Sylhet' }, { partial: true }).value, { city: 'Sylhet' });
  assert.equal(validateShopInput({ social_url: '' }, { partial: true }).value.social_url, null);
});
test('verification decisions: a rejection needs a reason', () => {
  assert.deepEqual(validateVerification({ status: 'verified' }), { status: 'verified' });
  assert.ok(validateVerification({ status: 'rejected' }).error);
  assert.ok(validateVerification({ status: 'rejected', reason: 'no' }).error);
  assert.deepEqual(validateVerification({ status: 'rejected', reason: 'NID photo is unclear' }), { status: 'rejected', reason: 'NID photo is unclear' });
  assert.ok(validateVerification({ status: 'pending' }).error);
  assert.ok(validateVerification(null).error);
});
test('Premium prices match the PRD', () => {
  assert.deepEqual(PREMIUM_PLANS, { 1: 1000, 3: 2500, 6: 5000 });
});
test('months are added correctly, including short months', () => {
  assert.equal(addMonths(new Date('2026-11-22T10:00:00Z'), 3).toISOString(), '2027-02-22T10:00:00.000Z');
  assert.equal(addMonths(new Date('2026-11-30T10:00:00Z'), 3).toISOString(), '2027-02-28T10:00:00.000Z');
  assert.equal(addMonths(new Date('2026-11-22T10:00:00Z'), 6).toISOString(), '2027-05-22T10:00:00.000Z');
});
test('buying Premium extends an active plan, and restarts an expired or free one', () => {
  const now = new Date('2026-11-22T00:00:00Z');
  assert.equal(premiumExpiry({ plan: 'free', plan_expires_at: null }, 1, now).toISOString(), '2026-12-22T00:00:00.000Z');
  assert.equal(premiumExpiry({ plan: 'premium', plan_expires_at: '2027-01-10T00:00:00Z' }, 1, now).toISOString(), '2027-02-10T00:00:00.000Z');
  assert.equal(premiumExpiry({ plan: 'premium', plan_expires_at: '2026-01-10T00:00:00Z' }, 1, now).toISOString(), '2026-12-22T00:00:00.000Z');
});
