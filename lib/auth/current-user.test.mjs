import test from 'node:test';
import assert from 'node:assert/strict';
import { currentUser, requireUser, hasRole } from './current-user.mjs';

const U = '00000000-0000-4000-8000-000000000001';
const db = {
  getUser: async (id) => (id === U ? { id: U, name: 'A', roles: ['seller'] } : null),
  getUserByToken: async (t) => (t === 'good' ? { id: U, name: 'A', roles: ['seller'] } : null),
};
const req = (h) => ({ headers: new Headers(h) });

test('a valid bearer token identifies the user', async () => {
  assert.equal((await currentUser(req({ authorization: 'Bearer good' }), db)).id, U);
});
test('a bad token returns null and never falls back to the demo header', async () => {
  assert.equal(await currentUser(req({ authorization: 'Bearer bad', 'x-user-id': U }), db), null);
  assert.equal(await currentUser(req({ authorization: 'Basic abc', 'x-user-id': U }), db), null);
});
test('the demo header works, but only with a real uuid of a known user', async () => {
  assert.equal((await currentUser(req({ 'x-user-id': U }), db)).id, U);
  assert.equal(await currentUser(req({ 'x-user-id': 'nope' }), db), null);
  assert.equal(await currentUser(req({ 'x-user-id': '00000000-0000-4000-8000-000000000099' }), db), null);
  assert.equal(await currentUser(req({}), db), null);
});
test('the demo header is off unless ENABLE_DEV_USER_HEADER is true', async () => {
  process.env.ENABLE_DEV_USER_HEADER = 'false';
  try { assert.equal(await currentUser(req({ 'x-user-id': U }), db), null); }
  finally { process.env.ENABLE_DEV_USER_HEADER = 'true'; }
});
test('requireUser throws 401 and hasRole checks roles', async () => {
  await assert.rejects(requireUser(req({}), db), (e) => e.status === 401);
  assert.equal(hasRole({ roles: ['seller'] }, 'seller'), true);
  assert.equal(hasRole({ roles: ['seller'] }, 'admin'), false);
  assert.equal(hasRole(null, 'admin'), false);
});
