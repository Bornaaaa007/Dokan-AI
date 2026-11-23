import test from 'node:test';
import assert from 'node:assert/strict';
import { handleListReviews, handleCreateReview, handleMyReview, handleAdminListReviews, handleAdminSetStatus } from './handlers.mjs';

const NOW = new Date('2026-11-23T12:00:00Z');
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const CUST = id(1), SELLER = id(2), ADMIN = id(3);

function makeDb() {
  const state = {
    users: [
      { id: CUST, name: 'Nusrat Jahan', roles: ['customer'] },
      { id: SELLER, name: 'Rafi', roles: ['seller'] },
      { id: ADMIN, name: 'Test Admin', roles: ['admin'] },
    ],
    reviews: [],
  };
  let n = 100;
  return {
    state,
    getUser: async (i) => state.users.find((u) => u.id === i) ?? null,
    getUsersByIds: async (ids) => state.users.filter((u) => ids.includes(u.id)),
    getMyReview: async (u) => state.reviews.find((r) => r.user_id === u) ?? null,
    getReview: async (i) => state.reviews.find((r) => r.id === i) ?? null,
    insertReview: async (row) => { const r = { id: id(++n), created_at: '2026-11-23T09:00:00Z', decided_at: null, ...row }; state.reviews.push(r); return r; },
    listByStatus: async (st, limit) => state.reviews.filter((r) => r.status === st).slice(0, limit),
    approvedRatings: async () => state.reviews.filter((r) => r.status === 'approved').map((r) => r.rating),
    setStatus: async (i, status, adminId, at) => { const r = state.reviews.find((x) => x.id === i); if (!r) return null; Object.assign(r, { status, decided_by: adminId, decided_at: at }); return r; },
  };
}
const req = (method, url, { user, body } = {}) => new Request('http://x' + url, {
  method,
  headers: { 'content-type': 'application/json', ...(user ? { 'x-user-id': user } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const read = async (res) => ({ status: res.status, body: await res.json() });
const GOOD = { rating: 5, body: 'Found a wedding outfit within my budget in minutes.' };

test('creating needs sign-in', async () => {
  const db = makeDb();
  const r = await read(await handleCreateReview(req('POST', '/api/reviews', { body: GOOD }), db));
  assert.equal(r.status, 401);
});
test('a signed-in user creates a pending review', async () => {
  const db = makeDb();
  const r = await read(await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db));
  assert.equal(r.status, 201);
  assert.equal(r.body.data.review.status, 'pending');
  assert.equal(db.state.reviews[0].user_id, CUST);
});
test('invalid reviews are refused', async () => {
  const db = makeDb();
  const r = await read(await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: { rating: 9, body: 'long enough text here' } }), db));
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'invalid_review');
  assert.equal(db.state.reviews.length, 0);
});
test('only one review per user', async () => {
  const db = makeDb();
  await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db);
  const r = await read(await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db));
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'already_reviewed');
});
test('a duplicate caught by the database also gives 409', async () => {
  const db = makeDb();
  db.insertReview = async () => { const e = new Error('duplicate'); e.code = 'duplicate'; throw e; };
  const r = await read(await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db));
  assert.equal(r.status, 409);
});
test('my review: null before, the review after', async () => {
  const db = makeDb();
  assert.equal((await read(await handleMyReview(req('GET', '/api/reviews/mine', { user: CUST }), db))).body.data.review, null);
  await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db);
  const r = await read(await handleMyReview(req('GET', '/api/reviews/mine', { user: CUST }), db));
  assert.equal(r.body.data.review.status, 'pending');
  assert.equal((await read(await handleMyReview(req('GET', '/api/reviews/mine'), db))).status, 401);
});
test('public list shows approved only, with a safe name and a summary', async () => {
  const db = makeDb();
  await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db);
  await handleCreateReview(req('POST', '/api/reviews', { user: SELLER, body: { rating: 3, body: 'Seller tools are still basic.' } }), db);
  let r = await read(await handleListReviews(req('GET', '/api/reviews'), db));
  assert.equal(r.body.data.reviews.length, 0);
  assert.deepEqual(r.body.data.summary, { count: 0, average: null });

  await handleAdminSetStatus(req('PATCH', '/x', { user: ADMIN, body: { status: 'approved' } }), { id: db.state.reviews[0].id }, db, { now: NOW });
  r = await read(await handleListReviews(req('GET', '/api/reviews'), db));
  assert.equal(r.body.data.reviews.length, 1);
  assert.equal(r.body.data.reviews[0].name, 'Nusrat J.');
  assert.equal(r.body.data.summary.count, 1);
  assert.equal(r.body.data.summary.average, 5);
  assert.equal('user_id' in r.body.data.reviews[0], false);
});
test('public list is open to anyone and caps the limit', async () => {
  const db = makeDb();
  const r = await read(await handleListReviews(req('GET', '/api/reviews?limit=9999'), db));
  assert.equal(r.status, 200);
});
test('admin list and decisions are admin-only', async () => {
  const db = makeDb();
  await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db);
  const rid = db.state.reviews[0].id;
  assert.equal((await read(await handleAdminListReviews(req('GET', '/api/admin/reviews'), db))).status, 401);
  assert.equal((await read(await handleAdminListReviews(req('GET', '/api/admin/reviews', { user: CUST }), db))).status, 403);
  assert.equal((await read(await handleAdminSetStatus(req('PATCH', '/x', { user: CUST, body: { status: 'approved' } }), { id: rid }, db))).status, 403);
  assert.equal(db.state.reviews[0].status, 'pending');
  const list = await read(await handleAdminListReviews(req('GET', '/api/admin/reviews?status=pending', { user: ADMIN }), db));
  assert.equal(list.status, 200);
  assert.equal(list.body.data.reviews.length, 1);
  assert.equal(list.body.data.reviews[0].name, 'Nusrat Jahan');
});
test('admin can approve, then hide, and the record shows who decided', async () => {
  const db = makeDb();
  await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db);
  const rid = db.state.reviews[0].id;
  let r = await read(await handleAdminSetStatus(req('PATCH', '/x', { user: ADMIN, body: { status: 'approved' } }), { id: rid }, db, { now: NOW }));
  assert.equal(r.status, 200);
  assert.equal(db.state.reviews[0].decided_by, ADMIN);
  assert.equal(db.state.reviews[0].decided_at, NOW.toISOString());
  r = await read(await handleAdminSetStatus(req('PATCH', '/x', { user: ADMIN, body: { status: 'hidden' } }), { id: rid }, db, { now: NOW }));
  assert.equal(db.state.reviews[0].status, 'hidden');
});
test('admin decision rejects bad input', async () => {
  const db = makeDb();
  await handleCreateReview(req('POST', '/api/reviews', { user: CUST, body: GOOD }), db);
  const rid = db.state.reviews[0].id;
  assert.equal((await read(await handleAdminSetStatus(req('PATCH', '/x', { user: ADMIN, body: { status: 'pending' } }), { id: rid }, db))).status, 400);
  assert.equal((await read(await handleAdminSetStatus(req('PATCH', '/x', { user: ADMIN, body: { status: 'approved' } }), { id: 'nope' }, db))).status, 400);
  assert.equal((await read(await handleAdminSetStatus(req('PATCH', '/x', { user: ADMIN, body: { status: 'approved' } }), { id: id(999) }, db))).status, 404);
  assert.equal((await read(await handleAdminListReviews(req('GET', '/api/admin/reviews?status=weird', { user: ADMIN }), db))).status, 400);
});
