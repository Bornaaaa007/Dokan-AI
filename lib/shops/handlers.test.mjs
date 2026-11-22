import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleCreateShop, handleMyShop, handleGetShop, handlePatchShop, handleBuyPremium, handleAdminListShops, handleVerifyShop, toShopView,
} from './handlers.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const CUST = id(1), SELLER = id(2), OTHER = id(3), ADMIN = id(4), SHOP = id(20);

function makeDb() {
  const state = {
    users: [
      { id: CUST, name: 'Cust', roles: ['customer'], email: 'cust@x.com' }, { id: SELLER, name: 'Nilima', roles: ['seller'], email: 'nilima@x.com' },
      { id: OTHER, name: 'Other', roles: ['seller'], email: null }, { id: ADMIN, name: 'Admin', roles: ['admin'], email: 'a@x.com' },
    ],
    shops: [{ id: SHOP, owner_id: SELLER, name: 'Nilima Boutique', description: null, city: 'Dhaka', social_url: null, nid_number: '1234567890', verification_status: 'pending', plan: 'free', plan_expires_at: null, return_policy: null, rejection_note: null, created_at: '2026-11-01T00:00:00Z' }],
  };
  return {
    state,
    getUser: async (i) => { const u = state.users.find((x) => x.id === i); return u ? { id: u.id, name: u.name, roles: u.roles } : null; },
    getUserEmail: async (i) => state.users.find((x) => x.id === i)?.email ?? null,
    addRole: async (i, r) => { const u = state.users.find((x) => x.id === i); if (!u.roles.includes(r)) u.roles.push(r); return u.roles; },
    getShop: async (i) => state.shops.find((s) => s.id === i) ?? null,
    getShopsByOwner: async (o) => state.shops.filter((s) => s.owner_id === o),
    insertShop: async (row) => { const s = { id: id(50 + state.shops.length), created_at: NOW.toISOString(), rejection_note: null, ...row }; state.shops.push(s); return s; },
    updateShop: async (i, patch) => { const s = state.shops.find((x) => x.id === i); if (!s) return null; Object.assign(s, patch); return s; },
    listShopsByStatus: async (st, page, limit) => { const rows = state.shops.filter((s) => s.verification_status === st); return { rows: rows.slice((page - 1) * limit, page * limit), total: rows.length }; },
  };
}
const req = (url, { method = 'GET', user, body } = {}) =>
  new Request('http://x' + url, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user-id': user } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const out = async (res) => { const r = await res; return { status: r.status, body: await r.json() }; };

test('a customer creates a shop: they become a seller, the shop starts pending, the NID is not echoed', async () => {
  const db = makeDb();
  const r = await out(handleCreateShop(req('/api/shops', { method: 'POST', user: CUST, body: { name: 'Rupa Fashion', city: 'Comilla', nid_number: '1234567890123' } }), {}, db, { now: NOW }));
  assert.equal(r.status, 201);
  assert.equal(r.body.data.verification_status, 'pending');
  assert.equal(r.body.data.nid_set, true);
  assert.ok(!JSON.stringify(r.body).includes('1234567890123'));
  assert.ok(db.state.users.find((u) => u.id === CUST).roles.includes('seller'));
  assert.equal(db.state.shops.at(-1).owner_id, CUST);
});
test('create: needs login, refuses admins and a second shop, and bad input', async () => {
  const db = makeDb();
  const post = (user, body) => out(handleCreateShop(req('/api/shops', { method: 'POST', user, body }), {}, db));
  assert.equal((await post(undefined, { name: 'Shop' })).status, 401);
  assert.equal((await post(ADMIN, { name: 'Shop' })).body.error.code, 'admin_cannot_sell');
  assert.equal((await post(SELLER, { name: 'Another' })).body.error.code, 'shop_exists');
  assert.equal((await post(CUST, { name: '' })).status, 400);
  assert.equal(db.state.users.find((u) => u.id === CUST).roles.includes('seller'), false);   // a failed request never grants the role
});
test('the owner id comes from login, never from the request body', async () => {
  const db = makeDb();
  await handleCreateShop(req('/api/shops', { method: 'POST', user: CUST, body: { name: 'Rupa Fashion', owner_id: SELLER, verification_status: 'verified', plan: 'premium' } }), {}, db);
  const s = db.state.shops.at(-1);
  assert.equal(s.owner_id, CUST);
  assert.equal(s.verification_status, 'pending');
  assert.equal(s.plan, 'free');
});

test('my shop: the owner sees it, a user without one gets null', async () => {
  const db = makeDb();
  assert.equal((await out(handleMyShop(req('/x', { user: SELLER }), {}, db, { now: NOW }))).body.data.name, 'Nilima Boutique');
  assert.equal((await out(handleMyShop(req('/x', { user: CUST }), {}, db))).body.data, null);
  assert.equal((await out(handleMyShop(req('/x'), {}, db))).status, 401);
});

test('three views: the public never sees status, plan, owner or NID; the admin sees the NID', async () => {
  const db = makeDb();
  const pub = (await out(handleGetShop(req('/x'), { id: SHOP }, db, { now: NOW }))).body.data;
  for (const k of ['verification_status', 'plan', 'owner_id', 'nid_number', 'nid_set', 'rejection_note']) assert.equal(k in pub, false, k);
  assert.ok(!JSON.stringify(pub).includes('1234567890'));
  const owner = (await out(handleGetShop(req('/x', { user: SELLER }), { id: SHOP }, db, { now: NOW }))).body.data;
  assert.equal(owner.verification_status, 'pending');
  assert.equal(owner.nid_set, true);
  assert.equal('nid_number' in owner, false);
  const admin = (await out(handleGetShop(req('/x', { user: ADMIN }), { id: SHOP }, db, { now: NOW }))).body.data;
  assert.equal(admin.nid_number, '1234567890');
});
test('a rejected shop is hidden from the public but not from its owner or an admin', async () => {
  const db = makeDb();
  db.state.shops[0].verification_status = 'rejected';
  assert.equal((await out(handleGetShop(req('/x'), { id: SHOP }, db))).status, 404);
  assert.equal((await out(handleGetShop(req('/x', { user: SELLER }), { id: SHOP }, db))).status, 200);
  assert.equal((await out(handleGetShop(req('/x', { user: ADMIN }), { id: SHOP }, db))).status, 200);
  assert.equal((await out(handleGetShop(req('/x'), { id: 'bad' }, db))).status, 400);
});
test('an expired Premium plan shows as free', () => {
  const s = { ...makeDb().state.shops[0], plan: 'premium', plan_expires_at: '2026-01-01T00:00:00Z' };
  assert.equal(toShopView(s, { id: SELLER, roles: ['seller'] }, NOW).plan, 'free');
  assert.equal(toShopView(s, null, NOW).featured, false);
});

test('patch: only the owner, only editable fields', async () => {
  const db = makeDb();
  const patch = (user, body) => out(handlePatchShop(req('/x', { method: 'PATCH', user, body }), { id: SHOP }, db, { now: NOW }));
  assert.equal((await patch(SELLER, { city: 'Sylhet' })).body.data.city, 'Sylhet');
  assert.equal((await patch(OTHER, { city: 'X' })).body.error.code, 'not_your_shop');
  assert.equal((await patch(ADMIN, { city: 'X' })).status, 403);
  assert.equal((await patch(undefined, { city: 'X' })).status, 401);
  for (const k of ['plan', 'verification_status', 'owner_id', 'plan_expires_at']) assert.equal((await patch(SELLER, { [k]: 'x' })).body.error.code, 'field_not_editable');
  assert.equal((await patch(SELLER, {})).body.error.code, 'nothing_to_update');
});
test('patch: a rejected shop goes back to review, and so does a verified shop that changes its name or NID', async () => {
  const db = makeDb();
  const patch = (body) => out(handlePatchShop(req('/x', { method: 'PATCH', user: SELLER, body }), { id: SHOP }, db, { now: NOW }));
  db.state.shops[0].verification_status = 'rejected'; db.state.shops[0].rejection_note = 'bad NID';
  const r = await patch({ nid_number: '9999999999' });
  assert.equal(r.body.data.verification_status, 'pending');
  assert.equal(r.body.data.rejection_note, null);
  db.state.shops[0].verification_status = 'verified';
  assert.equal((await patch({ description: 'new text' })).body.data.verification_status, 'verified');
  assert.equal((await patch({ name: 'Brand New Name' })).body.data.verification_status, 'pending');
});

test('Premium: the owner buys 1, 3 or 6 months; the expiry is set and the price returned', async () => {
  const db = makeDb();
  const buy = (user, body) => out(handleBuyPremium(req('/x', { method: 'POST', user, body }), { id: SHOP }, db, { now: NOW }));
  const r = await buy(SELLER, { months: 3 });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.paid, 2500);
  assert.equal(r.body.data.sandbox, true);
  assert.equal(r.body.data.shop.plan, 'premium');
  assert.equal(r.body.data.shop.plan_expires_at, '2027-02-22T12:00:00.000Z');
  const again = await buy(SELLER, { months: 1 });
  assert.equal(again.body.data.shop.plan_expires_at, '2027-03-22T12:00:00.000Z');
});
test('Premium: strangers, bad plans and rejected shops are refused', async () => {
  const db = makeDb();
  const buy = (user, body) => out(handleBuyPremium(req('/x', { method: 'POST', user, body }), { id: SHOP }, db, { now: NOW }));
  assert.equal((await buy(OTHER, { months: 1 })).status, 403);
  assert.equal((await buy(undefined, { months: 1 })).status, 401);
  for (const months of [2, '1', 0, -1, null, undefined]) assert.equal((await buy(SELLER, { months })).body.error.code, 'bad_plan', String(months));
  assert.equal(db.state.shops[0].plan, 'free');
  db.state.shops[0].verification_status = 'rejected';
  assert.equal((await buy(SELLER, { months: 1 })).body.error.code, 'shop_rejected');
});

test('admin queue: admins only, filtered by status', async () => {
  const db = makeDb();
  const list = (user, q = '') => out(handleAdminListShops(req('/api/admin/shops' + q, { user }), {}, db, { now: NOW }));
  const ok = await list(ADMIN);
  assert.equal(ok.body.data.length, 1);
  assert.equal(ok.body.data[0].nid_number, '1234567890');
  assert.equal(ok.body.meta.total, 1);
  assert.equal((await list(SELLER)).status, 403);
  assert.equal((await list(undefined)).status, 401);
  assert.equal((await list(ADMIN, '?status=verified')).body.data.length, 0);
  assert.equal((await list(ADMIN, '?status=nope')).status, 400);
});
test('verify: approving clears the note and emails the owner', async () => {
  const db = makeDb();
  const sent = [];
  const mail = async (m) => { sent.push(m); return { sent: true }; };
  const r = await out(handleVerifyShop(req('/x', { method: 'PATCH', user: ADMIN, body: { status: 'verified' } }), { id: SHOP }, db, { now: NOW, mail }));
  assert.equal(r.body.data.shop.verified, true);
  assert.equal(r.body.data.emailed, true);
  assert.equal(sent[0].to, 'nilima@x.com');
});
test('verify: a rejection needs a reason, stores it, and the email carries it', async () => {
  const db = makeDb();
  const sent = [];
  const mail = async (m) => { sent.push(m); return { sent: true }; };
  const dec = (body, user = ADMIN) => out(handleVerifyShop(req('/x', { method: 'PATCH', user, body }), { id: SHOP }, db, { now: NOW, mail }));
  assert.equal((await dec({ status: 'rejected' })).status, 400);
  assert.equal(db.state.shops[0].verification_status, 'pending');
  const r = await dec({ status: 'rejected', reason: 'NID photo is unclear' });
  assert.equal(r.body.data.shop.verification_status, 'rejected');
  assert.equal(r.body.data.shop.rejection_note, 'NID photo is unclear');
  assert.match(sent[0].text, /NID photo is unclear/);
});
test('verify: non-admins are refused and a mail failure never undoes the decision', async () => {
  const db = makeDb();
  assert.equal((await out(handleVerifyShop(req('/x', { method: 'PATCH', user: SELLER, body: { status: 'verified' } }), { id: SHOP }, db))).status, 403);
  assert.equal(db.state.shops[0].verification_status, 'pending');
  const boom = async () => { throw new Error('mail down'); };
  const r = await out(handleVerifyShop(req('/x', { method: 'PATCH', user: ADMIN, body: { status: 'verified' } }), { id: SHOP }, db, { now: NOW, mail: boom }));
  assert.equal(r.status, 200);
  assert.equal(r.body.data.emailed, false);
  assert.equal(db.state.shops[0].verification_status, 'verified');
});
test('a user with no email on file is still verified (no mail sent)', async () => {
  const db = makeDb();
  db.state.shops[0].owner_id = OTHER;
  let called = null;
  const r = await out(handleVerifyShop(req('/x', { method: 'PATCH', user: ADMIN, body: { status: 'verified' } }), { id: SHOP }, db, { now: NOW, mail: async (m) => { called = m; return { sent: false }; } }));
  assert.equal(r.status, 200);
  assert.equal(called.to, null);
  assert.equal(r.body.data.emailed, false);
});
