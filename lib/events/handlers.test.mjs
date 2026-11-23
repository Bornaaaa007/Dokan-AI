import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRecordEvent } from './handlers.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const OWNER = id(1), CUST = id(2), SHOP = id(20), REJ = id(21), PROD = id(30), HID = id(31), RPROD = id(32);

function makeDb(over = {}) {
  const state = {
    events: [],
    users: [{ id: OWNER, roles: ['seller'] }, { id: CUST, roles: ['customer'] }],
    shops: [{ id: SHOP, owner_id: OWNER, verification_status: 'pending' }, { id: REJ, owner_id: id(5), verification_status: 'rejected' }],
    products: [{ id: PROD, shop_id: SHOP, status: 'active' }, { id: HID, shop_id: SHOP, status: 'hidden' }, { id: RPROD, shop_id: REJ, status: 'active' }],
  };
  return {
    state,
    getUser: async (i) => state.users.find((u) => u.id === i) ?? null,
    getProduct: async (i) => state.products.find((p) => p.id === i) ?? null,
    getShop: async (i) => state.shops.find((s) => s.id === i) ?? null,
    hasRecentEvent: async (u, p, t, since) => state.events.some((e) => e.user_id === u && e.product_id === p && e.type === t && e.at >= since),
    insertEvent: async (row) => { state.events.push({ ...row, at: NOW.toISOString() }); },
    ...over,
  };
}
const post = (db, body, { user, headers = {} } = {}, now = NOW) =>
  handleRecordEvent(new Request('http://x/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user-id': user } : {}), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), {}, db, { now });
const out = async (res) => ({ status: res.status, body: await res.json() });

test('an anonymous view is recorded with the shop taken from the product', async () => {
  const db = makeDb();
  const r = await out(await post(db, { type: 'view', product_id: PROD, shop_id: id(999), user_id: CUST }));
  assert.equal(r.status, 201);
  assert.deepEqual(db.state.events[0], { user_id: null, product_id: PROD, shop_id: SHOP, type: 'view', at: NOW.toISOString() });
});
test('a signed-in customer is recorded with their id; add_to_cart works', async () => {
  const db = makeDb();
  assert.equal((await post(db, { type: 'add_to_cart', product_id: PROD }, { user: CUST })).status, 201);
  assert.equal(db.state.events[0].user_id, CUST);
  assert.equal(db.state.events[0].type, 'add_to_cart');
});
test('purchase and other types are refused', async () => {
  const db = makeDb();
  for (const type of ['purchase', 'click', '', undefined, 5]) assert.equal((await post(db, { type, product_id: PROD })).status, 400);
  assert.equal(db.state.events.length, 0);
});
test('bad bodies and ids are 400', async () => {
  const db = makeDb();
  assert.equal((await out(await post(db, 'nope'))).body.error.code, 'bad_json');
  assert.equal((await out(await post(db, [1]))).body.error.code, 'bad_json');
  assert.equal((await out(await post(db, { type: 'view', product_id: 'abc' }))).body.error.code, 'bad_product_id');
  assert.equal((await out(await post(db, { type: 'view' }))).body.error.code, 'bad_product_id');
});
test('unknown, hidden and rejected-shop products are 404', async () => {
  const db = makeDb();
  for (const pid of [id(99), HID, RPROD]) assert.equal((await post(db, { type: 'view', product_id: pid })).status, 404);
  assert.equal(db.state.events.length, 0);
});
test('the shop owner viewing their own product is not counted', async () => {
  const db = makeDb();
  const r = await out(await post(db, { type: 'view', product_id: PROD }, { user: OWNER }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data, { recorded: false, reason: 'own_product' });
  assert.equal(db.state.events.length, 0);
});
test('a signed-in repeat inside 30 seconds is counted once', async () => {
  const db = makeDb();
  await post(db, { type: 'view', product_id: PROD }, { user: CUST });
  const r = await out(await post(db, { type: 'view', product_id: PROD }, { user: CUST }));
  assert.deepEqual(r.body.data, { recorded: false, reason: 'duplicate' });
  assert.equal(db.state.events.length, 1);
  // a different type for the same product is a different event
  assert.equal((await post(db, { type: 'add_to_cart', product_id: PROD }, { user: CUST })).status, 201);
});
test('a bad bearer token is 401 and never recorded as anonymous', async () => {
  const db = makeDb({ getUserByToken: async () => null });
  const r = await out(await post(db, { type: 'view', product_id: PROD }, { headers: { authorization: 'Bearer nope' } }));
  assert.equal(r.status, 401);
  assert.equal(db.state.events.length, 0);
});
test('a database failure is a generic 500', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const r = await out(await post(makeDb({ insertEvent: async () => { throw new Error('secret detail'); } }), { type: 'view', product_id: PROD }));
    assert.equal(r.status, 500);
    assert.ok(!JSON.stringify(r.body).includes('secret'));
  } finally { console.error = quiet; }
});
