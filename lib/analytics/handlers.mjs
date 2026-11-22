// Request handlers for the analytics endpoints. The database is passed in (or a function that makes it).
import { buildSellerAnalytics, buildAdminInsights, isPremium } from './shape.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (status, code, message) => json(status, { error: { code, message } });
const resolveDb = (d) => (typeof d === 'function' ? d() : d);

export async function handleSellerAnalytics(request, dbOrFactory, now = new Date()) {
  const shopId = new URL(request.url).searchParams.get('shop_id');
  if (!shopId || !UUID.test(shopId)) return fail(400, 'bad_shop_id', 'Send ?shop_id=<shop uuid>.');
  try {
    const db = resolveDb(dbOrFactory);
    const shop = await db.getShop(shopId);
    if (!shop) return fail(404, 'shop_not_found', 'No shop with that id.');
    // TODO (when real login exists): check that the signed-in user owns this shop before continuing.
    const premium = isPremium(shop, now);
    const [performance, topSellers] = await Promise.all([db.getPerformance(shopId), db.getTopSellers()]);
    const [demand, trending] = premium ? await Promise.all([db.getDemandGap(), db.getTrending()]) : [[], []];
    return json(200, { data: buildSellerAnalytics({ shop, performance, trending, demand, topSellers, now }) });
  } catch (e) {
    console.error('seller analytics error:', e);
    return fail(500, 'internal', 'Something went wrong. Please try again.');
  }
}

export async function handleAdminInsights(_request, dbOrFactory) {
  try {
    const db = resolveDb(dbOrFactory);
    const [demand, trending, topSellers] = await Promise.all([db.getDemandGap(), db.getTrending(), db.getTopSellers()]);
    return json(200, { data: buildAdminInsights({ demand, trending, topSellers }) });
  } catch (e) {
    console.error('admin insights error:', e);
    return fail(500, 'internal', 'Something went wrong. Please try again.');
  }
}

export async function handleTopSellers(_request, dbOrFactory) {
  try {
    const rows = await resolveDb(dbOrFactory).getTopSellers();
    return json(200, { data: { shops: rows.map((t) => ({ shop_id: t.shop_id, name: t.name, rank: t.rnk })) } });
  } catch (e) {
    console.error('top sellers error:', e);
    return fail(500, 'internal', 'Something went wrong. Please try again.');
  }
}
