// Pure rules for shops: validation, Premium prices and dates. No database here.
export const LIMITS = { name_min: 2, name_max: 80, description: 1000, city: 60, policy: 1000, url: 300, reason_min: 3, reason_max: 500 };
// From the PRD (SF-12): 1, 3 or 6 months.
export const PREMIUM_PLANS = { 1: 1000, 3: 2500, 6: 5000 };
const NID = /^(\d{10}|\d{13}|\d{17})$/;   // Bangladesh NIDs have 10, 13 or 17 digits

function isHttp(s) {
  if (typeof s !== 'string' || s.length > LIMITS.url) return false;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

// partial=false for create (name required); partial=true for edits.
export function validateShopInput(body, { partial = false } = {}) {
  const errors = [], value = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  if (!partial && !has('name')) errors.push('name is required.');
  if (has('name')) {
    const n = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
    if (n.length < LIMITS.name_min || n.length > LIMITS.name_max) errors.push(`name must be ${LIMITS.name_min} to ${LIMITS.name_max} characters.`); else value.name = n;
  }
  for (const [k, max] of [['description', LIMITS.description], ['city', LIMITS.city], ['return_policy', LIMITS.policy]]) {
    if (!has(k)) continue;
    if (body[k] === null || body[k] === '') value[k] = null;
    else if (typeof body[k] !== 'string' || body[k].trim().length > max) errors.push(`${k} must be text up to ${max} characters.`);
    else value[k] = body[k].trim();
  }
  if (has('social_url')) {
    if (body.social_url === null || body.social_url === '') value.social_url = null;
    else if (!isHttp(body.social_url)) errors.push('social_url must be an http(s) link.'); else value.social_url = body.social_url;
  }
  if (has('nid_number')) {
    const n = typeof body.nid_number === 'string' || typeof body.nid_number === 'number' ? String(body.nid_number).replace(/[\s-]/g, '') : '';
    if (!NID.test(n)) errors.push('nid_number must have 10, 13 or 17 digits.'); else value.nid_number = n;
  }
  return { errors, value };
}

export function validateVerification(body) {
  const status = typeof body?.status === 'string' ? body.status.toLowerCase() : '';
  if (status !== 'verified' && status !== 'rejected') return { error: 'status must be "verified" or "rejected".' };
  if (status === 'verified') return { status };
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < LIMITS.reason_min || reason.length > LIMITS.reason_max) return { error: `A rejection needs a reason of ${LIMITS.reason_min} to ${LIMITS.reason_max} characters.` };
  return { status, reason };
}

export function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

// Buying while Premium is still active extends from the current expiry; otherwise it starts now.
export function premiumExpiry(shop, months, now = new Date()) {
  const current = shop.plan === 'premium' && shop.plan_expires_at ? new Date(shop.plan_expires_at) : null;
  return addMonths(current && current > now ? current : now, months);
}
