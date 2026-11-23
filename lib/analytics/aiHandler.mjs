// POST /api/seller/analytics/ai   { language? }   (premium sellers; admin: add ?shop_id=<uuid>)
// Numbers are rebuilt from the database here. The browser never sends data for the AI to read.
import { buildSellerAnalytics, isPremium } from './shape.mjs';
import { run, json, http, readJson, isPlainObject, UUID } from '../api/http.mjs';
import { requireUser, hasRole } from '../auth/current-user.mjs';
import { analyzeShop } from '../ai/analyzeShop.mjs';

// Small in-memory cache: stops repeated clicks from burning AI quota.
// (On serverless hosting each instance has its own cache, which is fine for this purpose.)
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

export function handleSellerAiAnalysis(request, dbOrFactory, { analyze = analyzeShop, now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    let shop;
    if (hasRole(user, 'admin')) {
      const shopId = new URL(request.url).searchParams.get('shop_id');
      if (!shopId || !UUID.test(shopId)) throw http(400, 'bad_shop_id', 'Send ?shop_id=<shop uuid>.');
      shop = await db.getShop(shopId.toLowerCase());
      if (!shop) throw http(404, 'shop_not_found', 'No shop with that id.');
    } else if (hasRole(user, 'seller')) {
      const mine = await db.getShopsByOwner(user.id);
      if (!mine.length) throw http(404, 'no_shop', 'Create your shop first.');
      shop = mine[0];
    } else {
      throw http(403, 'seller_only', 'Only sellers can use this.');
    }
    if (!isPremium(shop, now)) throw http(403, 'premium_only', 'AI analysis is a Premium feature.');

    const body = await readJson(request);
    const language = isPlainObject(body) && body.language === 'bn' ? 'bn' : 'en';

    const key = shop.id + ':' + language;
    const hit = cache.get(key);
    if (hit && now.getTime() - hit.at < CACHE_MS) return json(200, { data: { ...hit.data, cached: true } });

    const [performance, trending, demand, topSellers] = await Promise.all([db.getPerformance(shop.id), db.getTrending(), db.getDemandGap(), db.getTopSellers()]);
    if (!performance.length) throw http(400, 'not_enough_data', 'Add some products and get a few views first, then try again.');
    const data = buildSellerAnalytics({ shop, performance, trending, demand, topSellers, now });

    let analysis;
    try {
      analysis = await analyze({ data, language });
    } catch (e) {
      console.error('seller ai analysis error:', e.message);
      throw http(503, 'ai_unavailable', 'The AI helper is busy. Your basic tips are still shown. Try again in a moment.');
    }
    const out = { ...analysis, generated_at: now.toISOString(), cached: false };
    cache.set(key, { at: now.getTime(), data: out });
    return json(200, { data: out });
  }, 'seller ai analysis');
}