// Pure validation for product input and for search query strings. No database here.
import { UUID } from '../api/http.mjs';

export const CATEGORIES = ['clothing', 'jewelry', 'shoes', 'accessories'];
export const GENDERS = ['female', 'male', 'unisex'];
export const AGE_GROUPS = ['child', 'adult', 'elderly'];
export const STATUSES = ['active', 'hidden'];
export const LIMITS = {
  name: 120, description: 2000, custom_category: 40, colors: 10, color_len: 20, tags: 10, tag_len: 30,
  images: 8, url_len: 500, price_max: 1000000, variants: 30, size_len: 20, stock_max: 100000, q: 100, page_max: 50,
};

const isInt = Number.isInteger;
const lc = (s) => String(s).trim().toLowerCase();
const WORDISH = /^[\p{L}\p{N}][\p{L}\p{N} -]*$/u;

function wordList(v, field, max, maxLen, errors) {
  if (!Array.isArray(v) || v.length > max) { errors.push(`${field} must be a list of at most ${max} items.`); return undefined; }
  const out = [];
  for (const item of v) {
    if (typeof item !== 'string') { errors.push(`${field} must contain only text.`); return undefined; }
    const x = lc(item);
    if (x.length < 2 || x.length > maxLen || !WORDISH.test(x)) { errors.push(`${field}: "${item.slice(0, 30)}" is not a valid value.`); return undefined; }
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

function validUrl(s) {
  if (typeof s !== 'string' || s.length > LIMITS.url_len) return false;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

// partial=false: all required fields must be present (create). partial=true: only validate what was sent (patch).
export function validateProductInput(body, { partial = false } = {}) {
  const errors = [];
  const value = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const need = (k) => { if (!partial && !has(k)) errors.push(`${k} is required.`); return has(k); };

  if (need('name')) {
    const n = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
    if (!n || n.length > LIMITS.name) errors.push(`name must be 1 to ${LIMITS.name} characters.`); else value.name = n;
  }
  if (has('description')) {
    if (body.description === null) value.description = null;
    else if (typeof body.description !== 'string' || body.description.length > LIMITS.description) errors.push(`description must be text up to ${LIMITS.description} characters.`);
    else value.description = body.description.trim();
  }
  for (const [k, list] of [['category', CATEGORIES], ['gender', GENDERS], ['age_group', AGE_GROUPS]]) {
    if (need(k)) { const v = typeof body[k] === 'string' ? lc(body[k]) : ''; if (!list.includes(v)) errors.push(`${k} must be one of: ${list.join(', ')}.`); else value[k] = v; }
  }
  if (has('status')) { const v = typeof body.status === 'string' ? lc(body.status) : ''; if (!STATUSES.includes(v)) errors.push(`status must be one of: ${STATUSES.join(', ')}.`); else value.status = v; }
  if (has('custom_category')) {
    if (body.custom_category === null || body.custom_category === '') value.custom_category = null;
    else {
      const v = typeof body.custom_category === 'string' ? lc(body.custom_category) : '';
      if (!v || v.length > LIMITS.custom_category || !WORDISH.test(v)) errors.push('custom_category must be a short word such as "sari" or "three-piece".'); else value.custom_category = v;
    }
  }
  if (has('colors')) { const v = wordList(body.colors, 'colors', LIMITS.colors, LIMITS.color_len, errors); if (v) value.colors = v; }
  if (has('occasion_tags')) { const v = wordList(body.occasion_tags, 'occasion_tags', LIMITS.tags, LIMITS.tag_len, errors); if (v) value.occasion_tags = v; }
  if (has('image_urls')) {
    if (!Array.isArray(body.image_urls) || body.image_urls.length > LIMITS.images || !body.image_urls.every(validUrl)) errors.push(`image_urls must be at most ${LIMITS.images} http(s) links.`);
    else value.image_urls = body.image_urls;
  }
  if (need('price')) { if (!isInt(body.price) || body.price < 1 || body.price > LIMITS.price_max) errors.push(`price must be a whole number of BDT from 1 to ${LIMITS.price_max}.`); else value.price = body.price; }
  if (has('discount_price')) {
    if (body.discount_price === null) value.discount_price = null;
    else if (!isInt(body.discount_price) || body.discount_price < 1 || body.discount_price > LIMITS.price_max) errors.push('discount_price must be a whole number of BDT, or null.');
    else value.discount_price = body.discount_price;
  }
  if (need('variants')) {
    const v = body.variants;
    if (!Array.isArray(v) || v.length < 1 || v.length > LIMITS.variants) errors.push(`variants must be a list of 1 to ${LIMITS.variants} items.`);
    else {
      const out = []; const seen = new Set(); let ok = true;
      for (const x of v) {
        const size = typeof x?.size === 'string' ? x.size.trim() : '';
        const color = x?.color == null ? '' : (typeof x.color === 'string' ? lc(x.color) : null);
        if (!size || size.length > LIMITS.size_len || color === null || color.length > LIMITS.color_len || !isInt(x.stock) || x.stock < 0 || x.stock > LIMITS.stock_max) { ok = false; break; }
        const key = size.toLowerCase() + '|' + color;
        if (seen.has(key)) { errors.push('variants has the same size and colour twice.'); ok = false; break; }
        seen.add(key); out.push({ size, color, stock: x.stock });
      }
      if (ok) value.variants = out; else if (!errors.some((e) => e.startsWith('variants'))) errors.push('Each variant needs a size, an optional colour and a stock number of 0 or more.');
    }
  }
  return { errors, value };
}

// The discount must be a real discount. Checked on the merged result so a patch of one field cannot break the other.
export function checkPrices(price, discount) {
  return discount != null && discount >= price ? 'discount_price must be lower than price.' : null;
}

const intParam = (s, name, min, max, errors) => {
  if (s == null || s === '') return undefined;
  if (!/^\d+$/.test(s)) { errors.push(`${name} must be a whole number.`); return undefined; }
  const n = Number(s);
  if (n < min || n > max) { errors.push(`${name} must be between ${min} and ${max}.`); return undefined; }
  return n;
};

export function parseSearchQuery(sp) {
  const errors = [];
  const v = {};
  const get = (k) => { const x = sp.get(k); return x == null || x.trim() === '' ? undefined : x.trim(); };
  const q = get('q'); if (q) v.q = q.slice(0, LIMITS.q);
  for (const [k, list] of [['category', CATEGORIES], ['gender', GENDERS], ['age_group', AGE_GROUPS]]) {
    const x = get(k); if (x === undefined) continue;
    if (!list.includes(x.toLowerCase())) errors.push(`${k} must be one of: ${list.join(', ')}.`); else v[k] = x.toLowerCase();
  }
  const color = get('color'); if (color) v.color = color.toLowerCase().slice(0, LIMITS.color_len);
  const size = get('size'); if (size) v.size = size.toLowerCase().slice(0, LIMITS.size_len);
  const occasion = get('occasion'); if (occasion) v.occasion = occasion.toLowerCase().slice(0, LIMITS.tag_len);
  const shop = get('shop_id'); if (shop) { if (!UUID.test(shop)) errors.push('shop_id is not valid.'); else v.shop_id = shop.toLowerCase(); }
  const min = intParam(get('min_price'), 'min_price', 0, LIMITS.price_max, errors); if (min !== undefined) v.min_price = min;
  const max = intParam(get('max_price'), 'max_price', 0, LIMITS.price_max, errors); if (max !== undefined) v.max_price = max;
  if (min !== undefined && max !== undefined && min > max) errors.push('min_price cannot be higher than max_price.');
  const stock = get('in_stock'); if (stock !== undefined) v.in_stock = stock === 'true' || stock === '1';
  v.page = intParam(get('page'), 'page', 1, 100000, errors) ?? 1;
  v.limit = intParam(get('limit'), 'limit', 1, LIMITS.page_max, errors) ?? 20;
  return { errors, value: v };
}
