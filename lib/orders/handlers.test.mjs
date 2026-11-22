import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCreateOrder, handleListOrders, handleGetOrder, handleUpdateStatus, handlePayOrder, handleAdminRefund, handleReleaseDue } from './handlers.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const CUST = id(1), SELLER = id(2), ADMIN = id(3), STRANGER = id(4), OTHER_SELLER = id(5);
const SHOP = id(20), SHOP2 = id(21), PROD = id(30), PROD2 = id(31), PROD_OTHER = id(32), HID = id(33);
const addr = { name: 'Rina', phone: '01711000000', line1: 'House 4', city: 'Dhaka' };

function makeDb(over = {}) {
  const state = {
    users: [
      { id: CUST, name: 'Rina', roles: ['customer'] }, { id: SELLER, name: 'Nilima', roles: ['seller'] }, { id: ADMIN, name: 'Admin', roles: ['admin'] },
      { id: STRANGER, name: 'Stranger', roles: ['customer'] }, { id: OTHER_SELLER, name: 'Other', roles: ['seller'] },
    ],
    shops: [{ id: SHOP, owner_id: SELLER, name: 'Nilima Boutique', verification_status: 'pending' }, { id: SHOP2, owner_id: OTHER_SELLER, name: 'Other Shop', verification_status: 'verified' }],
    products: [
      { id: PROD, shop_id: SHOP, name: 'Maroon Sari', price: 2800, discount_price: 2500, status: 'active', image_urls: ['https://x.com/a.jpg'], variants: [{ size: 'Free', color: 'maroon', stock: 3 }] },
      { id: PROD2, shop_id: SHOP, name: 'Kurti', price: 450, discount_price: null, status: 'active', image_urls: [], variants: [{ size: 'M', color: 'red', stock: 5 }, { size: 'M', color: 'blue', stock: 5 }] },
      { id: PROD_OTHER, shop_id: SHOP2, name: 'Other Item', price: 900, discount_price: null, status: 'active', image_urls: [], variants: [{ size: 'L', color: '', stock: 1 }] },
      { id: HID, shop_id: SHOP, name: 'Hidden', price: 900, discount_price: null, status: 'hidden', image_urls: [], variants: [{ size: 'L', color: '', stock: 1 }] },
    ],
    orders: [], events: [], released: [], refunded: [], cancelled: [], placeCalls: [],
  };
  let n = 100;
  const db = {
    state,
    getUser: async (i) => state.users.find((u) => u.id === i) ?? null,
    getUsersByIds: async (ids) => state.users.filter((u) => ids.includes(u.id)),
    getShop: async (i) => state.shops.find((s) => s.id === i) ?? null,
    getShopsByIds: async (ids) => state.shops.filter((s) => ids.includes(s.id)),
    getShopsByOwner: async (o) => state.shops.filter((s) => s.owner_id === o),
    getProductsByIds: async (ids) => state.products.filter((p) => ids.includes(p.id)),
    getOrder: async (i) => state.orders.find((o) => o.id === i) ?? null,
    listOrders: async ({ customerId, shopId, status }) => { const rows = state.orders.filter((o) => (!customerId || o.customer_id === customerId) && (!shopId || o.shop_id === shopId) && (!status || o.status === status)); return { rows, total: rows.length }; },
    placeOrder: async (a) => {
      state.placeCalls.push(a);
      const o = { id: id(++n), customer_id: a.customerId, shop_id: a.shopId, items: a.items, item_total: a.itemTotal, delivery_charge: a.deliveryCharge, commission_rate: 0, commission_amount: 0, payment_method: a.method, payment_status: 'pending', status: 'placed', placed_at: NOW.toISOString(), delivered_at: null, delivery_address: a.address };
      state.orders.push(o); return o;
    },
    updateStatus: async (i, from, patch) => { const o = state.orders.find((x) => x.id === i && x.status === from); if (!o) return null; Object.assign(o, patch); return o; },
    cancelOrder: async (i) => { const o = state.orders.find((x) => x.id === i); state.cancelled.push(i); o.status = 'cancelled'; if (o.payment_status === 'held') o.payment_status = 'refunded'; return o; },
    markPaid: async (i, patch) => { const o = state.orders.find((x) => x.id === i && ['pending', 'failed'].includes(x.payment_status)); if (!o) return null; Object.assign(o, patch); return o; },
    markPaymentFailed: async (i) => { const o = state.orders.find((x) => x.id === i); if (o.payment_status === 'pending') o.payment_status = 'failed'; },
    insertEvents: async (rows) => { state.events.push(...rows); },
    releaseOrder: async (i) => { const o = state.orders.find((x) => x.id === i); if (o.payment_status !== 'held') return false; o.payment_status = 'released'; state.released.push(i); return true; },
    releaseDue: async (cutoff) => { state.releasedCutoff = cutoff; return ['a', 'b']; },
    refundOrder: async (i) => { const o = state.orders.find((x) => x.id === i); if (o.payment_status !== 'held') return false; o.payment_status = 'refunded'; return true; },
    ...over,
  };
  return db;
}
const req = (url, { method = 'GET', user, body, headers = {} } = {}) =>
  new Request('http://x' + url, { method, headers: { ...(user ? { 'x-user-id': user } : {}), 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const out = async (p) => { const res = await p; return { status: res.status, body: await res.json() }; };
const create = (db, user, body) => out(handleCreateOrder(req('/api/orders', { method: 'POST', user, body }), {}, db));
const ord = (o = {}) => ({ items: [{ product_id: PROD, size: 'Free', qty: 1 }], delivery_address: addr, ...o });
const pay = (db, user, oid, body) => out(handlePayOrder(req('/x', { method: 'POST', user, body }), { id: oid }, db));
const status = (db, user, oid, to) => out(handleUpdateStatus(req('/x', { method: 'PATCH', user, body: { status: to } }), { id: oid }, db, { now: NOW }));
async function paidOrder(db) { const r = await create(db, CUST, ord()); await pay(db, CUST, r.body.data.id); return r.body.data.id; }

test('placing an order uses the server price (discount applied) and adds delivery', async () => {
  const db = makeDb();
  const r = await create(db, CUST, ord({ items: [{ product_id: PROD, size: 'free', qty: 2 }], unit_price: 1, item_total: 1 }));
  assert.equal(r.status, 201);
  assert.equal(r.body.data.item_total, 5000);
  assert.equal(r.body.data.delivery_charge, 80);
  assert.equal(r.body.data.total, 5080);
  assert.equal(r.body.data.status, 'placed');
  assert.equal(r.body.data.payment_status, 'pending');
  assert.equal('commission_amount' in r.body.data, false);
  assert.equal(db.state.placeCalls[0].items[0].unit_price, 2500);
  assert.equal(db.state.placeCalls[0].items[0].color, 'maroon');
});
test('create: not signed in 401, admin 403, bad body 400', async () => {
  const db = makeDb();
  assert.equal((await create(db, undefined, ord())).status, 401);
  assert.equal((await create(db, ADMIN, ord())).status, 403);
  assert.equal((await create(db, CUST, { items: [] })).status, 400);
  assert.equal((await out(handleCreateOrder(new Request('http://x/api/orders', { method: 'POST', headers: { 'x-user-id': CUST }, body: 'nope' }), {}, db))).body.error.code, 'bad_json');
});
test('create: unknown or hidden product 404, wrong size 409, not enough stock 409, colour needed 400', async () => {
  const db = makeDb();
  assert.equal((await create(db, CUST, ord({ items: [{ product_id: id(99), size: 'M', qty: 1 }] }))).status, 404);
  assert.equal((await create(db, CUST, ord({ items: [{ product_id: HID, size: 'L', qty: 1 }] }))).status, 404);
  assert.equal((await create(db, CUST, ord({ items: [{ product_id: PROD, size: 'XL', qty: 1 }] }))).body.error.code, 'variant_unavailable');
  assert.equal((await create(db, CUST, ord({ items: [{ product_id: PROD, size: 'Free', qty: 4 }] }))).body.error.code, 'out_of_stock');
  assert.equal((await create(db, CUST, ord({ items: [{ product_id: PROD2, size: 'M', qty: 1 }] }))).body.error.code, 'color_required');
  assert.equal((await create(db, CUST, ord({ items: [{ product_id: PROD2, size: 'M', color: 'blue', qty: 1 }] }))).status, 201);
  assert.equal(db.state.orders.length, 1);
});
test('create: items from two shops and your own shop are refused', async () => {
  const db = makeDb();
  assert.equal((await create(db, CUST, ord({ items: [{ product_id: PROD, size: 'Free', qty: 1 }, { product_id: PROD_OTHER, size: 'L', qty: 1 }] }))).body.error.code, 'multiple_shops');
  assert.equal((await create(db, SELLER, ord())).body.error.code, 'own_shop');
  assert.equal((await create(db, OTHER_SELLER, ord())).status, 201);   // a seller may buy from another shop
});
test('create: a stock race lost inside the database is a clean 409', async () => {
  const db = makeDb({ placeOrder: async () => { const e = new Error('out_of_stock'); e.code = 'rpc'; throw e; } });
  assert.equal((await create(db, CUST, ord())).body.error.code, 'out_of_stock');
});

test('paying: success holds the money, fixes the commission and writes a purchase event per product', async () => {
  const db = makeDb();
  const r = await create(db, CUST, ord({ items: [{ product_id: PROD, size: 'Free', qty: 1 }, { product_id: PROD2, size: 'M', color: 'red', qty: 2 }] }));
  const p = await pay(db, CUST, r.body.data.id, { gateway: 'nagad' });
  assert.equal(p.status, 200);
  assert.equal(p.body.data.payment.status, 'success');
  assert.equal(p.body.data.payment.amount, 2500 + 900 + 80);
  assert.equal(p.body.data.order.payment_status, 'held');
  const o = db.state.orders[0];
  assert.equal(o.commission_amount, 125 + 18);        // 5% of 2500 plus 2% of 900
  assert.equal(db.state.events.length, 2);
  assert.deepEqual(db.state.events[0], { user_id: CUST, product_id: PROD, shop_id: SHOP, type: 'purchase' });
});
test('paying twice is refused and writes no second event', async () => {
  const db = makeDb();
  const oid = await paidOrder(db);
  assert.equal((await pay(db, CUST, oid)).body.error.code, 'already_paid');
  assert.equal(db.state.events.length, 1);
});
test('paying: failure is 402 and can be retried; pending changes nothing', async () => {
  const db = makeDb();
  const oid = (await create(db, CUST, ord())).body.data.id;
  const f = await pay(db, CUST, oid, { outcome: 'failure' });
  assert.equal(f.status, 402);
  assert.equal(db.state.orders[0].payment_status, 'failed');
  assert.equal((await pay(db, CUST, oid, { outcome: 'pending' })).status, 202);
  assert.equal(db.state.orders[0].payment_status, 'failed');
  assert.equal((await pay(db, CUST, oid)).status, 200);
  assert.equal(db.state.orders[0].payment_status, 'held');
  assert.equal(db.state.events.length, 1);
});
test('paying: only the customer, valid options, not a cancelled order', async () => {
  const db = makeDb();
  const oid = (await create(db, CUST, ord())).body.data.id;
  assert.equal((await pay(db, STRANGER, oid)).status, 404);
  assert.equal((await pay(db, SELLER, oid)).status, 404);
  assert.equal((await pay(db, undefined, oid)).status, 401);
  assert.equal((await pay(db, CUST, oid, { gateway: 'paypal' })).body.error.code, 'bad_gateway');
  assert.equal((await pay(db, CUST, oid, { outcome: 'maybe' })).body.error.code, 'bad_outcome');
  await status(db, CUST, oid, 'cancelled');
  assert.equal((await pay(db, CUST, oid)).body.error.code, 'order_cancelled');
});
test('paying: cash on delivery charges only the delivery charge online', async () => {
  const db = makeDb();
  const r = await create(db, CUST, ord({ payment_method: 'cod' }));
  assert.equal(r.body.data.amount_due_online, 80);
  const p = await pay(db, CUST, r.body.data.id);
  assert.equal(p.body.data.payment.amount, 80);
  assert.equal(db.state.orders[0].commission_amount, 125);
});
test('a failing purchase-event write never undoes a successful payment', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const db = makeDb({ insertEvents: async () => { throw new Error('boom'); } });
    const r = await create(db, CUST, ord());
    assert.equal((await pay(db, CUST, r.body.data.id)).status, 200);
    assert.equal(db.state.orders[0].payment_status, 'held');
  } finally { console.error = quiet; }
});

test('status: the seller moves a paid order forward; an unpaid one cannot be accepted', async () => {
  const db = makeDb();
  const unpaid = (await create(db, CUST, ord())).body.data.id;
  assert.equal((await status(db, SELLER, unpaid, 'accepted')).body.error.code, 'payment_required');
  const oid = await paidOrder(db);
  for (const to of ['accepted', 'packed', 'shipped', 'delivered']) assert.equal((await status(db, SELLER, oid, to)).status, 200, to);
  const o = db.state.orders.find((x) => x.id === oid);
  assert.equal(o.delivered_at, NOW.toISOString());
  assert.equal(o.payment_status, 'held');                 // a seller marking delivered does not release the money
  assert.equal((await status(db, SELLER, oid, 'accepted')).body.error.code, 'bad_transition');
});
test('status: strangers get 404, other sellers 404, bad status 400, admin may move it', async () => {
  const db = makeDb();
  const oid = await paidOrder(db);
  assert.equal((await status(db, STRANGER, oid, 'accepted')).status, 404);
  assert.equal((await status(db, OTHER_SELLER, oid, 'accepted')).status, 404);
  assert.equal((await status(db, SELLER, oid, 'flying')).status, 400);
  assert.equal((await status(db, undefined, oid, 'accepted')).status, 401);
  assert.equal((await status(db, ADMIN, oid, 'accepted')).status, 200);
});
test('status: the customer confirming delivery releases the money', async () => {
  const db = makeDb();
  const oid = await paidOrder(db);
  for (const to of ['accepted', 'packed', 'shipped']) await status(db, SELLER, oid, to);
  const r = await status(db, CUST, oid, 'delivered');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.payment_status, 'released');
  assert.deepEqual(db.state.released, [oid]);
});
test('status: customer cancel before accept restocks and refunds; after accept it is refused', async () => {
  const db = makeDb();
  const a = await paidOrder(db);
  const r = await status(db, CUST, a, 'cancelled');
  assert.equal(r.body.data.status, 'cancelled');
  assert.equal(r.body.data.payment_status, 'refunded');
  assert.deepEqual(db.state.cancelled, [a]);
  const b = await paidOrder(db);
  await status(db, SELLER, b, 'accepted');
  assert.equal((await status(db, CUST, b, 'cancelled')).body.error.code, 'customer_cannot');
  assert.equal((await status(db, SELLER, b, 'cancelled')).status, 200);   // the seller can still decline later
});
test('status: two quick changes cannot both win', async () => {
  const db = makeDb();
  const oid = await paidOrder(db);
  const racing = makeDb();
  racing.state = db.state;
  const lost = { ...db, updateStatus: async () => null };
  assert.equal((await out(handleUpdateStatus(req('/x', { method: 'PATCH', user: SELLER, body: { status: 'accepted' } }), { id: oid }, lost))).body.error.code, 'status_changed');
});

test('views: the customer never sees commission, the seller sees payout and customer name, strangers get 404', async () => {
  const db = makeDb();
  const oid = await paidOrder(db);
  const get = (user) => out(handleGetOrder(req('/x', { user }), { id: oid }, db));
  const c = await get(CUST);
  assert.equal(c.body.data.my_role, 'customer');
  assert.ok(!JSON.stringify(c.body).includes('commission'));
  const s = await get(SELLER);
  assert.equal(s.body.data.my_role, 'seller');
  assert.equal(s.body.data.commission_amount, 125);
  assert.equal(s.body.data.seller_payout, 2375);
  assert.equal(s.body.data.customer.name, 'Rina');
  assert.equal((await get(ADMIN)).body.data.my_role, 'admin');
  assert.equal((await get(STRANGER)).status, 404);
  assert.equal((await get(OTHER_SELLER)).status, 404);
  assert.equal((await get(undefined)).status, 401);
  assert.equal((await out(handleGetOrder(req('/x', { user: CUST }), { id: 'bad' }, db))).status, 400);
});
test('lists: customers see their own, sellers their shop, admins all, and roles are enforced', async () => {
  const db = makeDb();
  await paidOrder(db);
  const list = (user, qs = '') => out(handleListOrders(req('/api/orders' + qs, { user }), {}, db));
  assert.equal((await list(CUST)).body.data.length, 1);
  assert.equal((await list(STRANGER)).body.data.length, 0);
  assert.equal((await list(SELLER, '?as=seller')).body.data.length, 1);
  assert.equal((await list(OTHER_SELLER, '?as=seller')).body.data.length, 0);
  assert.equal((await list(CUST, '?as=seller')).status, 403);
  assert.equal((await list(SELLER, '?as=admin')).status, 403);
  assert.equal((await list(ADMIN, '?as=admin')).body.meta.total, 1);
  assert.equal((await list(CUST, '?as=boss')).status, 400);
  assert.equal((await list(undefined)).status, 401);
});

test('admin refund works only for held money and only for admins', async () => {
  const db = makeDb();
  const oid = await paidOrder(db);
  const refund = (user) => out(handleAdminRefund(req('/x', { method: 'POST', user }), { id: oid }, db));
  assert.equal((await refund(SELLER)).status, 403);
  assert.equal((await refund(CUST)).status, 403);
  const r = await refund(ADMIN);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.payment_status, 'refunded');
  assert.equal((await refund(ADMIN)).body.error.code, 'not_refundable');
});
test('releasing due payouts asks for orders delivered 48 hours ago or earlier', async () => {
  const db = makeDb();
  const rel = (user) => out(handleReleaseDue(req('/x', { method: 'POST', user }), {}, db, { now: NOW }));
  assert.equal((await rel(SELLER)).status, 403);
  assert.equal((await rel(undefined)).status, 401);
  const r = await rel(ADMIN);
  assert.deepEqual(r.body.data, { released: 2, order_ids: ['a', 'b'] });
  assert.equal(db.state.releasedCutoff, '2026-11-20T12:00:00.000Z');
});
test('a database failure is a generic 500', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const r = await create(makeDb({ getProductsByIds: async () => { throw new Error('relation secret'); } }), CUST, ord());
    assert.equal(r.status, 500);
    assert.ok(!JSON.stringify(r.body).includes('secret'));
  } finally { console.error = quiet; }
});
