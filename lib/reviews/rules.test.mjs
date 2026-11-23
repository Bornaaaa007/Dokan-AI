import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReview, displayName, summarize } from './rules.mjs';

test('validateReview accepts a good review and trims the text', () => {
  const r = validateReview({ rating: 5, body: '  Easy to find a gift within my budget.  ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { rating: 5, body: 'Easy to find a gift within my budget.' });
});
test('validateReview rejects bad ratings', () => {
  for (const rating of [0, 6, 3.5, '4', null, undefined]) assert.equal(validateReview({ rating, body: 'long enough text here' }).ok, false);
});
test('validateReview enforces text length', () => {
  assert.equal(validateReview({ rating: 4, body: 'too short' }).ok, false);
  assert.equal(validateReview({ rating: 4, body: 'x'.repeat(501) }).ok, false);
  assert.equal(validateReview({ rating: 4, body: 'x'.repeat(500) }).ok, true);
  assert.equal(validateReview({ rating: 4, body: 12345678901 }).ok, false);
});
test('validateReview rejects non-objects', () => {
  for (const b of [undefined, null, 'x', [], 5]) assert.equal(validateReview(b).ok, false);
});
test('displayName shows first name and last initial only', () => {
  assert.equal(displayName('Nusrat Jahan'), 'Nusrat J.');
  assert.equal(displayName('Rafi'), 'Rafi');
  assert.equal(displayName('  Tania   binte   rahman '), 'Tania R.');
  assert.equal(displayName(''), 'Dokan AI user');
  assert.equal(displayName(null), 'Dokan AI user');
});
test('summarize gives count and a one-decimal average', () => {
  assert.deepEqual(summarize([]), { count: 0, average: null });
  assert.deepEqual(summarize([5, 4, 4]), { count: 3, average: 4.3 });
  assert.deepEqual(summarize([5]), { count: 1, average: 5 });
});
