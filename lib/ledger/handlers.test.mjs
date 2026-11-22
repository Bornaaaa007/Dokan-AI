import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSellerLedger, handleAdminLedger } from './handlers.mjs';

const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const CUST = id(1), SELLER = id(2), ADMIN = id(3), OTHER_SELLER = id(5), NOSHOP = id(6);
const SHOP = id(20), SHOP2 = id(21);
const NOW = new Date('2026-11-22T12:00:00Z');
const row = (n, shop, ps, o = {}) => ({ id: id(100 + n), customer_id: CUST, shop_id: shop, item_total: 600, delivery_charge: 80, commission_rate: 0.03, commission_amount: 18, payment_method: 'sandbox', payment_status: ps, status: 'delivered', placed_at: `2026-11-${10 + n}T10:00:00Z`, paid_at: `2026-11-${10 + n}T10:05:00Z`, ...o });

function makeDb() {
  const calls = [];
  const all = [row(1, SHOP, 'held'), row(2, SHOP, 'released'), row(3, SHOP2, 'refunded'), row(4, SHOP2, 'released')];
  return {
    calls,
    getUser: async (i) => ({ [CUST]: { id: CUST, roles: ['customer'] }, [SELLER]: { id: SELLER, roles: ['seller'] }, [ADMIN]: { id: ADMIN, roles: ['admin'] }, [OTHER_SELLER]: { id: OTHER_SELLER, roles: ['seller'] }, [NOSHOP]: { id: NOSHOP, roles: ['seller'] } })[i] ?? null,
    getShopsByOwner: async (o) => ({ [SELLER]: [{ id: SHOP }], [OTHER_SELLER]: [{ id: SHOP2 }] })[o] ?? [],
    getShopsByIds: async (ids) => [{ id: SHOP, name: 'Nilima' }, { id: SHOP2, name: 'Other' }].filter((s) => ids.includes(s.id)),
    listLedgerOrders: async (q) => { calls.push(q); return all.filter((r) => (!q.shopId || r.shop_id === q.shopId) && (!q.status || r.payment_status === q.status)); },
  };
}
const get = (h, url, user) => h(new Request('http://x' + url, { headers: user ? { 'x-user-id': user } : {} }), makeDbRef.db, { now: NOW });
const makeDbRef = { db: null };
const call = async (h, url, user) => { makeDbRef.db = makeDb(); const res = await get(h, url, user); return { res, db: makeDbRef.db }; };

test('seller: only their own shop, with a summary', async () => {
  const { res, db } = await call(handleSellerLedger, '/api/seller/ledger', SELLER);
  const b = await res.json();
  assert.equal(res.status, 200); assert.equal(b.data.entries.length, 2);
  assert.ok(b.data.entries.every((e) => e.shop_id === SHOP && e.customer_id === undefined));
  assert.equal(b.data.summary.in_escrow, 582); assert.equal(b.data.summary.commission_booked, 18); assert.equal(b.meta.total, 2);
  assert.equal(db.calls[0].shopId, SHOP);
});
test('seller cannot read another shop with shop_id', async () => {
  const { db } = await call(handleSellerLedger, `/api/seller/ledger?shop_id=${SHOP2}`, SELLER);
  assert.equal(db.calls[0].shopId, SHOP);
});
test('seller with no shop gets an empty ledger', async () => {
  const { res, db } = await call(handleSellerLedger, '/api/seller/ledger', NOSHOP);
  assert.equal(res.status, 200); assert.equal((await res.json()).data.entries.length, 0); assert.equal(db.calls.length, 0);
});
test('customers, anonymous and admins are turned away from the seller ledger', async () => {
  assert.equal((await call(handleSellerLedger, '/api/seller/ledger', CUST)).res.status, 403);
  assert.equal((await call(handleSellerLedger, '/api/seller/ledger')).res.status, 401);
  assert.equal((await call(handleSellerLedger, '/api/seller/ledger', ADMIN)).res.status, 403);
});
test('admin ledger: sellers and anonymous are refused', async () => {
  assert.equal((await call(handleAdminLedger, '/api/admin/ledger', SELLER)).res.status, 403);
  assert.equal((await call(handleAdminLedger, '/api/admin/ledger')).res.status, 401);
});
test('admin sees every shop with customer ids, and can narrow by shop and status', async () => {
  const all = await (await call(handleAdminLedger, '/api/admin/ledger', ADMIN)).res.json();
  assert.equal(all.data.entries.length, 4); assert.equal(all.data.entries[0].customer_id, CUST);
  assert.equal(all.data.summary.commission_booked, 36); assert.equal(all.data.summary.refunded, 680);
  const one = await (await call(handleAdminLedger, `/api/admin/ledger?shop_id=${SHOP2}&status=released`, ADMIN)).res.json();
  assert.equal(one.data.entries.length, 1);
});
test('csv download: headers, filename in Dhaka date, rows', async () => {
  const { res } = await call(handleSellerLedger, '/api/seller/ledger?format=csv', SELLER);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="dokan-ledger-2026-11-22.csv"');
  const text = await res.text();
  assert.equal(text.trim().split('\r\n').length, 3);
});
test('date filter is passed to the database as Dhaka day bounds', async () => {
  const { db } = await call(handleAdminLedger, '/api/admin/ledger?from=2026-11-01&to=2026-11-30', ADMIN);
  assert.equal(db.calls[0].startIso, '2026-10-31T18:00:00.000Z'); assert.equal(db.calls[0].endIso, '2026-11-30T18:00:00.000Z');
});
test('bad query gives 400; paging slices the list but not the summary', async () => {
  assert.equal((await call(handleAdminLedger, '/api/admin/ledger?status=pending', ADMIN)).res.status, 400);
  const b = await (await call(handleAdminLedger, '/api/admin/ledger?page=2&limit=3', ADMIN)).res.json();
  assert.equal(b.data.entries.length, 1); assert.equal(b.meta.total, 4); assert.equal(b.data.summary.orders, 4);
});
test('too many rows is refused with 413', async () => {
  makeDbRef.db = { ...makeDb(), listLedgerOrders: async () => Array.from({ length: 10001 }, (_, i) => row(1, SHOP, 'held', { id: id(i + 1) })) };
  const res = await get(handleAdminLedger, '/api/admin/ledger', ADMIN);
  assert.equal(res.status, 413);
});
