import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './rules.mjs';
import { handleListProductReviews, handleMyProductReview, handleCreateProductReview, handleAdminListProductReviews, handleAdminSetProductReviewStatus } from './handlers.mjs';

const NOW = new Date('2026-11-23T12:00:00Z');
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const CUST = id(1), OTHER = id(2), ADMIN = id(3);
const P1 = id(11), P2 = id(12), GHOST = id(19);
const O_DELIVERED = id(21), O_SHIPPED = id(22), O_OTHERS = id(23), O_P2 = id(24), O_REFUNDED = id(25);

function makeDb() {
  const state = {
    users: [
      { id: CUST, name: 'Nusrat Jahan', roles: ['customer'] },
      { id: OTHER, name: 'Rafi', roles: ['customer'] },
      { id: ADMIN, name: 'Test Admin', roles: ['admin'] },
    ],
    products: [{ id: P1, name: 'Maroon Katan Sari' }, { id: P2, name: 'Leather Oxford' }],
    orders: [
      { id: O_DELIVERED, customer_id: CUST, status: 'delivered', items: [{ product_id: P1 }] },
      { id: O_SHIPPED, customer_id: CUST, status: 'shipped', items: [{ product_id: P1 }] },
      { id: O_OTHERS, customer_id: OTHER, status: 'delivered', items: [{ product_id: P1 }] },
      { id: O_P2, customer_id: CUST, status: 'delivered', items: [{ product_id: P2 }] },
      { id: O_REFUNDED, customer_id: CUST, status: 'delivered', payment_status: 'refunded', items: [{ product_id: P1 }] },
    ],
    reviews: [],
  };
  let n = 100;
  return {
    state,
    getUser: async (i) => state.users.find((u) => u.id === i) ?? null,
    getUsersByIds: async (ids) => state.users.filter((u) => ids.includes(u.id)),
    getProduct: async (i) => state.products.find((p) => p.id === i) ?? null,
    getProductsByIds: async (ids) => state.products.filter((p) => ids.includes(p.id)),
    getOrder: async (i) => state.orders.find((o) => o.id === i) ?? null,
    listDeliveredOrdersWith: async (u, p) => state.orders.filter((o) => o.customer_id === u && o.status === 'delivered' && o.payment_status !== 'refunded' && o.items.some((x) => x.product_id === p)),
    getReviewFor: async (o, p) => state.reviews.find((r) => r.order_id === o && r.product_id === p) ?? null,
    listMyReviews: async (u, p) => state.reviews.filter((r) => r.user_id === u && r.product_id === p),
    getReview: async (i) => state.reviews.find((r) => r.id === i) ?? null,
    insertReview: async (row) => { const r = { id: id(++n), created_at: '2026-11-23T09:00:00Z', decided_at: null, ...row }; state.reviews.push(r); return r; },
    listForProduct: async (p, st, limit) => state.reviews.filter((r) => r.product_id === p && r.status === st).slice(0, limit),
    ratingSummary: async (p) => summarize(state.reviews.filter((r) => r.product_id === p && r.status === 'visible').map((r) => r.rating)),
    countRecentReviews: async (u, since) => state.reviews.filter((r) => r.user_id === u && r.created_at >= since).length,
    listByStatus: async (st, limit) => state.reviews.filter((r) => r.status === st).slice(0, limit),
    setStatus: async (i, status, adminId, at) => { const r = state.reviews.find((x) => x.id === i); if (!r) return null; Object.assign(r, { status, decided_by: adminId, decided_at: at }); return r; },
  };
}
const req = (method, url, { user, body } = {}) => new Request('http://x' + url, {
  method,
  headers: { 'content-type': 'application/json', ...(user ? { 'x-user-id': user } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const read = async (res) => ({ status: res.status, body: await res.json() });
const GOOD = (order_id = O_DELIVERED) => ({ order_id, rating: 5, body: 'Lovely fabric, arrived exactly as pictured.' });
const create = (db, user, body, pid = P1) => handleCreateProductReview(req('POST', `/api/products/${pid}/reviews`, { user, body }), { id: pid }, db);

test('creating needs sign-in', async () => {
  const db = makeDb();
  assert.equal((await read(await create(db, undefined, GOOD()))).status, 401);
});
test('a customer with a delivered order creates a visible review', async () => {
  const db = makeDb();
  const r = await read(await create(db, CUST, GOOD()));
  assert.equal(r.status, 201);
  assert.equal(r.body.data.review.status, 'visible');
  assert.equal(db.state.reviews[0].user_id, CUST);
  assert.equal(db.state.reviews[0].product_id, P1);
});
test('invalid reviews and bad ids are refused', async () => {
  const db = makeDb();
  const bad = await read(await create(db, CUST, { order_id: O_DELIVERED, rating: 9, body: 'long enough text here' }));
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'invalid_review');
  assert.equal((await read(await create(db, CUST, GOOD(), 'nope'))).status, 400);
  assert.equal(db.state.reviews.length, 0);
});
test('unknown product gives 404', async () => {
  const db = makeDb();
  const r = await read(await create(db, CUST, GOOD(), GHOST));
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'product_not_found');
});
test('an order that is not delivered cannot be reviewed', async () => {
  const db = makeDb();
  const r = await read(await create(db, CUST, GOOD(O_SHIPPED)));
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'not_delivered');
  assert.equal(db.state.reviews.length, 0);
});
test("someone else's order, an unknown order, or a different product are all refused", async () => {
  const db = makeDb();
  assert.equal((await read(await create(db, CUST, GOOD(O_OTHERS)))).body.error.code, 'not_eligible');
  assert.equal((await read(await create(db, CUST, GOOD(id(999))))).body.error.code, 'not_eligible');
  assert.equal((await read(await create(db, CUST, GOOD(O_P2), P1))).body.error.code, 'not_eligible');
  assert.equal(db.state.reviews.length, 0);
});
test('one review per product per order', async () => {
  const db = makeDb();
  await create(db, CUST, GOOD());
  const r = await read(await create(db, CUST, GOOD()));
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'already_reviewed');
});
test('a duplicate caught by the database also gives 409', async () => {
  const db = makeDb();
  db.insertReview = async () => { const e = new Error('duplicate'); e.code = 'duplicate'; throw e; };
  assert.equal((await read(await create(db, CUST, GOOD()))).status, 409);
});
test('the same customer can review a different product from another order', async () => {
  const db = makeDb();
  await create(db, CUST, GOOD());
  assert.equal((await read(await create(db, CUST, GOOD(O_P2), P2))).status, 201);
});
test('mine: needs sign-in; shows the order that can be reviewed, then the review', async () => {
  const db = makeDb();
  const mine = (user) => handleMyProductReview(req('GET', `/api/products/${P1}/reviews/mine`, { user }), { id: P1 }, db);
  assert.equal((await read(await mine(undefined))).status, 401);
  let r = await read(await mine(CUST));
  assert.equal(r.body.data.eligible_order_id, O_DELIVERED);
  assert.equal(r.body.data.review, null);
  await create(db, CUST, GOOD());
  r = await read(await mine(CUST));
  assert.equal(r.body.data.eligible_order_id, null);
  assert.equal(r.body.data.review.rating, 5);
  r = await read(await mine(ADMIN));
  assert.equal(r.body.data.eligible_order_id, null);
  assert.equal(r.body.data.review, null);
});
test('public list: open to anyone, visible only, safe name, summary, no user id', async () => {
  const db = makeDb();
  await create(db, CUST, GOOD());
  await create(db, OTHER, { order_id: O_OTHERS, rating: 3, body: 'Colour was a little lighter in person.' });
  const list = async () => read(await handleListProductReviews(req('GET', `/api/products/${P1}/reviews`), { id: P1 }, db));
  let r = await list();
  assert.equal(r.status, 200);
  assert.equal(r.body.data.reviews.length, 2);
  assert.equal(r.body.data.summary.count, 2);
  assert.equal(r.body.data.summary.average, 4);
  assert.ok(r.body.data.reviews.some((x) => x.name === 'Nusrat J.'));
  assert.equal('user_id' in r.body.data.reviews[0], false);
  assert.equal(r.body.data.reviews[0].verified_purchase, true);
  await handleAdminSetProductReviewStatus(req('PATCH', '/x', { user: ADMIN, body: { status: 'hidden' } }), { id: db.state.reviews[1].id }, db, { now: NOW });
  r = await list();
  assert.equal(r.body.data.reviews.length, 1);
  assert.equal(r.body.data.summary.count, 1);
  assert.equal(r.body.data.summary.average, 5);
});
test('public list is scoped to one product and 404s for an unknown one', async () => {
  const db = makeDb();
  await create(db, CUST, GOOD());
  const other = await read(await handleListProductReviews(req('GET', `/api/products/${P2}/reviews`), { id: P2 }, db));
  assert.equal(other.body.data.reviews.length, 0);
  assert.deepEqual(other.body.data.summary, { count: 0, average: null });
  assert.equal((await read(await handleListProductReviews(req('GET', `/api/products/${GHOST}/reviews`), { id: GHOST }, db))).status, 404);
  assert.equal((await read(await handleListProductReviews(req('GET', '/api/products/x/reviews?limit=9999'), { id: 'x' }, db))).status, 400);
});
test('admin list and decisions are admin-only', async () => {
  const db = makeDb();
  await create(db, CUST, GOOD());
  const rid = db.state.reviews[0].id;
  const list = (user, q = '') => handleAdminListProductReviews(req('GET', '/api/admin/product-reviews' + q, { user }), db);
  assert.equal((await read(await list(undefined))).status, 401);
  assert.equal((await read(await list(CUST))).status, 403);
  assert.equal((await read(await handleAdminSetProductReviewStatus(req('PATCH', '/x', { user: CUST, body: { status: 'hidden' } }), { id: rid }, db))).status, 403);
  assert.equal(db.state.reviews[0].status, 'visible');
  const ok = await read(await list(ADMIN, '?status=visible'));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.reviews[0].product_name, 'Maroon Katan Sari');
  assert.equal(ok.body.data.reviews[0].name, 'Nusrat Jahan');
  assert.equal((await read(await list(ADMIN, '?status=weird'))).status, 400);
});
test('admin can hide, then show again, and the record shows who decided', async () => {
  const db = makeDb();
  await create(db, CUST, GOOD());
  const rid = db.state.reviews[0].id;
  const set = (status, pid = rid, user = ADMIN) => handleAdminSetProductReviewStatus(req('PATCH', '/x', { user, body: { status } }), { id: pid }, db, { now: NOW });
  assert.equal((await read(await set('hidden'))).status, 200);
  assert.equal(db.state.reviews[0].status, 'hidden');
  assert.equal(db.state.reviews[0].decided_by, ADMIN);
  assert.equal(db.state.reviews[0].decided_at, NOW.toISOString());
  assert.equal((await read(await set('visible'))).status, 200);
  assert.equal(db.state.reviews[0].status, 'visible');
  assert.equal((await read(await set('pending'))).status, 400);
  assert.equal((await read(await set('hidden', 'nope'))).status, 400);
  assert.equal((await read(await set('hidden', id(999)))).status, 404);
});

test('a refunded order cannot be reviewed', async () => {
  const db = makeDb();
  const r = await read(await create(db, CUST, GOOD(O_REFUNDED)));
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'order_refunded');
  assert.equal(db.state.reviews.length, 0);
});
test('mine: a refunded order is not offered for review', async () => {
  const db = makeDb();
  db.state.orders = db.state.orders.filter((o) => o.id === O_REFUNDED);
  const r = await read(await handleMyProductReview(req('GET', `/api/products/${P1}/reviews/mine`, { user: CUST }), { id: P1 }, db));
  assert.equal(r.body.data.eligible_order_id, null);
});
test('rate limit: at most 10 reviews per 24 hours', async () => {
  const db = makeDb();
  for (let i = 0; i < 10; i++) db.state.reviews.push({ id: id(500 + i), product_id: P2, order_id: id(600 + i), user_id: CUST, rating: 4, body: 'x'.repeat(12), status: 'visible', created_at: '2026-11-23T10:00:00Z' });
  const res = await handleCreateProductReview(req('POST', `/api/products/${P1}/reviews`, { user: CUST, body: GOOD() }), { id: P1 }, db, { now: NOW });
  const r = await read(res);
  assert.equal(r.status, 429);
  assert.equal(r.body.error.code, 'too_many_reviews');
});
test('rate limit: reviews older than 24 hours do not count', async () => {
  const db = makeDb();
  for (let i = 0; i < 10; i++) db.state.reviews.push({ id: id(500 + i), product_id: P2, order_id: id(600 + i), user_id: CUST, rating: 4, body: 'x'.repeat(12), status: 'visible', created_at: '2026-11-20T10:00:00Z' });
  const res = await handleCreateProductReview(req('POST', `/api/products/${P1}/reviews`, { user: CUST, body: GOOD() }), { id: P1 }, db, { now: NOW });
  assert.equal(res.status, 201);
});
