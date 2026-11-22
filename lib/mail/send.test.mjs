import test from 'node:test';
import assert from 'node:assert/strict';
import { sendMail } from './send.mjs';

const msg = { to: 'a@b.com', subject: 's', text: 't' };
test('without a key it only logs and reports not sent', async () => {
  delete process.env.RESEND_API_KEY;
  assert.deepEqual(await sendMail(msg, { fetchImpl: async () => { throw new Error('must not be called'); } }), { sent: false, reason: 'stub' });
});
test('no recipient means nothing is sent', async () => {
  assert.equal((await sendMail({ ...msg, to: null })).reason, 'no_recipient');
});
test('with a key it posts to Resend, key in the header only', async () => {
  process.env.RESEND_API_KEY = 'k123';
  try {
    let seen;
    const r = await sendMail(msg, { fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, status: 200 }; } });
    assert.equal(r.sent, true);
    assert.equal(seen.init.headers.Authorization, 'Bearer k123');
    assert.ok(!seen.init.body.includes('k123'));
  } finally { delete process.env.RESEND_API_KEY; }
});
test('a failing mail service never throws', async () => {
  process.env.RESEND_API_KEY = 'k123';
  try {
    assert.equal((await sendMail(msg, { fetchImpl: async () => ({ ok: false, status: 500 }) })).sent, false);
    assert.equal((await sendMail(msg, { fetchImpl: async () => { throw new Error('down'); } })).sent, false);
  } finally { delete process.env.RESEND_API_KEY; }
});
