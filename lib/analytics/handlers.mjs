// Request handlers for the analytics endpoints. The database is passed in (or a function that makes it).
// Identity comes only from lib/auth/current-user.mjs.
import { buildSellerAnalytics, buildAdminInsights, isPremium } from './shape.mjs';
import { run, json, http, UUID } from '../api/http.mjs';
import { requireUser, hasRole } from '../auth/current-user.mjs';

// GET /api/seller/analytics
// A seller always gets their OWN shop; any shop_id they send is ignored.
// An admin may look at any shop by sending ?shop_id=<uuid>.
export function handleSellerAnalytics(request, dbOrFactory, now = new Date()) {
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
      throw http(403, 'seller_only', 'Only sellers can see shop analytics.');
    }
    const premium = isPremium(shop, now);
    const [performance, topSellers] = await Promise.all([db.getPerformance(shop.id), db.getTopSellers()]);
    const [demand, trending] = premium ? await Promise.all([db.getDemandGap(), db.getTrending()]) : [[], []];
    return json(200, { data: buildSellerAnalytics({ shop, performance, trending, demand, topSellers, now }) });
  }, 'seller analytics');
}

// GET /api/admin/insights   (admins only)
export function handleAdminInsights(request, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    if (!hasRole(user, 'admin')) throw http(403, 'admin_only', 'Admins only.');
    const [demand, trending, topSellers] = await Promise.all([db.getDemandGap(), db.getTrending(), db.getTopSellers()]);
    return json(200, { data: buildAdminInsights({ demand, trending, topSellers }) });
  }, 'admin insights');
}

// GET /api/top-sellers   (public)
export function handleTopSellers(_request, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const rows = await db.getTopSellers();
    return json(200, { data: { shops: rows.map((t) => ({ shop_id: t.shop_id, name: t.name, rank: t.rnk })) } });
  }, 'top sellers');
}
