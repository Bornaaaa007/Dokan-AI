import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyticsDb } from './db.mjs';

// Minimal fake of the Supabase query builder that records every call.
function fakeSb(result) {
  const calls = [];
  const builder = (table) => {
    const q = { table, ops: [] };
    calls.push(q);
    const chain = new Proxy({}, {
      get: (_, name) => {
        if (name === 'then') return (res) => res(result);
        return (...args) => { q.ops.push([name, ...args]); return chain; };
      },
    });
    return chain;
  };
  return { sb: { from: builder }, calls };
}

test('performance is read from the view and filtered by shop', async () => {
  const { sb, calls } = fakeSb({ data: [{ a: 1 }], error: null });
  assert.deepEqual(await createAnalyticsDb(sb).getPerformance('S1'), [{ a: 1 }]);
  assert.equal(calls[0].table, 'product_performance');
  assert.deepEqual(calls[0].ops.find((o) => o[0] === 'eq'), ['eq', 'shop_id', 'S1']);
});

test('demand gap, trending and top sellers use the right views and order', async () => {
  const { sb, calls } = fakeSb({ data: [], error: null });
  const db = createAnalyticsDb(sb);
  await db.getDemandGap(); await db.getTrending(); await db.getTopSellers();
  assert.deepEqual(calls.map((c) => c.table), ['demand_gap', 'trending_products', 'top_sellers']);
  assert.deepEqual(calls[0].ops.find((o) => o[0] === 'order'), ['order', 'opportunity_score', { ascending: false }]);
  assert.deepEqual(calls[2].ops.find((o) => o[0] === 'order'), ['order', 'rnk', { ascending: true }]);
});

test('a null data result becomes an empty list', async () => {
  const { sb } = fakeSb({ data: null, error: null });
  assert.deepEqual(await createAnalyticsDb(sb).getDemandGap(), []);
});

test('errors are thrown with context', async () => {
  const { sb } = fakeSb({ data: null, error: { message: 'relation does not exist' } });
  await assert.rejects(createAnalyticsDb(sb).getTopSellers(), /load top sellers: relation does not exist/);
});

test('shop lookup reads id, name and plan fields only', async () => {
  const { sb, calls } = fakeSb({ data: { id: 'S1' }, error: null });
  await createAnalyticsDb(sb).getShop('S1');
  const sel = calls[0].ops.find((o) => o[0] === 'select')[1];
  assert.ok(!sel.includes('nid_number'));
  assert.match(sel, /plan_expires_at/);
});
