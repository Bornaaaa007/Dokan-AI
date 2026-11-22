import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSellerAnalytics, handleAdminInsights, handleTopSellers } from './handlers.mjs';

const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const SELLER = id(1), OTHER = id(2), ADMIN = id(3), CUST = id(4);
const SHOP = id(20), SHOP2 = id(21);
const NOW = new Date('2026-11-22T00:00:00Z');
const req = (qs = '', user, headers = {}) =>
  new Request('http://localhost/api/seller/analytics' + qs, { headers: { ...(user ? { 'x-user-id': user } : {}), ...headers } });
const shops = {
  [SHOP]: { id: SHOP, name: 'Nilima Boutique', plan: 'premium', plan_expires_at: null },
  [SHOP2]: { id: SHOP2, name: 'Other Shop', plan: 'free', plan_expires_at: null },
};
const owners = { [SELLER]: SHOP, [OTHER]: SHOP2 };
const fakeDb = (o = {}) => ({
  getUser: async (i) => ({ [SELLER]: { id: SELLER, roles: ['seller'] }, [OTHER]: { id: OTHER, roles: ['seller'] }, [ADMIN]: { id: ADMIN, roles: ['admin'] }, [CUST]: { id: CUST, roles: ['customer'] } })[i] ?? null,
  getShopsByOwner: async (u) => (owners[u] ? [shops[owners[u]]] : []),
  getShop: async (i) => shops[i] ?? null,
  getPerformance: async () => [{ product_id: 'p1', name: 'Sari', in_stock: true, views_30d: 40, carts_30d: 8, purchases_30d: 8, conversion: 0.2, signal: 'doing_well' }],
  getDemandGap: async () => [{ custom_category: 'sari', color: 'maroon', occasion: null, searches_30d: 70, listings: 1, opportunity_score: 70, signal: 'high_opportunity' }],
  getTrending: async () => [],
  getTopSellers: async () => [{ shop_id: SHOP, name: 'Nilima Boutique', purchases_30d: 22, rnk: 1 }],
  ...o,
});
const body = async (res) => res.json();

test('not signed in is 401; a customer is 403', async () => {
  assert.equal((await handleSellerAnalytics(req('', undefined), fakeDb(), NOW)).status, 401);
  assert.equal((await handleSellerAnalytics(req('', CUST), fakeDb(), NOW)).status, 403);
});

test('a seller gets their own shop and any shop_id they send is ignored', async () => {
  let asked;
  const db = fakeDb({ getPerformance: async (i) => { asked = i; return []; } });
  const res = await handleSellerAnalytics(req('?shop_id=' + SHOP2, SELLER), db, NOW);
  assert.equal(res.status, 200);
  assert.equal(asked, SHOP);
  assert.equal((await body(res)).data.shop.name, 'Nilima Boutique');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('a seller with no shop yet gets 404 no_shop', async () => {
  const db = fakeDb({ getUser: async () => ({ id: id(9), roles: ['seller'] }) });
  const res = await handleSellerAnalytics(req('', id(9)), db, NOW);
  assert.equal(res.status, 404);
  assert.equal((await body(res)).error.code, 'no_shop');
});

test('an admin must name a valid shop and can see any shop', async () => {
  assert.equal((await handleSellerAnalytics(req('', ADMIN), fakeDb(), NOW)).status, 400);
  assert.equal((await handleSellerAnalytics(req('?shop_id=abc', ADMIN), fakeDb(), NOW)).status, 400);
  assert.equal((await handleSellerAnalytics(req('?shop_id=' + id(99), ADMIN), fakeDb(), NOW)).status, 404);
  const ok = await handleSellerAnalytics(req('?shop_id=' + SHOP2, ADMIN), fakeDb(), NOW);
  assert.equal(ok.status, 200);
  assert.equal((await body(ok)).data.shop.name, 'Other Shop');
});

test('premium shop gets full analytics, free shop never triggers the platform queries', async () => {
  const { data } = await body(await handleSellerAnalytics(req('', SELLER), fakeDb(), NOW));
  assert.equal(data.locked, false);
  assert.equal(data.shop.top_seller_rank, 1);
  assert.equal(data.insights[0].type, 'demand_gap');
  let called = 0;
  const db = fakeDb({ getDemandGap: async () => { called++; return []; }, getTrending: async () => { called++; return []; } });
  const free = await body(await handleSellerAnalytics(req('', OTHER), db, NOW));
  assert.equal(free.data.locked, true);
  assert.equal(free.data.platform, null);
  assert.equal(called, 0);
});

test('a bad bearer token never falls back to the demo header', async () => {
  const res = await handleSellerAnalytics(req('', SELLER, { authorization: 'Bearer nope' }), fakeDb(), NOW);
  assert.equal(res.status, 401);
});

test('database errors give a generic 500 that leaks nothing', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const res = await handleSellerAnalytics(req('', SELLER), fakeDb({ getPerformance: async () => { throw new Error('secret table name exploded'); } }), NOW);
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(await body(res)).includes('secret table'));
    const res2 = await handleSellerAnalytics(req('', SELLER), () => { throw new Error('Missing SUPABASE_SECRET_KEY'); }, NOW);
    assert.equal(res2.status, 500);
    assert.ok(!JSON.stringify(await body(res2)).includes('SUPABASE'));
  } finally { console.error = quiet; }
});

test('admin insights are admin-only', async () => {
  assert.equal((await handleAdminInsights(req('', undefined), fakeDb())).status, 401);
  assert.equal((await handleAdminInsights(req('', SELLER), fakeDb())).status, 403);
  assert.equal((await handleAdminInsights(req('', CUST), fakeDb())).status, 403);
  const a = await body(await handleAdminInsights(req('', ADMIN), fakeDb()));
  assert.equal(a.data.demand_gap[0].name, 'maroon sari');
});

test('top sellers stay public', async () => {
  const t = await body(await handleTopSellers(req(), fakeDb()));
  assert.deepEqual(t.data.shops, [{ shop_id: SHOP, name: 'Nilima Boutique', rank: 1 }]);
});
