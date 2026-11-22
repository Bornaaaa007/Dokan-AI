import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFile, validateRespond, validateDecision, cleanEvidence, responseDueAt, REASONS } from './rules.mjs';

const good = { reason_code: 'not_as_described', description: 'The sari was a different colour from the photos.', evidence_urls: ['https://example.com/a.jpg'] };

test('a good customer complaint passes and is trimmed', () => {
  const r = validateFile({ ...good, description: '  The sari was a different colour from the photos.  ' }, 'customer');
  assert.equal(r.ok, true);
  assert.equal(r.value.description, 'The sari was a different colour from the photos.');
});
test('reasons depend on who files', () => {
  assert.equal(validateFile({ ...good, reason_code: 'refused_delivery' }, 'customer').ok, false);
  assert.equal(validateFile({ ...good, reason_code: 'not_as_described' }, 'seller').ok, false);
  assert.equal(validateFile({ ...good, reason_code: 'refused_delivery' }, 'seller').ok, true);
  assert.equal(validateFile({ ...good, reason_code: 'other' }, 'seller').ok, true);
  assert.deepEqual(REASONS.customer.includes('false_claim'), false);
});
test('description is required, 10 to 2000 characters', () => {
  assert.equal(validateFile({ ...good, description: undefined }, 'customer').ok, false);
  assert.equal(validateFile({ ...good, description: 'short' }, 'customer').ok, false);
  assert.equal(validateFile({ ...good, description: '   too short   ' }, 'customer').ok, false);
  assert.equal(validateFile({ ...good, description: 'x'.repeat(2001) }, 'customer').ok, false);
  assert.equal(validateFile({ ...good, description: 'x'.repeat(2000) }, 'customer').ok, true);
});
test('evidence is optional, but each item must be a safe http(s) link', () => {
  assert.deepEqual(cleanEvidence(undefined), { ok: true, value: [] });
  assert.equal(cleanEvidence('https://x.com').ok, false);
  assert.equal(cleanEvidence(['javascript:alert(1)']).ok, false);
  assert.equal(cleanEvidence(['ftp://x.com/a']).ok, false);
  assert.equal(cleanEvidence(['https://x.com/with space']).ok, false);
  assert.equal(cleanEvidence([42]).ok, false);
  assert.equal(cleanEvidence(['https://x.com/' + 'a'.repeat(500)]).ok, false);
  assert.equal(cleanEvidence(Array.from({ length: 11 }, (_, i) => 'https://x.com/' + i)).ok, false);
});
test('duplicate evidence links are removed', () => {
  assert.deepEqual(cleanEvidence(['https://x.com/a', 'https://x.com/a']).value, ['https://x.com/a']);
});
test('non-object bodies are rejected', () => {
  for (const b of [undefined, null, 'text', 5]) assert.equal(validateFile(b, 'customer').ok, false);
});
test('a response needs text; evidence is optional', () => {
  assert.equal(validateRespond({}).ok, false);
  const r = validateRespond({ response_text: 'The parcel was delivered, see courier receipt.', evidence_urls: ['https://example.com/r.jpg'] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.response_evidence_urls, ['https://example.com/r.jpg']);
});
test('a decision needs a valid outcome and a written reason', () => {
  assert.equal(validateDecision({ outcome: 'upheld', decision_note: '' }).ok, false);
  assert.equal(validateDecision({ outcome: 'upheld', decision_note: 'too short' }).ok, false);
  assert.equal(validateDecision({ outcome: 'partially_upheld', decision_note: 'A long enough written reason.' }).ok, false);
  assert.equal(validateDecision({ outcome: 'UPHELD', decision_note: 'A long enough written reason.' }).ok, false);
  const d = validateDecision({ outcome: 'upheld', decision_note: 'Courier record confirms the claim.', proof_confirmed: true });
  assert.deepEqual(d.value, { outcome: 'upheld', decision_note: 'Courier record confirms the claim.', proof_confirmed: true });
});
test('proof_confirmed must be literally true', () => {
  for (const p of ['true', 1, 'yes', undefined, null])
    assert.equal(validateDecision({ outcome: 'upheld', decision_note: 'A long enough written reason.', proof_confirmed: p }).value.proof_confirmed, false);
});
test('the response is due 48 hours after filing', () => {
  assert.equal(responseDueAt('2026-11-20T10:00:00Z').toISOString(), '2026-11-22T10:00:00.000Z');
});
