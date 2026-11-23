import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTriage } from './triageHandler.mjs';
import { cleanTriage, compactComplaint } from '../ai/triageComplaint.mjs';

process.env.ENABLE_DEV_USER_HEADER = 'true';
const NOW = new Date('2026-11-22T12:00:00Z');
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const CUST = id(1), SELLER = id(2), ADMIN = id(3), COMP = id(100), ORDER = id(10), SHOP = id(20);

function makeDb() {
  const state = { decideCalls: 0, complaint: { id: COMP, order_id: ORDER, filed_by: CUST, accused_id: SELLER, filed_by_role: 'customer', accused_role: 'seller', reason_code: 'not_delivered', description: 'I paid but nothing arrived after 10 days.', evidence_urls: ['https://example.com/a'], status: 'submitted', created_at: '2026-11-18T09:00:00Z', response_text: null, response_evidence_urls: [], responded_at: null } };
  return {
    state,
    getUser: async (i) => ({ [CUST]: { id: CUST, roles: ['customer'], name: 'Ayesha' }, [SELLER]: { id: SELLER, roles: ['seller'] }, [ADMIN]: { id: ADMIN, roles: ['admin'] } }[i] ?? null),
    getComplaint: async (i) => (i === COMP ? state.complaint : null),
    getOrder: async () => ({ id: ORDER, customer_id: CUST, shop_id: SHOP, status: 'shipped', item_total: 2500, payment_status: 'held', payment_method: 'bkash', items: [{ name: 'Red sari', size: 'Free', qty: 1 }] }),
    countUpheldAgainst: async () => 0,
    getActiveBadges: async () => [],
    decide: async () => { state.decideCalls++; },
  };
}
const AI = { summary: 'Customer says the order never came.', filer_points: ['Paid 10 days ago'], accused_points: [], missing_evidence: ['Courier tracking'], suggestion: 'need_more_info', confidence: 'medium', reasoning: 'No response yet.', draft_note: 'Waiting for the seller.' };
const call = (user, db, opts = {}, body = {}, params = { id: COMP }) => {
  const headers = { 'content-type': 'application/json' };
  if (user) headers['x-user-id'] = user;
  return handleTriage(new Request('http://localhost/x', { method: 'POST', headers, body: JSON.stringify(body) }), params, db, { now: NOW, ...opts });
};

test('only admins can run triage', async () => {
  const db = makeDb();
  assert.equal((await call(undefined, db)).status, 401);
  assert.equal((await call(CUST, db)).status, 403);
  assert.equal((await call(SELLER, db)).status, 403);
});

test('bad id is 400 and unknown complaint is 404', async () => {
  const db = makeDb();
  assert.equal((await call(ADMIN, db, {}, {}, { id: 'abc' })).status, 400);
  assert.equal((await call(ADMIN, db, {}, {}, { id: id(999) })).status, 404);
});

test('returns an advisory suggestion and never records a decision', async () => {
  const db = makeDb();
  let seen;
  const res = await call(ADMIN, db, { triage: async (a) => { seen = a; return AI; } }, { language: 'bn' });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.advisory, true);
  assert.equal(data.suggestion, 'need_more_info');
  assert.equal(db.state.decideCalls, 0);
  assert.equal(db.state.complaint.status, 'submitted');
  assert.equal(seen.language, 'bn');
  assert.equal(seen.thread.responseOverdue, true);   // 4 days old, no reply yet
});

test('AI failure is a calm 503 and the admin can still decide', async () => {
  const res = await call(ADMIN, makeDb(), { triage: async () => { throw new Error('boom'); } });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'ai_unavailable');
});

test('the model gets roles and facts only, never names or ids', () => {
  const db = makeDb();
  const s = JSON.stringify(compactComplaint({ complaint: db.state.complaint, order: { status: 'shipped', items: [] } }));
  assert.ok(!s.includes('Ayesha') && !s.includes(CUST) && !s.includes('example.com'));
  assert.match(s, /"evidence_links_attached_by_filer":1/);
});

test('model output is cleaned: unknown suggestion becomes need_more_info, lists are capped', () => {
  const r = cleanTriage({ ...AI, suggestion: 'ban_user', confidence: 'certain', filer_points: ['a', 'b', 'c', 'd', 'e'] });
  assert.equal(r.suggestion, 'need_more_info');
  assert.equal(r.confidence, 'low');
  assert.equal(r.filer_points.length, 3);
});
