import test from 'node:test';
import assert from 'node:assert/strict';
import { handleListProducts, handleGetProduct, handleCreateProduct, handlePatchProduct } from './handlers.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const SELLER = id(1), OTHER = id(2), ADMIN = id(3), CUST = id(4), SHOP = id(20), SHOP2 = id(21), REJ = id(22), PROD = id(30), HID = id(31);

function makeDb(over = {}) {
  const state = {
    users: [
      { id: SELLER, name: 'Nilima', roles: ['seller'] }, { id: OTHER, name: 'Other', roles: ['seller'] },
      { id: ADMIN, name: 'Admin', roles: ['admin'] }, { id: CUST, name: 'Cust', roles: ['customer'] },
    ],
    shops: [
      { id: SHOP, owner_id: SELLER, name: 'Nilima Boutique', city: 'Dhaka', verification_status: 'verified', plan: 'premium', plan_expires_at: null },
      { id: SHOP2, owner_id: OTHER, name: 'Other Shop', verification_status: 'pending', plan: 'free' },
      { id: REJ, owner_id: id(5), name: 'Rejected', verification_status: 'rejected', plan: 'free' },
    ],
    products: [
      { id: PROD, shop_id: SHOP, name: 'Maroon Sari', description: 'nice', custom_category: 'sari', category: 'clothing', gender: 'female', age_group: 'adult', colors: ['maroon'], occasion_tags: ['wedding'], image_urls: [], price: 2800, discount_price: 2500, variants: [{ size: 'free', color: 'maroon', stock: 2 }], status: 'active', created_at: '2026-11-01T00:00:00Z' },
      { id: HID, shop_id: SHOP, name: 'Hidden', description: 'x', custom_category: 'sari', category: 'clothing', gender: 'female', age_group: 'adult', colors: [], occasion_tags: [], image_urls: [], price: 900, discount_price: null, variants: [], status: 'hidden', created_at: '2026-11-01T00:00:00Z' },
    ],
    logs: [],
  };
  const db = {
    state,
    getUser: async (i) => state.users.find((u) => u.id === i) ?? null,
    listActiveProducts: async () => state.products.filter((p) => p.status === 'active'),
    getShopsByIds: async (ids) => state.shops.filter((s) => ids.includes(s.id)),
    getShop: async (i) => state.shops.find((s) => s.id === i) ?? null,
    getShopsByOwner: async (o) => state.shops.filter((s) => s.owner_id === o),
    getProduct: async (i) => state.products.find((p) => p.id === i) ?? null,
    insertProduct: async (row) => { const p = { id: id(100 + state.products.length), created_at: NOW.toISOString(), ...row }; state.products.push(p); return p; },
    updateProduct: async (i, patch) => { const p = state.products.find((x) => x.id === i); if (!p) return null; Object.assign(p, patch); return p; },
    insertSearchLog: async (row) => { state.logs.push(row); },
    ...over,
  };
  return db;
}
const req = (url, { method = 'GET', user, body, headers = {} } = {}) =>
  new Request('http://x' + url, { method, headers: { ...(user ? { 'x-user-id': user } : {}), 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const out = async (res) => { const r = await res; return { status: r.status, body: await r.json() }; };
const newProduct = (o = {}) => ({ name: 'Green Sari', category: 'clothing', gender: 'female', age_group: 'adult', price: 1700, variants: [{ size: 'free', color: 'green', stock: 4 }], colors: ['green'], custom_category: 'sari', occasion_tags: ['wedding'], ...o });

test('search returns products with price_now and shop info, and writes one search log', async () => {
  const db = makeDb();
  const r = await out(await handleListProducts(req('/api/products?q=maroon sari', { user: CUST }), {}, db, { now: NOW }));
  assert.equal(r.status, 200);
  assert.equal(r.body.data.length, 1);
  assert.equal(r.body.data[0].price_now, 2500);
  assert.equal(r.body.data[0].shop.featured, true);
  assert.equal('description' in r.body.data[0], false);
  assert.deepEqual(r.body.meta, { page: 1, limit: 20, total: 1 });
  assert.equal(db.state.logs.length, 1);
  assert.deepEqual(db.state.logs[0], { user_id: CUST, query: 'maroon sari', filters: { custom_category: 'sari', color: 'maroon' }, result_count: 1 });
});
test('an anonymous search is logged without a user; plain browsing is not logged', async () => {
  const db = makeDb();
  await handleListProducts(req('/api/products?color=maroon'), {}, db, { now: NOW });
  assert.equal(db.state.logs[0].user_id, null);
  await handleListProducts(req('/api/products'), {}, db, { now: NOW });
  assert.equal(db.state.logs.length, 1);
});
test('a failing search log never breaks the search', async () => {
  const db = makeDb({ insertSearchLog: async () => { throw new Error('db down'); } });
  const r = await out(await handleListProducts(req('/api/products?q=sari'), {}, db, { now: NOW }));
  assert.equal(r.status, 200);
});
test('a bad query is a 400 and a database failure is a generic 500', async () => {
  assert.equal((await out(await handleListProducts(req('/api/products?gender=alien'), {}, makeDb()))).status, 400);
  const r = await out(await handleListProducts(req('/api/products'), {}, makeDb({ listActiveProducts: async () => { throw new Error('relation "products" secret detail'); } })));
  assert.equal(r.status, 500);
  assert.ok(!JSON.stringify(r.body).includes('secret'));
});

test('get one product includes the description; hidden ones are 404 for strangers, visible to the owner and admin', async () => {
  const db = makeDb();
  const ok = await out(await handleGetProduct(req('/x'), { id: PROD }, db, { now: NOW }));
  assert.equal(ok.body.data.description, 'nice');
  assert.equal((await out(await handleGetProduct(req('/x'), { id: HID }, db))).status, 404);
  assert.equal((await out(await handleGetProduct(req('/x', { user: CUST }), { id: HID }, db))).status, 404);
  assert.equal((await out(await handleGetProduct(req('/x', { user: SELLER }), { id: HID }, db))).status, 200);
  assert.equal((await out(await handleGetProduct(req('/x', { user: ADMIN }), { id: HID }, db))).status, 200);
  assert.equal((await out(await handleGetProduct(req('/x'), { id: 'bad' }, db))).status, 400);
  assert.equal((await out(await handleGetProduct(req('/x'), { id: id(99) }, db))).status, 404);
});

test('a seller creates a product in their only shop (201)', async () => {
  const db = makeDb();
  const r = await out(await handleCreateProduct(req('/api/products', { method: 'POST', user: SELLER, body: newProduct() }), {}, db, { now: NOW }));
  assert.equal(r.status, 201);
  assert.equal(r.body.data.shop_id, SHOP);
  assert.equal(r.body.data.status, 'active');
  assert.equal(db.state.products.length, 3);
});
test('create: not signed in 401, customer 403, shop owned by someone else 403, no shop 409', async () => {
  const db = makeDb();
  const post = (user, body) => out(handleCreateProduct(req('/api/products', { method: 'POST', user, body }), {}, db));
  assert.equal((await post(undefined, newProduct())).status, 401);
  assert.equal((await post(CUST, newProduct())).status, 403);
  assert.equal((await post(SELLER, newProduct({ shop_id: SHOP2 }))).body.error.code, 'not_your_shop');
  db.state.users.push({ id: id(7), name: 'New', roles: ['seller'] });
  assert.equal((await post(id(7), newProduct())).body.error.code, 'no_shop');
});
test('create: a rejected shop cannot add products; bad input and a fake discount are 400', async () => {
  const db = makeDb();
  db.state.users.push({ id: id(5), name: 'Rej', roles: ['seller'] });
  const post = (user, body) => out(handleCreateProduct(req('/api/products', { method: 'POST', user, body }), {}, db));
  assert.equal((await post(id(5), newProduct())).body.error.code, 'shop_rejected');
  assert.equal((await post(SELLER, newProduct({ price: -1 }))).status, 400);
  assert.equal((await post(SELLER, newProduct({ discount_price: 1700 }))).status, 400);
  const notJson = await out(handleCreateProduct(new Request('http://x/api/products', { method: 'POST', headers: { 'x-user-id': SELLER }, body: 'nope' }), {}, db));
  assert.equal(notJson.body.error.code, 'bad_json');
});
test('create: a client cannot set the shop through other fields (shop comes from the owner)', async () => {
  const db = makeDb();
  const r = await out(await handleCreateProduct(req('/api/products', { method: 'POST', user: SELLER, body: newProduct({ id: id(999), created_at: '1999-01-01' }) }), {}, db, { now: NOW }));
  assert.notEqual(r.body.data.id, id(999));
});

test('the owner can patch; price and discount are checked together', async () => {
  const db = makeDb();
  const patch = (user, body, pid = PROD) => out(handlePatchProduct(req('/x', { method: 'PATCH', user, body }), { id: pid }, db, { now: NOW }));
  assert.equal((await patch(SELLER, { price: 3000 })).body.data.price, 3000);
  assert.equal((await patch(SELLER, { discount_price: 3500 })).status, 400);
  assert.equal((await patch(SELLER, { price: 2000 })).status, 400);        // 2000 is not above the stored discount 2500
  assert.equal((await patch(SELLER, { discount_price: null })).body.data.discount_price, null);
  assert.equal((await patch(SELLER, {})).body.error.code, 'nothing_to_update');
});
test('patch: other sellers and customers are refused; not signed in is 401', async () => {
  const db = makeDb();
  const patch = (user, body, pid = PROD) => out(handlePatchProduct(req('/x', { method: 'PATCH', user, body }), { id: pid }, db));
  assert.equal((await patch(OTHER, { price: 1 + 1000 })).body.error.code, 'not_your_product');
  assert.equal((await patch(CUST, { price: 1000 })).status, 403);
  assert.equal((await patch(undefined, { price: 1000 })).status, 401);
  assert.equal((await patch(OTHER, { price: 1000 }, HID)).status, 404);
  assert.equal(db.state.products[0].price, 2800);
});
test('patch: a product cannot be moved to another shop', async () => {
  const db = makeDb();
  const r = await out(await handlePatchProduct(req('/x', { method: 'PATCH', user: SELLER, body: { shop_id: SHOP2, price: 1000 } }), { id: PROD }, db));
  assert.equal(r.body.error.code, 'cannot_move_product');
});
test('patch: an admin may only change the status', async () => {
  const db = makeDb();
  const patch = (body) => out(handlePatchProduct(req('/x', { method: 'PATCH', user: ADMIN, body }), { id: PROD }, db, { now: NOW }));
  assert.equal((await patch({ price: 1 })).body.error.code, 'admin_status_only');
  const r = await patch({ status: 'hidden' });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, 'hidden');
});
test('patch: setting stock to zero everywhere marks the product out of stock', async () => {
  const db = makeDb();
  const r = await out(await handlePatchProduct(req('/x', { method: 'PATCH', user: SELLER, body: { variants: [{ size: 'free', color: 'maroon', stock: 0 }] } }), { id: PROD }, db, { now: NOW }));
  assert.equal(r.body.data.in_stock, false);
});
