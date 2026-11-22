import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMe } from './handlers.mjs';

const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const SELLER = id(1), CUST = id(2), GHOST = id(3);
const users = [
  { id: SELLER, name: 'Nilima', email: 'n@x.com', phone: null, roles: ['customer', 'seller'], gender: 'female', age_group: 'adult', created_at: '2026-11-01T00:00:00Z' },
  { id: CUST, name: 'Rafi', email: 'r@x.com', phone: '017', roles: ['customer'], gender: null, age_group: null, created_at: '2026-11-02T00:00:00Z' },
];
const shops = [{ id: id(20), owner_id: SELLER, name: 'Nilima Boutique', verification_status: 'verified', plan: 'premium', plan_expires_at: '2027-01-01T00:00:00Z', nid_number: 'SECRET' }];
const db = {
  getUser: async (i) => users.find((u) => u.id === i) ?? null,
  getUserByToken: async (t) => (t === 'good' ? users[0] : null),
  getProfile: async (i) => users.find((u) => u.id === i) ?? null,
  getShopsByOwner: async (o) => shops.filter((s) => s.owner_id === o),
};
const get = async (headers = {}) => { const res = await handleMe(new Request('http://x/api/me', { headers }), {}, db); return { status: res.status, body: await res.json() }; };

test('a signed-in seller gets their profile, roles and shop', async () => {
  const r = await get({ 'x-user-id': SELLER });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.roles, ['customer', 'seller']);
  assert.equal(r.body.data.shop.name, 'Nilima Boutique');
  assert.equal(r.body.data.shop.plan, 'premium');
});
test('a bearer token works the same way', async () => {
  assert.equal((await get({ authorization: 'Bearer good' })).body.data.id, SELLER);
});
test('a customer gets shop: null', async () => {
  const r = await get({ 'x-user-id': CUST });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.shop, null);
});
test('the national id is never returned', async () => {
  assert.ok(!JSON.stringify((await get({ 'x-user-id': SELLER })).body).includes('SECRET'));
});
test('no login and a bad token both return 401', async () => {
  assert.equal((await get()).status, 401);
  assert.equal((await get({ authorization: 'Bearer bad' })).status, 401);
  assert.equal((await get({ 'x-user-id': GHOST })).status, 401);
});
