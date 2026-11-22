import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleFileComplaint, handleMyComplaints, handleRespond, handleAdminList, handleAdminDetail,
  handleDecision, handleUserBadge, handleShopBadge,
} from './handlers.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const CUST = id(1), SELLER = id(2), ADMIN = id(3), STRANGER = id(4), ADMIN2 = id(5), ORDER = id(10), SHOP = id(20), ORDER2 = id(11);

function makeDb(over = {}) {
  const state = {
    users: [
      { id: CUST, name: 'Test Customer', roles: ['customer'] }, { id: SELLER, name: 'Nilima', roles: ['seller'] },
      { id: ADMIN, name: 'Test Admin', roles: ['admin'] }, { id: STRANGER, name: 'Stranger', roles: ['customer'] },
      { id: ADMIN2, name: 'Second Admin', roles: ['admin'] },
    ],
    orders: [{ id: ORDER, customer_id: CUST, shop_id: SHOP, status: 'delivered', item_total: 2500 }, { id: ORDER2, customer_id: CUST, shop_id: SHOP, status: 'cancelled', item_total: 900 }],
    shops: [{ id: SHOP, owner_id: SELLER, name: 'Nilima Boutique' }],
    complaints: [], badges: [], decideCalls: [],
  };
  let n = 100;
  const db = {
    state,
    getUser: async (i) => state.users.find((u) => u.id === i) ?? null,
    getUsersByIds: async (ids) => state.users.filter((u) => ids.includes(u.id)),
    getOrder: async (i) => state.orders.find((o) => o.id === i) ?? null,
    getShop: async (i) => state.shops.find((s) => s.id === i) ?? null,
    getComplaint: async (i) => state.complaints.find((c) => c.id === i) ?? null,
    findComplaint: async (o, f) => state.complaints.find((c) => c.order_id === o && c.filed_by === f) ?? null,
    countRecentComplaints: async (u) => state.complaints.filter((c) => c.filed_by === u).length,
    insertComplaint: async (row) => { const c = { id: id(++n), status: 'submitted', created_at: '2026-11-22T09:00:00Z', response_text: null, decision_note: null, decided_by: null, ...row }; state.complaints.push(c); return c; },
    saveResponse: async (i, accused, patch) => { const c = state.complaints.find((x) => x.id === i && x.accused_id === accused && x.status === 'submitted'); if (!c) return null; Object.assign(c, patch, { status: 'responded' }); return c; },
    listForUser: async (u) => state.complaints.filter((c) => c.filed_by === u || c.accused_id === u),
    listByStatus: async (st) => state.complaints.filter((c) => st.includes(c.status)),
    countUpheldAgainst: async (u) => state.complaints.filter((c) => c.accused_id === u && c.status === 'upheld').length,
    getActiveBadges: async (u, nowIso) => state.badges.filter((b) => b.user_id === u && b.status === 'active' && b.expires_at > nowIso),
    decide: async (args) => { state.decideCalls.push(args); return { complaint: { ...state.complaints[0], status: args.outcome, decision_note: args.note, decided_by: args.adminId }, badge: args.issueBadge ? { expires_at: '2027-05-22T00:00:00Z' } : null, badge_created: args.issueBadge }; },
    ...over,
  };
  return db;
}
const call = (handler, { user, method = 'POST', body, params = {}, qs = '', opts = {} } = {}, db = makeDb()) => {
  const headers = { 'content-type': 'application/json' };
  if (user) headers['x-user-id'] = user;
  const req = new Request('http://localhost/api/x' + qs, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return handler(req, params, db, { now: NOW, ...opts });
};
const GOOD = { reason_code: 'not_as_described', description: 'The sari was a different colour from the photos.', evidence_urls: ['https://example.com/a.jpg'] };
const file = (o = {}, db) => call(handleFileComplaint, { user: CUST, params: { id: ORDER }, body: GOOD, ...o }, db);

// ---------- filing
test('filing needs a signed-in, known user', async () => {
  assert.equal((await file({ user: undefined })).status, 401);
  assert.equal((await file({ user: 'not-a-uuid' })).status, 401);
  assert.equal((await file({ user: id(999) })).status, 401);
});
test('order id must be a uuid and the order must exist', async () => {
  assert.equal((await file({ params: { id: 'abc' } })).status, 400);
  assert.equal((await file({ params: { id: id(999) } })).status, 404);
});
test('only the customer or the shop owner of that order can file', async () => {
  const res = await file({ user: STRANGER });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, 'not_your_order');
  assert.equal((await file({ user: ADMIN })).status, 403);
});
test('a customer complaint accuses the shop owner as seller', async () => {
  const db = makeDb();
  const res = await file({}, db);
  assert.equal(res.status, 201);
  const row = db.state.complaints[0];
  assert.deepEqual([row.filed_by, row.accused_id, row.filed_by_role, row.accused_role], [CUST, SELLER, 'customer', 'seller']);
  assert.equal((await res.json()).data.status, 'submitted');
});
test('a seller complaint accuses the customer', async () => {
  const db = makeDb();
  const res = await file({ user: SELLER, body: { reason_code: 'refused_delivery', description: 'Customer refused the parcel at the door.' } }, db);
  assert.equal(res.status, 201);
  assert.deepEqual([db.state.complaints[0].accused_id, db.state.complaints[0].accused_role], [CUST, 'customer']);
});
test('a reason that does not fit the filer is rejected', async () => {
  assert.equal((await file({ body: { ...GOOD, reason_code: 'refused_delivery' } })).status, 400);
  assert.equal((await file({ user: SELLER, body: { ...GOOD, reason_code: 'not_as_described' } })).status, 400);
});
test('bad or missing body gives 400', async () => {
  assert.equal((await file({ body: { ...GOOD, description: 'short' } })).status, 400);
  assert.equal((await file({ body: undefined })).status, 400);
  assert.equal((await file({ body: { ...GOOD, evidence_urls: ['javascript:alert(1)'] } })).status, 400);
});
test('a cancelled order cannot have a complaint', async () => {
  const res = await file({ params: { id: ORDER2 } });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.code, 'order_cancelled');
});
test('one complaint per order per person', async () => {
  const db = makeDb();
  assert.equal((await file({}, db)).status, 201);
  const again = await file({}, db);
  assert.equal(again.status, 409);
  assert.equal((await again.json()).error.code, 'already_filed');
  assert.equal(db.state.complaints.length, 1);
});
test('a duplicate that slips past the check (race) is still a 409', async () => {
  const db = makeDb({ insertComplaint: async () => { const e = new Error('duplicate'); e.code = 'duplicate'; throw e; } });
  assert.equal((await file({}, db)).status, 409);
});
test('rate limit: 5 complaints per 24 hours', async () => {
  const db = makeDb({ countRecentComplaints: async () => 5 });
  const res = await file({}, db);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error.code, 'too_many_complaints');
});
test('the ordering customer cannot file on their own shop order', async () => {
  const db = makeDb(); db.state.shops[0].owner_id = CUST;
  assert.equal((await file({}, db)).status, 400);
});
test('the filer never sees who decides', async () => {
  const body = JSON.stringify((await (await file()).json()).data);
  assert.ok(!body.includes('decided_by'));
});

// ---------- responding
async function filedDb() { const db = makeDb(); await file({}, db); return db; }
const respond = (o = {}, db) => call(handleRespond, { user: SELLER, params: { id: id(101) }, body: { response_text: 'The parcel matched the listing, see my packing photos.', evidence_urls: ['https://example.com/p.jpg'] }, ...o }, db);

test('only the accused can respond', async () => {
  const db = await filedDb();
  assert.equal((await respond({ user: CUST }, db)).status, 403);
  assert.equal((await respond({ user: STRANGER }, db)).status, 403);
  assert.equal((await respond({ user: ADMIN }, db)).status, 403);
});
test('the accused response is saved and status becomes responded', async () => {
  const db = await filedDb();
  const res = await respond({}, db);
  assert.equal(res.status, 200);
  const c = db.state.complaints[0];
  assert.equal(c.status, 'responded');
  assert.deepEqual(c.response_evidence_urls, ['https://example.com/p.jpg']);
  assert.equal(c.responded_at, NOW.toISOString());
  assert.deepEqual(c.evidence_urls, ['https://example.com/a.jpg']);
});
test('a second response, or a response after the decision, is refused', async () => {
  const db = await filedDb();
  assert.equal((await respond({}, db)).status, 200);
  assert.equal((await respond({}, db)).status, 409);
  const db2 = await filedDb(); db2.state.complaints[0].status = 'upheld';
  assert.equal((await respond({}, db2)).status, 409);
});
test('losing the race to save is a 409, not a crash', async () => {
  const db = await filedDb(); db.saveResponse = async () => null;
  assert.equal((await respond({}, db)).status, 409);
});
test('a response needs text; unknown complaint is 404', async () => {
  const db = await filedDb();
  assert.equal((await respond({ body: { response_text: 'no' } }, db)).status, 400);
  assert.equal((await respond({ params: { id: id(999) } }, db)).status, 404);
});
test('the accused sees the response deadline; the filer does not', async () => {
  const db = await filedDb();
  const acc = (await (await call(handleMyComplaints, { user: SELLER, method: 'GET' }, db)).json()).data.complaints[0];
  assert.equal(acc.my_role, 'accused');
  assert.equal(acc.response_due_at, '2026-11-24T09:00:00.000Z');
  const fil = (await (await call(handleMyComplaints, { user: CUST, method: 'GET' }, db)).json()).data.complaints[0];
  assert.equal(fil.my_role, 'filer');
  assert.equal(fil.response_due_at, null);
});
test('strangers see none of it; the decision note stays hidden until decided', async () => {
  const db = await filedDb(); db.state.complaints[0].decision_note = 'Internal draft thoughts';
  assert.deepEqual((await (await call(handleMyComplaints, { user: STRANGER, method: 'GET' }, db)).json()).data.complaints, []);
  assert.equal((await (await call(handleMyComplaints, { user: CUST, method: 'GET' }, db)).json()).data.complaints[0].decision_note, null);
  db.state.complaints[0].status = 'rejected';
  assert.equal((await (await call(handleMyComplaints, { user: CUST, method: 'GET' }, db)).json()).data.complaints[0].decision_note, 'Internal draft thoughts');
});

// ---------- admin
test('admin endpoints refuse non-admins and anonymous callers', async () => {
  const db = await filedDb();
  for (const user of [CUST, SELLER, STRANGER]) {
    assert.equal((await call(handleAdminList, { user, method: 'GET' }, db)).status, 403);
    assert.equal((await call(handleAdminDetail, { user, method: 'GET', params: { id: id(101) } }, db)).status, 403);
    assert.equal((await call(handleDecision, { user, method: 'PATCH', params: { id: id(101) }, body: { outcome: 'upheld', decision_note: 'A long enough written reason.' } }, db)).status, 403);
  }
  assert.equal((await call(handleAdminList, { method: 'GET' }, db)).status, 401);
  assert.equal(db.state.decideCalls.length, 0);
});
test('the admin queue lists open complaints with names and overdue flags', async () => {
  const db = await filedDb();
  const late = makeDb(); await file({}, late); late.state.complaints[0].created_at = '2026-11-19T09:00:00Z';
  const ok = (await (await call(handleAdminList, { user: ADMIN, method: 'GET' }, db)).json()).data.complaints[0];
  assert.deepEqual([ok.filed_by.name, ok.accused.name, ok.response_overdue, ok.has_response], ['Test Customer', 'Nilima', false, false]);
  assert.equal((await (await call(handleAdminList, { user: ADMIN, method: 'GET' }, late)).json()).data.complaints[0].response_overdue, true);
});
test('queue filters by status and rejects unknown statuses', async () => {
  const db = await filedDb();
  assert.equal((await (await call(handleAdminList, { user: ADMIN, method: 'GET', qs: '?status=upheld' }, db)).json()).data.complaints.length, 0);
  assert.equal((await call(handleAdminList, { user: ADMIN, method: 'GET', qs: '?status=banana' }, db)).status, 400);
});
test('the detail shows both sides, the order and the accused history', async () => {
  const db = await filedDb();
  db.state.complaints.push({ id: id(150), order_id: ORDER, filed_by: STRANGER, accused_id: SELLER, filed_by_role: 'customer', accused_role: 'seller', status: 'upheld', created_at: '2026-10-01T00:00:00Z' });
  db.state.badges.push({ user_id: SELLER, role: 'seller', status: 'active', expires_at: '2027-01-01T00:00:00Z' });
  const d = (await (await call(handleAdminDetail, { user: ADMIN, method: 'GET', params: { id: id(101) } }, db)).json()).data;
  assert.equal(d.order.shop_name, 'Nilima Boutique');
  assert.deepEqual([d.accused_history.upheld_before, d.accused_history.has_active_badge], [1, true]);
  assert.equal(d.accused.name, 'Nilima');
  assert.equal(d.response_overdue, false);
});
test('detail 404s for an unknown complaint', async () => {
  assert.equal((await call(handleAdminDetail, { user: ADMIN, method: 'GET', params: { id: id(999) } })).status, 404);
});

// ---------- decision
const decide = (o = {}, db, opts) => call(handleDecision, { user: ADMIN, method: 'PATCH', params: { id: id(101) }, body: { outcome: 'upheld', decision_note: 'Photos and the courier record confirm the claim.', proof_confirmed: true }, ...o, opts: opts ?? {} }, db);

test('a written reason and a valid outcome are required', async () => {
  const db = await filedDb();
  assert.equal((await decide({ body: { outcome: 'upheld', decision_note: '' } }, db)).status, 400);
  assert.equal((await decide({ body: { outcome: 'partially_upheld', decision_note: 'A long enough written reason.' } }, db)).status, 400);
  assert.equal((await decide({ body: undefined }, db)).status, 400);
  assert.equal(db.state.decideCalls.length, 0);
});
test('badges are OFF by default: an upheld decision issues none', async () => {
  const db = await filedDb();
  const res = await decide({}, db);
  const data = (await res.json()).data;
  assert.equal(db.state.decideCalls[0].issueBadge, false);
  assert.equal(data.badge_issued, false);
  assert.match(data.badge_note, /switched off/);
});
test('with badges ON, an upheld decision with confirmed proof issues one', async () => {
  const db = await filedDb();
  const data = (await (await decide({}, db, { issueBadges: true })).json()).data;
  assert.equal(db.state.decideCalls[0].issueBadge, true);
  assert.deepEqual([data.badge_issued, data.badge_expires_at, data.badge_note], [true, '2027-05-22T00:00:00Z', 'Badge issued.']);
});
test('with badges ON, no proof means no badge', async () => {
  const db = await filedDb();
  const data = (await (await decide({ body: { outcome: 'upheld', decision_note: 'Upheld, but proof is not yet complete.' } }, db, { issueBadges: true })).json()).data;
  assert.equal(db.state.decideCalls[0].issueBadge, false);
  assert.match(data.badge_note, /proof was not confirmed/);
});
test('a rejected complaint never asks for a badge', async () => {
  const db = await filedDb();
  const data = (await (await decide({ body: { outcome: 'rejected', decision_note: 'No supporting evidence was provided.', proof_confirmed: true } }, db, { issueBadges: true })).json()).data;
  assert.equal(db.state.decideCalls[0].issueBadge, false);
  assert.equal(data.badge_note, null);
});
test('the deciding admin is recorded from the caller, never from the body', async () => {
  const db = await filedDb();
  await decide({ body: { outcome: 'rejected', decision_note: 'No supporting evidence was provided.', decided_by: STRANGER, adminId: STRANGER } }, db);
  assert.equal(db.state.decideCalls[0].adminId, ADMIN);
});
test('database rule errors map to clear HTTP errors', async () => {
  const cases = { already_decided: 409, complaint_not_found: 404, admin_required: 403, conflict_of_interest: 403, note_required: 400 };
  for (const [code, status] of Object.entries(cases)) {
    const db = await filedDb();
    db.decide = async () => { const e = new Error(code); e.code = 'rpc'; throw e; };
    const res = await decide({}, db);
    assert.equal(res.status, status, code);
    assert.equal((await res.json()).error.code, code);
  }
});
test('unexpected errors give a generic 500 that leaks nothing', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const db = await filedDb();
    db.decide = async () => { const e = new Error('relation "secret_table" does not exist'); e.code = 'rpc'; throw e; };
    const res = await decide({}, db);
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(await res.json()).includes('secret_table'));
    const res2 = await call(handleAdminList, { user: ADMIN, method: 'GET' }, () => { throw new Error('Missing SUPABASE_SECRET_KEY'); });
    assert.equal(res2.status, 500);
    assert.ok(!JSON.stringify(await res2.json()).includes('SUPABASE'));
  } finally { console.error = quiet; }
});

// ---------- public badge status
const BADGES = [
  { user_id: SELLER, role: 'seller', status: 'active', expires_at: '2027-01-01T00:00:00Z' },
  { user_id: CUST, role: 'customer', status: 'active', expires_at: '2026-11-01T00:00:00Z' },
  { user_id: STRANGER, role: 'customer', status: 'removed', expires_at: '2027-01-01T00:00:00Z' },
];
const withBadges = () => { const db = makeDb(); db.state.badges = BADGES; return db; };

test('shop badge: label and level only', async () => {
  const res = await call(handleShopBadge, { method: 'GET', params: { id: SHOP } }, withBadges());
  const data = (await res.json()).data;
  assert.deepEqual(data, { has_badge: true, label: 'Verified complaints', level: 'fraud', roles: ['seller'] });
  assert.deepEqual(Object.keys(data).sort(), ['has_badge', 'label', 'level', 'roles']);
});
test('expired and removed badges do not count', async () => {
  assert.equal((await (await call(handleUserBadge, { method: 'GET', params: { id: CUST } }, withBadges())).json()).data.has_badge, false);
  assert.equal((await (await call(handleUserBadge, { method: 'GET', params: { id: STRANGER } }, withBadges())).json()).data.has_badge, false);
});
test('a user without badges, an unknown shop and a bad id', async () => {
  assert.deepEqual((await (await call(handleUserBadge, { method: 'GET', params: { id: ADMIN } }, withBadges())).json()).data, { has_badge: false, label: null, level: null, roles: [] });
  assert.equal((await call(handleShopBadge, { method: 'GET', params: { id: id(999) } }, withBadges())).status, 404);
  assert.equal((await call(handleUserBadge, { method: 'GET', params: { id: 'nope' } }, withBadges())).status, 400);
});
test('a customer badge on the shop owner does not mark the shop', async () => {
  const db = makeDb(); db.state.badges = [{ user_id: SELLER, role: 'customer', status: 'active', expires_at: '2027-01-01T00:00:00Z' }];
  assert.equal((await (await call(handleShopBadge, { method: 'GET', params: { id: SHOP } }, db)).json()).data.has_badge, false);
});
