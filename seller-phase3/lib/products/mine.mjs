// GET /api/products/mine   (seller): every product of my own shop, INCLUDING hidden ones.
// The public list never shows hidden products, so a seller needs this to un-hide them.
import { run, json, http } from '../api/http.mjs';
import { requireUser, hasRole } from '../auth/current-user.mjs';
import { toPublicProduct } from './search.mjs';

export function handleMyProducts(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    if (!hasRole(user, 'seller')) throw http(403, 'seller_only', 'Only sellers have a product list.');
    const [shop] = await db.getShopsByOwner(user.id);
    if (!shop) return json(200, { data: [] });
    const rows = await db.listProductsByShop(shop.id);
    return json(200, { data: rows.map((p) => toPublicProduct(p, shop, now, { withDescription: true })) });
  }, 'my products');
}
