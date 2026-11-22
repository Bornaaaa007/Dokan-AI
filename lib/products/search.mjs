// Pure catalog search: takes rows already loaded from the database. No database calls here.

export const effectivePrice = (p) => (p.discount_price != null && p.discount_price < p.price ? p.discount_price : p.price);
const lc = (s) => String(s ?? '').trim().toLowerCase();
export const inStock = (p) => Array.isArray(p.variants) && p.variants.some((v) => Number(v?.stock) > 0);
export const isFeatured = (shop, now = new Date()) =>
  shop?.plan === 'premium' && (!shop.plan_expires_at || new Date(shop.plan_expires_at) > now);

const STOP = new Set(['a', 'an', 'the', 'for', 'and', 'or', 'in', 'on', 'of', 'to', 'my', 'me', 'i', 'with', 'under', 'below', 'above', 'show', 'find', 'need', 'want', 'bdt', 'tk', 'taka']);
const ALIASES = { saree: 'sari', sarees: 'sari', punjabi: 'panjabi', threepiece: 'three-piece' };

export function queryTokens(q) {
  return lc(q).replace(/three[\s]piece/g, 'three-piece').split(/[^\p{L}\p{N}-]+/u)
    .filter((t) => t && !STOP.has(t) && !/^\d+[kK]?$/.test(t));
}
function tokenVariants(t) {
  const out = new Set([t]);
  if (ALIASES[t]) out.add(ALIASES[t]);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) out.add(t.slice(0, -1));
  return [...out];
}
function matchesQuery(p, tokens) {
  if (!tokens.length) return true;
  const hay = [p.name, p.custom_category, p.category, ...(p.colors ?? []), ...(p.occasion_tags ?? [])].map(lc).join(' ');
  return tokens.every((t) => tokenVariants(t).some((v) => hay.includes(v)));
}

export function toPublicProduct(p, shop, now = new Date(), { withDescription = false } = {}) {
  return {
    id: p.id, shop_id: p.shop_id, name: p.name,
    ...(withDescription ? { description: p.description ?? null } : {}),
    category: p.category, custom_category: p.custom_category ?? null, gender: p.gender, age_group: p.age_group,
    colors: p.colors ?? [], occasion_tags: p.occasion_tags ?? [], image_urls: p.image_urls ?? [],
    price: p.price, discount_price: p.discount_price ?? null, price_now: effectivePrice(p),
    variants: p.variants ?? [], in_stock: inStock(p), status: p.status, created_at: p.created_at,
    shop: shop ? { id: shop.id, name: shop.name, city: shop.city ?? null, verified: shop.verification_status === 'verified', featured: isFeatured(shop, now) } : null,
  };
}

// Filters, sorts (premium first, then newest) and pages the catalog. A gender search also returns unisex items.
export function searchCatalog(rows, shops, params, now = new Date()) {
  const tokens = queryTokens(params.q);
  const hits = [];
  for (const p of rows) {
    const shop = shops.get(p.shop_id);
    if (!shop || shop.verification_status === 'rejected' || p.status !== 'active') continue;
    if (params.shop_id && p.shop_id !== params.shop_id) continue;
    if (params.category && p.category !== params.category) continue;
    if (params.gender && p.gender !== params.gender && p.gender !== 'unisex') continue;
    if (params.age_group && p.age_group !== params.age_group) continue;
    if (params.color && !(p.colors ?? []).some((c) => lc(c) === params.color)) continue;
    if (params.occasion && !(p.occasion_tags ?? []).some((o) => lc(o) === params.occasion)) continue;
    if (params.size && !(Array.isArray(p.variants) && p.variants.some((v) => lc(v?.size) === params.size && Number(v?.stock) > 0))) continue;
    const price = effectivePrice(p);
    if (params.min_price !== undefined && price < params.min_price) continue;
    if (params.max_price !== undefined && price > params.max_price) continue;
    if (params.in_stock && !inStock(p)) continue;
    if (!matchesQuery(p, tokens)) continue;
    hits.push({ p, shop, featured: isFeatured(shop, now) });
  }
  hits.sort((a, b) =>
    Number(b.featured) - Number(a.featured) ||
    new Date(b.p.created_at ?? 0) - new Date(a.p.created_at ?? 0) ||
    String(a.p.name).localeCompare(String(b.p.name)));
  const start = (params.page - 1) * params.limit;
  return { total: hits.length, items: hits.slice(start, start + params.limit).map((h) => toPublicProduct(h.p, h.shop, now)) };
}

// ---- search log (feeds the demand-gap view) ----
// Words customers use even when nobody sells them yet: that is exactly the demand we want to see.
const KNOWN_CATEGORIES = ['sari', 'kurti', 'three-piece', 'lehenga', 'panjabi', 'frock', 'shirt', 'formal shirt', 'pants', 'skirt', 'dress', 'salwar', 'burqa', 'hijab', 'fatua', 'shoes', 'heels', 'flats', 'sandals', 'oxford', 'earrings', 'necklace', 'bangles', 'ring', 'watch', 'clutch', 'bag', 'belt'];
const KNOWN_COLORS = ['maroon', 'red', 'blue', 'green', 'pink', 'black', 'white', 'navy', 'gold', 'brown', 'yellow', 'purple', 'orange', 'grey', 'gray', 'cream', 'lilac', 'silver', 'beige'];
const KNOWN_OCCASIONS = ['wedding', 'eid', 'party', 'formal', 'casual', 'festive', 'interview', 'holud'];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalizeText(q) {
  let t = lc(q).replace(/three[\s]piece/g, 'three-piece');
  for (const [from, to] of Object.entries(ALIASES)) t = t.replace(new RegExp('(?<![\\p{L}\\p{N}-])' + from + '(?![\\p{L}\\p{N}-])', 'gu'), to);
  return t;
}
function findTerm(text, terms) {
  for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    if (new RegExp('(?<![\\p{L}\\p{N}-])' + esc(term) + 's?(?![\\p{L}\\p{N}-])', 'u').test(text)) return term;
  }
  return null;
}

export function deriveLogFilters(params, rows) {
  const filters = {};
  const text = params.q ? normalizeText(params.q) : '';
  if (text) {
    const cats = new Set([...KNOWN_CATEGORIES, ...rows.map((r) => lc(r.custom_category)).filter(Boolean)]);
    const cat = findTerm(text, cats); if (cat) filters.custom_category = cat;
    const occ = new Set([...KNOWN_OCCASIONS, ...rows.flatMap((r) => (r.occasion_tags ?? []).map(lc))]);
    const o = findTerm(text, occ); if (o) filters.occasion = o;
  }
  const color = params.color ?? (text ? findTerm(text, new Set([...KNOWN_COLORS, ...rows.flatMap((r) => (r.colors ?? []).map(lc))])) : null);
  if (color) filters.color = color;
  if (params.occasion) filters.occasion = params.occasion;
  for (const k of ['category', 'gender', 'age_group', 'size', 'min_price', 'max_price']) if (params[k] !== undefined) filters[k] = params[k];
  return filters;
}

// Browsing a shop page or paging through results is not a customer search.
export const shouldLogSearch = (params) =>
  params.page === 1 && ['q', 'category', 'gender', 'age_group', 'color', 'size', 'occasion', 'min_price', 'max_price'].some((k) => params[k] !== undefined);
