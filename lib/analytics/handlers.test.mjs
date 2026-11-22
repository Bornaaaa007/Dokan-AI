import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSellerAnalytics, handleAdminInsights, handleTopSellers } from './handlers.mjs';

const ID = '00000000-0000-4000-9000-000000000001';
const NOW = new Date('2026-11-22T00:00:00Z');
const req = (qs = '') => new Request('http://localhost/api/seller/analytics' + qs);
const fakeDb = (o = {}) => ({
  getShop: async () => ({ id: ID, name: 'Nilima Boutique', plan: 'premium', plan_expires_at: null }),
  getPerformance: async () => [{ product_id: 'p1', name: 'Sari', in_stock: true, views_30d: 40, carts_30d: 8, purchases_30d: 8, conversion: 0.2, signal: 'doing_well' }],
  getDemandGap: async () => [{ custom_category: 'sari', color: 'maroon', occasion: null, searches_30d: 70, listings: 1, opportunity_score: 70, signal: 'high_opportunity' }],
  getTrending: async () => [],
  getTopSellers: async () => [{ shop_id: ID, name: 'Nilima Boutique', purchases_30d: 22, rnk: 1 }],
  ...o,
});
const body = async (res) => res.json();

test('shop_id is required and must be a uuid', async () => {
  assert.equal((await handleSellerAnalytics(req(), fakeDb())).status, 400);
  assert.equal((await handleSellerAnalytics(req('?shop_id=abc'), fakeDb())).status, 400);
  assert.equal((await handleSellerAnalytics(req('?shop_id=1 or 1=1'), fakeDb())).status, 400);
});

test('unknown shop gives 404', async () => {
  const res = await handleSellerAnalytics(req('?shop_id=' + ID), fakeDb({ getShop: async () => null }));
  assert.equal(res.status, 404);
  assert.equal((await body(res)).error.code, 'shop_not_found');
});

test('premium shop gets full analytics in the data envelope', async () => {
  const res = await handleSellerAnalytics(req('?shop_id=' + ID), fakeDb(), NOW);
  assert.equal(res.status, 200);
  const { data } = await body(res);
  assert.equal(data.locked, false);
  assert.equal(data.shop.top_seller_rank, 1);
  assert.equal(data.insights[0].type, 'demand_gap');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('free shop never triggers the platform queries', async () => {
  let called = 0;
  const db = fakeDb({
    getShop: async () => ({ id: ID, name: 'Free Shop', plan: 'free', plan_expires_at: null }),
    getDemandGap: async () => { called++; return []; },
    getTrending: async () => { called++; return []; },
  });
  const { data } = await body(await handleSellerAnalytics(req('?shop_id=' + ID), db, NOW));
  assert.equal(data.locked, true);
  assert.equal(data.platform, null);
  assert.equal(called, 0);
});

test('only this shop\'s performance is requested', async () => {
  let asked;
  await handleSellerAnalytics(req('?shop_id=' + ID), fakeDb({ getPerformance: async (id) => { asked = id; return []; } }), NOW);
  assert.equal(asked, ID);
});

test('database errors give a generic 500 that leaks nothing', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const res = await handleSellerAnalytics(req('?shop_id=' + ID), fakeDb({ getPerformance: async () => { throw new Error('secret table name exploded'); } }), NOW);
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(await body(res)).includes('secret table'));
    const res2 = await handleSellerAnalytics(req('?shop_id=' + ID), () => { throw new Error('Missing SUPABASE_SECRET_KEY'); }, NOW);
    assert.equal(res2.status, 500);
    assert.ok(!JSON.stringify(await body(res2)).includes('SUPABASE'));
  } finally { console.error = quiet; }
});

test('admin insights and top sellers respond', async () => {
  const a = await body(await handleAdminInsights(req(), fakeDb()));
  assert.equal(a.data.demand_gap[0].name, 'maroon sari');
  const t = await body(await handleTopSellers(req(), fakeDb()));
  assert.deepEqual(t.data.shops, [{ shop_id: ID, name: 'Nilima Boutique', rank: 1 }]);
});
