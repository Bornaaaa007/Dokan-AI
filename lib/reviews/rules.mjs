// Pure rules for platform reviews. No database, no network.
export const LIMITS = { bodyMin: 10, bodyMax: 500, listMax: 50 };
export const STATUSES = ['pending', 'approved', 'hidden'];
export const ADMIN_SETTABLE = ['approved', 'hidden'];

export function validateReview(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Send a JSON object with rating and text.' };
  const rating = body.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, message: 'rating must be a whole number from 1 to 5.' };
  if (typeof body.body !== 'string') return { ok: false, message: 'body must be text.' };
  const text = body.body.trim();
  if (text.length < LIMITS.bodyMin || text.length > LIMITS.bodyMax)
    return { ok: false, message: `body must be ${LIMITS.bodyMin} to ${LIMITS.bodyMax} characters.` };
  return { ok: true, value: { rating, body: text } };
}

// Public name: first name and the first letter of the last name ("Nusrat J."). Never an email or phone.
export function displayName(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Dokan AI user';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${[...parts[parts.length - 1]][0].toUpperCase()}.`;
}

export function summarize(ratings) {
  const count = ratings.length;
  if (!count) return { count: 0, average: null };
  const sum = ratings.reduce((s, r) => s + r, 0);
  return { count, average: Math.round((sum / count) * 10) / 10 };
}
