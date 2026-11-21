import { SCENARIOS } from './scenarios.mjs';
import { computeLimits, matchesScenario, matchesSlot, effectivePrice } from './guardrail.mjs';

// "description" is deliberately NOT selected: product text is untrusted and must never reach the AI.
const PRODUCT_COLUMNS =
  'id,shop_id,name,category,custom_category,gender,age_group,colors,occasion_tags,image_urls,price,discount_price,variants,status';

// Reads the catalog straight from the database. This does NOT write to search_logs,
// so stylist searches never count as customer demand.
export async function loadCatalog(db) {
  const { data: products, error } = await db.from('products').select(PRODUCT_COLUMNS).eq('status', 'active');
  if (error) throw new Error('products: ' + error.message);
  const { data: shops, error: shopError } = await db.from('shops').select('id,name,verification_status');
  if (shopError) throw new Error('shops: ' + shopError.message);
  const byId = new Map(shops.map((s) => [s.id, s]));
  return products.map((p) => ({ ...p, shop: byId.get(p.shop_id) ?? null }));
}

function toCandidate(p, wanted) {
  const colors = (p.colors || []).map((c) => String(c).toLowerCase());
  const sizes = [...new Set((p.variants || []).filter((v) => Number(v.stock) > 0).map((v) => String(v.size)))];
  return {
    id: p.id,
    name: p.name,
    price: effectivePrice(p),
    listed_price: p.price,
    custom_category: p.custom_category,
    category: p.category,
    colors,
    sizes,
    shop_id: p.shop_id,
    shop_name: p.shop?.name ?? null,
    shop_verified: p.shop?.verification_status === 'verified',
    color_match: wanted ? colors.includes(wanted) : false,
  };
}

// Ranking: verified shops first, then colour match, then lowest price.
// Premium plans are NOT used here: Premium only affects the home feed.
const rank = (a, b) =>
  Number(b.shop_verified) - Number(a.shop_verified) ||
  Number(b.color_match) - Number(a.color_match) ||
  a.price - b.price ||
  a.name.localeCompare(b.name);

export function searchScenario(catalog, scenarioKey, { color } = {}) {
  const sc = SCENARIOS[scenarioKey];
  if (!sc) throw new Error('Unknown scenario: ' + scenarioKey);
  const wanted = color ? String(color).toLowerCase() : null;
  const pool = catalog.filter((p) => matchesScenario(p, sc));
  const slots = sc.slots.map((slot) => ({
    name: slot.name,
    candidates: pool.filter((p) => matchesSlot(p, slot)).map((p) => toCandidate(p, wanted)).sort(rank),
  }));
  return { scenario: scenarioKey, limits: computeLimits(catalog, sc), slots };
}
