import test from 'node:test';
import assert from 'node:assert/strict';
import { isPremium, buildSellerAnalytics, buildAdminInsights, trendingCategories, demandList } from './shape.mjs';

const NOW = new Date('2026-11-22T00:00:00Z');
const shop = { id: 's1', name: 'Nilima Boutique', plan: 'premium', plan_expires_at: '2027-01-01T00:00:00Z' };
const perf = (o) => ({ product_id: 'p' + Math.random(), name: 'Item', in_stock: true, views_30d: 0, carts_30d: 0, purchases_30d: 0, conversion: null, signal: 'new_no_views', ...o });
const gap = (o) => ({ custom_category: 'sari', color: 'maroon', occasion: null, searches_30d: 70, listings: 1, opportunity_score: 70, signal: 'high_opportunity', ...o });

test('premium needs the plan and an unexpired date', () => {
  assert.equal(isPremium(shop, NOW), true);
  assert.equal(isPremium({ ...shop, plan_expires_at: '2026-11-21T00:00:00Z' }, NOW), false);
  assert.equal(isPremium({ ...shop, plan_expires_at: null }, NOW), true);
  assert.equal(isPremium({ ...shop, plan: 'free' }, NOW), false);
  assert.equal(isPremium(null, NOW), false);
});

test('summary adds up and conversion is a ratio', () => {
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [perf({ views_30d: 100, carts_30d: 10, purchases_30d: 5 }), perf({ views_30d: 100, purchases_30d: 1 })] });
  assert.deepEqual([r.summary.views_30d, r.summary.carts_30d, r.summary.purchases_30d, r.summary.conversion], [200, 10, 6, 0.03]);
});

test('no views at all means conversion null, never a divide by zero', () => {
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [perf(), perf()] });
  assert.equal(r.summary.conversion, null);
  assert.equal(r.summary.best_seller, null);
});

test('no products at all still works', () => {
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [] });
  assert.equal(r.summary.views_30d, 0);
  assert.deepEqual(r.insights, []);
});

test('best seller is the product with most purchases', () => {
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [perf({ name: 'A', purchases_30d: 2, views_30d: 50 }), perf({ name: 'B', purchases_30d: 7, views_30d: 20 })] });
  assert.equal(r.summary.best_seller.name, 'B');
});

test('free plan gets basic stats only', () => {
  const r = buildSellerAnalytics({ shop: { ...shop, plan: 'free' }, now: NOW, performance: [perf({ views_30d: 40, purchases_30d: 2 })], demand: [gap()], trending: [] });
  assert.equal(r.locked, true);
  assert.equal(r.shop.plan, 'free');
  assert.equal(r.summary.views_30d, 40);
  assert.equal(r.platform, null);
  assert.deepEqual(r.insights, []);
});

test('an expired premium plan is treated as free', () => {
  const r = buildSellerAnalytics({ shop: { ...shop, plan_expires_at: '2026-11-01T00:00:00Z' }, now: NOW, performance: [], demand: [gap()] });
  assert.equal(r.locked, true);
});

test('demand gap tip uses the real numbers', () => {
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [], demand: [gap()] });
  assert.equal(r.insights[0].type, 'demand_gap');
  assert.match(r.insights[0].text, /"maroon sari" 70 times/);
  assert.match(r.insights[0].text, /only 1 in-stock listing exists\./);
  const r3 = buildSellerAnalytics({ shop, now: NOW, performance: [], demand: [gap({ listings: 3 })] });
  assert.match(r3.insights[0].text, /only 3 in-stock listings exist\./);
});

test('zero supply is phrased as no shop having it', () => {
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [], demand: [gap({ listings: 0 })] });
  assert.match(r.insights[0].text, /no shop has it in stock/);
});

test('rows with too little data never become tips or list items', () => {
  const weak = gap({ searches_30d: 2, signal: 'not_enough_data', opportunity_score: 2 });
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [], demand: [weak] });
  assert.deepEqual(r.insights, []);
  assert.deepEqual(r.platform.demand_gap, []);
  assert.deepEqual(demandList([weak]), []);
});

test('underperformers need real data; new products are never called bad', () => {
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [
    perf({ name: 'Flop', views_30d: 45, signal: 'doing_badly' }),
    perf({ name: 'Brand new', views_30d: 0, signal: 'new_no_views' }),
  ] });
  assert.deepEqual(r.worst_products.map((p) => p.name), ['Flop']);
  assert.equal(r.no_data_products, 1);
  assert.ok(r.insights.every((i) => !i.text.includes('Brand new')));
});

test('restock tip only for sold-out products that sold', () => {
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [
    perf({ name: 'Sold out hit', in_stock: false, purchases_30d: 5 }),
    perf({ name: 'Sold out dud', in_stock: false, purchases_30d: 0 }),
  ] });
  const tips = r.insights.filter((i) => i.type === 'restock');
  assert.equal(tips.length, 1);
  assert.match(tips[0].text, /Sold out hit sold 5 times/);
});

test('trending tip only for the seller\'s own products', () => {
  const mine = perf({ product_id: 'mine', name: 'Mine' });
  const r = buildSellerAnalytics({ shop, now: NOW, performance: [mine], trending: [
    { product_id: 'mine', name: 'Mine', score_7d: 80, signal: 'trending', custom_category: 'sari' },
    { product_id: 'other', name: 'Competitor item', shop_name: 'Rival', score_7d: 90, signal: 'trending', custom_category: 'sari' },
  ] });
  assert.equal(r.insights.filter((i) => i.type === 'trending').length, 1);
  assert.ok(!JSON.stringify(r).includes('Competitor'));
  assert.ok(!JSON.stringify(r).includes('Rival'));
});

test('platform trends for sellers are category totals without shop or product names', () => {
  const cats = trendingCategories([
    { custom_category: 'sari', score_7d: 70, signal: 'trending', name: 'X', shop_name: 'Y' },
    { custom_category: 'sari', score_7d: 30, signal: 'trending' },
    { custom_category: 'kurti', score_7d: 50, signal: 'trending' },
    { custom_category: 'watch', score_7d: 99, signal: 'steady' },
  ]);
  assert.deepEqual(cats, [{ custom_category: 'sari', trending_products: 2, score_7d: 100 }, { custom_category: 'kurti', trending_products: 1, score_7d: 50 }]);
});

test('top seller rank is shown only for that shop', () => {
  const ts = [{ shop_id: 's1', rnk: 2 }, { shop_id: 'x', rnk: 1 }];
  assert.equal(buildSellerAnalytics({ shop, now: NOW, performance: [], topSellers: ts }).shop.top_seller_rank, 2);
  assert.equal(buildSellerAnalytics({ shop: { ...shop, id: 'none' }, now: NOW, performance: [], topSellers: ts }).shop.top_seller_rank, null);
});

test('admin insights list gaps, trending, top sellers and stocking suggestions', () => {
  const r = buildAdminInsights({
    demand: [gap(), gap({ custom_category: 'frock', color: null, searches_30d: 12, listings: 0, opportunity_score: 12 }), gap({ signal: 'not_enough_data', searches_30d: 2, opportunity_score: 2, color: 'lilac' })],
    trending: [{ product_id: 'p', name: 'Clutch', shop_name: 'Jewel Box BD', custom_category: 'clutch', score_7d: 75, score_prev_7d: 6, signal: 'trending' }],
    topSellers: [{ shop_id: 's', name: 'Nilima Boutique', purchases_30d: 22, rnk: 1 }],
  });
  assert.equal(r.demand_gap.length, 2);
  assert.equal(r.demand_gap[0].name, 'maroon sari');
  assert.equal(r.suggestions.length, 2);
  assert.match(r.suggestions[0], /stock "maroon sari": 70 searches in 30 days, 1 listing in stock/);
  assert.match(r.suggestions[1], /none in stock/);
  assert.equal(r.top_sellers[0].rank, 1);
  assert.equal(r.trending_products[0].shop_name, 'Jewel Box BD');
});
