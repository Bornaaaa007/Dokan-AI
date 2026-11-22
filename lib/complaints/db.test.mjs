import test from 'node:test';
import assert from 'node:assert/strict';
import { createComplaintsDb } from './db.mjs';

function fakeSb(result) {
  const calls = [];
  const builder = (table) => {
    const q = { table, ops: [] }; calls.push(q);
    const chain = new Proxy({}, { get: (_, name) => (name === 'then' ? (res) => res(result) : (...a) => { q.ops.push([name, ...a]); return chain; }) });
    return chain;
  };
  return { sb: { from: builder, rpc: async (name, args) => { calls.push({ rpc: name, args }); return result; } }, calls };
}
const op = (q, name) => q.ops.find((o) => o[0] === name);

test('user lookups never select phone or email', async () => {
  const { sb, calls } = fakeSb({ data: { id: 'u' }, error: null });
  const db = createComplaintsDb(sb);
  await db.getUser('u'); await db.getUsersByIds(['u']);
  for (const q of calls) assert.ok(!/phone|email/.test(op(q, 'select')[1]));
});
test('shop lookups never select the NID number', async () => {
  const { sb, calls } = fakeSb({ data: { id: 's' }, error: null });
  await createComplaintsDb(sb).getShop('s');
  assert.ok(!op(calls[0], 'select')[1].includes('nid'));
});
test('saving a response only touches a submitted complaint of that accused user', async () => {
  const { sb, calls } = fakeSb({ data: { id: 'c' }, error: null });
  await createComplaintsDb(sb).saveResponse('c', 'u', { response_text: 'x' });
  const q = calls[0];
  assert.equal(q.table, 'complaints');
  assert.deepEqual(q.ops.filter((o) => o[0] === 'eq').map((o) => o.slice(1)), [['id', 'c'], ['accused_id', 'u'], ['status', 'submitted']]);
  assert.equal(op(q, 'update')[1].status, 'responded');
});
test('a duplicate insert becomes a coded error', async () => {
  const { sb } = fakeSb({ data: null, error: { code: '23505', message: 'duplicate key' } });
  await assert.rejects(createComplaintsDb(sb).insertComplaint({}), (e) => e.code === 'duplicate');
});
test('other insert errors are thrown with context', async () => {
  const { sb } = fakeSb({ data: null, error: { code: 'XX', message: 'boom' } });
  await assert.rejects(createComplaintsDb(sb).insertComplaint({}), /save complaint: boom/);
});
test('active badges are filtered by status and expiry date', async () => {
  const { sb, calls } = fakeSb({ data: [], error: null });
  await createComplaintsDb(sb).getActiveBadges('u', '2026-11-22T00:00:00Z');
  assert.deepEqual(op(calls[0], 'eq').slice(1), ['user_id', 'u']);
  assert.deepEqual(calls[0].ops.filter((o) => o[0] === 'eq').map((o) => o[1]), ['user_id', 'status']);
  assert.deepEqual(op(calls[0], 'gt').slice(1), ['expires_at', '2026-11-22T00:00:00Z']);
});
test('decide calls the database function with the right arguments', async () => {
  const { sb, calls } = fakeSb({ data: { ok: 1 }, error: null });
  assert.deepEqual(await createComplaintsDb(sb).decide({ complaintId: 'c', adminId: 'a', outcome: 'upheld', note: 'n', issueBadge: true }), { ok: 1 });
  assert.deepEqual(calls[0], { rpc: 'decide_complaint', args: { p_complaint_id: 'c', p_admin_id: 'a', p_outcome: 'upheld', p_note: 'n', p_issue_badge: true } });
});
test('a decide error carries the short code', async () => {
  const { sb } = fakeSb({ data: null, error: { message: 'already_decided' } });
  await assert.rejects(createComplaintsDb(sb).decide({}), (e) => e.code === 'rpc' && e.message === 'already_decided');
});
test('queue lists oldest first', async () => {
  const { sb, calls } = fakeSb({ data: [], error: null });
  await createComplaintsDb(sb).listByStatus(['submitted']);
  assert.deepEqual(op(calls[0], 'order').slice(1), ['created_at', { ascending: true }]);
});
test('null results become empty lists', async () => {
  const { sb } = fakeSb({ data: null, error: null });
  assert.deepEqual(await createComplaintsDb(sb).listForUser('u'), []);
});
