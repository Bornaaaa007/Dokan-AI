import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMessageUpdate } from './messageUpdate.mjs';
import { cleanExtraction } from './parseSellerMessage.mjs';

const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const SELLER = id(1), OTHER = id(2), CUST = id(4), SHOP = id(20), SHOP2 = id(21);
const v = (size, stock) => ({ size, color: '', stock });
const MY = { id: id(30), shop_id: SHOP, name: 'Red Katan Sari', custom_category: 'sari', colors: ['red'], price: 2800, discount_price: null, variants: [v('M', 5), v('L', 2)], status: 'active' };
const THEIRS = { id: id(31), shop_id: SHOP2, name: 'Blue Denim Jacket', custom_category: 'jacket', colors: ['blue'], price: 3000, discount_price: null, variants: [v('M', 5)], status: 'active' };

const db = {
  getUser: async (i) => ({ [SELLER]: { id: SELLER, roles: ['seller'] }, [OTHER]: { id: OTHER, roles: ['seller'] }, [CUST]: { id: CUST, roles: ['customer'] } })[i] ?? null,
  getShopsByOwner: async (o) => [{ id: SHOP, owner_id: SELLER, verification_status: 'verified' }, { id: SHOP2, owner_id: OTHER, verification_status: 'verified' }].filter((s) => s.owner_id === o),
  listProductsByShop: async (s) => [MY, THEIRS].filter((p) => p.shop_id === s),
};
const req = (user, body) => new Request('http://x/api/seller/message-update', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user-id': user } : {}) }, body: JSON.stringify(body) });
const out = async (res) => { const r = await res; return { status: r.status, body: await r.json() }; };
const fakeExtract = (items) => async () => cleanExtraction({ items });
const ITEM = { source_text: 'x', product_name: 'Red katan sari', price: 2400, sizes: [{ size: 'M', stock: 3 }], only_these_sizes: false, sold_out: false };

test('a seller gets the contract shape for their own product', async () => {
  const r = await out(handleMessageUpdate(req(SELLER, { text: 'Red katan sari now 2400, M 3 left' }), {}, db, { extract: fakeExtract([ITEM]) }));
  assert.equal(r.status, 200);
  assert.equal(r.body.updates[0].product_id, MY.id);
  assert.equal(r.body.updates[0].changes.price, 2400);
  assert.deepEqual(r.body.unmatched, []);
  assert.ok(Array.isArray(r.body.warnings));
});

test('another shop\'s product is never matched', async () => {
  const r = await out(handleMessageUpdate(req(SELLER, { text: 'denim jacket 999' }), {}, db, { extract: fakeExtract([{ ...ITEM, product_name: 'Blue Denim Jacket', source_text: 'denim jacket' }]) }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.updates, []);
  assert.deepEqual(r.body.unmatched, ['denim jacket']);
});

test('not signed in is 401, a customer is 403, bad bodies are 400', async () => {
  const f = { extract: fakeExtract([ITEM]) };
  assert.equal((await out(handleMessageUpdate(req(null, { text: 'a' }), {}, db, f))).status, 401);
  assert.equal((await out(handleMessageUpdate(req(CUST, { text: 'a' }), {}, db, f))).status, 403);
  assert.equal((await out(handleMessageUpdate(req(SELLER, {}), {}, db, f))).status, 400);
  assert.equal((await out(handleMessageUpdate(req(SELLER, { text: '   ' }), {}, db, f))).status, 400);
  assert.equal((await out(handleMessageUpdate(req(SELLER, { text: 'a'.repeat(2001) }), {}, db, f))).status, 400);
});

test('when the AI fails the seller gets a friendly 503 with no internal detail', async () => {
  const r = await out(handleMessageUpdate(req(SELLER, { text: 'hi' }), {}, db, { extract: async () => { throw new Error('secret key abc'); } }));
  assert.equal(r.status, 503);
  assert.ok(!JSON.stringify(r.body).includes('secret'));
});

test('selections from the client are validated and applied', async () => {
  const r = await out(handleMessageUpdate(req(SELLER, { text: 'sari 2000', selections: { 0: MY.id, x: 'bad' } }), {}, db, { extract: fakeExtract([{ ...ITEM, product_name: 'sari', sizes: [], price: 2000 }]) }));
  assert.equal(r.body.updates[0].product_id, MY.id);
});
