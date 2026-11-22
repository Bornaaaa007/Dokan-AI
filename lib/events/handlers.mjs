// POST /api/events  (view and add_to_cart only; sign-in optional)
// - "purchase" events are NOT accepted here. The payment endpoint writes them, so nobody can fake sales.
// - shop_id is always taken from the product, never from the request.
// - A shop owner looking at their own product is not counted, and a signed-in user repeating the same
//   event within 30 seconds is counted once. Both keep the trending and performance numbers honest.
import { run, json, http, readJson, isPlainObject, UUID } from '../api/http.mjs';
import { currentUser } from '../auth/current-user.mjs';

export const CLIENT_EVENT_TYPES = ['view', 'add_to_cart'];
export const DEDUPE_SECONDS = 30;

export function handleRecordEvent(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const body = await readJson(request);
    if (!isPlainObject(body)) throw http(400, 'bad_json', 'Send a JSON object as the request body.');
    const type = typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
    if (!CLIENT_EVENT_TYPES.includes(type)) throw http(400, 'bad_type', 'type must be "view" or "add_to_cart".');
    if (typeof body.product_id !== 'string' || !UUID.test(body.product_id)) throw http(400, 'bad_product_id', 'product_id is not valid.');
    const productId = body.product_id.toLowerCase();

    // A bad token must not turn into an anonymous event, so identity is resolved before anything is written.
    const hasAuth = request.headers.get('authorization');
    const user = await currentUser(request, db);
    if (hasAuth && !user) throw http(401, 'not_signed_in', 'Please sign in again.');

    const product = await db.getProduct(productId);
    const shop = product ? await db.getShop(product.shop_id) : null;
    if (!product || !shop || product.status !== 'active' || shop.verification_status === 'rejected')
      throw http(404, 'product_not_found', 'No product with that id.');

    if (user && user.id === shop.owner_id) return json(200, { data: { recorded: false, reason: 'own_product' } });
    if (user) {
      const since = new Date(now.getTime() - DEDUPE_SECONDS * 1000).toISOString();
      if (await db.hasRecentEvent(user.id, productId, type, since)) return json(200, { data: { recorded: false, reason: 'duplicate' } });
    }
    await db.insertEvent({ user_id: user?.id ?? null, product_id: productId, shop_id: product.shop_id, type });
    return json(201, { data: { recorded: true } });
  }, 'events');
}
