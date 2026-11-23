// Pure functions: turn rows from the analytics views into API responses and plain-language tips.
// No database, no network: everything here is unit-tested.

export const isPremium = (shop, now = new Date()) =>
  shop?.plan === 'premium' && (!shop.plan_expires_at || new Date(shop.plan_expires_at) > now);

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
const demandName = (r) => [r.occasion, r.color, r.custom_category].filter(Boolean).join(' ');
const byDesc = (key) => (a, b) => (b[key] ?? 0) - (a[key] ?? 0);

function demandTip(r) {
  const name = demandName(r);
  const supply = r.listings === 0 ? 'no shop has it in stock'
    : r.listings === 1 ? 'only 1 in-stock listing exists'
    : 'only ' + r.listings + ' in-stock listings exist';
  return 'Customers searched for "' + name + '" ' + r.searches_30d + ' times in the last 30 days, but ' + supply + '. Stocking it could win these buyers.';
}

export function demandList(demand, limit = 5) {
  return demand
    .filter((r) => r.signal !== 'not_enough_data')
    .sort(byDesc('opportunity_score'))
    .slice(0, limit)
    .map((r) => ({ name: demandName(r), custom_category: r.custom_category, color: r.color, occasion: r.occasion, searches_30d: r.searches_30d, listings: r.listings, signal: r.signal }));
}

// Seller view: categories only, so one shop never sees another shop's products or name.
export function trendingCategories(trending, limit = 5) {
  const map = new Map();
  for (const t of trending.filter((x) => x.signal === 'trending')) {
    const key = t.custom_category ?? 'other';
    const cur = map.get(key) ?? { custom_category: key, trending_products: 0, score_7d: 0 };
    cur.trending_products += 1;
    cur.score_7d += t.score_7d;
    map.set(key, cur);
  }
  return [...map.values()].sort(byDesc('score_7d')).slice(0, limit);
}

export function sellerInsights({ performance, trending, demand }) {
  const out = [];
  for (const r of demand.filter((d) => d.signal === 'high_opportunity').sort(byDesc('opportunity_score')).slice(0, 2))
    out.push({ type: 'demand_gap', title: 'Demand gap', text: demandTip(r), product_id: null });
  for (const p of performance.filter((x) => x.signal === 'doing_badly').sort(byDesc('views_30d')).slice(0, 2))
    out.push({ type: 'underperformer', title: 'Underperformer', text: p.name + ' got ' + plural(p.views_30d, 'view') + ' but no sales in 30 days. Try a lower price or better photos.', product_id: p.product_id });
  for (const p of performance.filter((x) => !x.in_stock && x.purchases_30d > 0).sort(byDesc('purchases_30d')).slice(0, 2))
    out.push({ type: 'restock', title: 'Restock', text: p.name + ' sold ' + plural(p.purchases_30d, 'time') + ' in 30 days but is out of stock. Restock it.', product_id: p.product_id, name: p.name, purchases_30d: p.purchases_30d });
  const mine = new Set(performance.map((p) => p.product_id));
  for (const t of trending.filter((x) => x.signal === 'trending' && mine.has(x.product_id)).sort(byDesc('score_7d')).slice(0, 1))
    out.push({ type: 'trending', title: 'Trending', text: t.name + ' is trending this week. Keep it in stock.', product_id: t.product_id });
  return out;
}

export function buildSellerAnalytics({ shop, performance, trending = [], demand = [], topSellers = [], now = new Date() }) {
  const premium = isPremium(shop, now);
  const views = performance.reduce((t, p) => t + p.views_30d, 0);
  const carts = performance.reduce((t, p) => t + p.carts_30d, 0);
  const purchases = performance.reduce((t, p) => t + p.purchases_30d, 0);
  const best = performance.filter((p) => p.purchases_30d > 0).sort((a, b) => b.purchases_30d - a.purchases_30d || b.views_30d - a.views_30d);
  const rank = topSellers.find((t) => t.shop_id === shop.id)?.rnk ?? null;

  const base = {
    shop: { id: shop.id, name: shop.name, plan: premium ? 'premium' : 'free', top_seller_rank: rank },
    summary: {
      views_30d: views, carts_30d: carts, purchases_30d: purchases,
      conversion: views > 0 ? Math.round((purchases / views) * 1000) / 1000 : null,
      best_seller: best[0] ? { product_id: best[0].product_id, name: best[0].name, purchases_30d: best[0].purchases_30d } : null,
    },
    locked: !premium,
  };
  if (!premium) return { ...base, best_products: [], worst_products: [], insights: [], platform: null };

  const slim = (p) => ({ product_id: p.product_id, name: p.name, views_30d: p.views_30d, carts_30d: p.carts_30d, purchases_30d: p.purchases_30d, conversion: p.conversion, in_stock: p.in_stock });
  return {
    ...base,
    best_products: performance.filter((p) => p.signal === 'doing_well').sort(byDesc('purchases_30d')).slice(0, 3).map((p) => ({ ...slim(p), signal: p.signal })),
    worst_products: performance.filter((p) => p.signal === 'doing_badly').sort(byDesc('views_30d')).slice(0, 3).map((p) => ({ ...slim(p), signal: p.signal })),
    no_data_products: performance.filter((p) => p.signal === 'new_no_views' || p.signal === 'not_enough_data').length,
    insights: sellerInsights({ performance, trending, demand }),
    platform: { demand_gap: demandList(demand), trending_categories: trendingCategories(trending) },
  };
}

export function buildAdminInsights({ demand = [], trending = [], topSellers = [] }) {
  const gaps = demandList(demand, 10);
  return {
    demand_gap: gaps,
    trending_products: trending.filter((t) => t.signal === 'trending').sort(byDesc('score_7d')).slice(0, 10)
      .map((t) => ({ product_id: t.product_id, name: t.name, shop_name: t.shop_name, custom_category: t.custom_category, score_7d: t.score_7d, score_prev_7d: t.score_prev_7d })),
    top_sellers: topSellers.map((t) => ({ shop_id: t.shop_id, name: t.name, purchases_30d: t.purchases_30d, rank: t.rnk })),
    suggestions: gaps.filter((g) => g.signal === 'high_opportunity').slice(0, 3)
      .map((g) => 'Ask sellers to stock "' + g.name + '": ' + g.searches_30d + ' searches in 30 days, ' + (g.listings === 0 ? 'none in stock.' : plural(g.listings, 'listing') + ' in stock.')),
  };
}
