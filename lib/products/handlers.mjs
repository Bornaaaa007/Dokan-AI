// Request handlers for the product endpoints.
// Identity comes ONLY from lib/auth/current-user.mjs, so real login needs no change in this file.
import { run, json, http, readJson, isPlainObject, UUID } from '../api/http.mjs';
import { currentUser, requireUser, hasRole } from '../auth/current-user.mjs';
import { validateProductInput, checkPrices, parseSearchQuery } from './rules.mjs';
import { searchCatalog, toPublicProduct, deriveLogFilters, shouldLogSearch } from './search.mjs';

function idParam(params) {
  const id = params?.id;
  if (typeof id !== 'string' || !UUID.test(id)) throw http(400, 'bad_id', 'The id in the URL is not valid.');
  return id.toLowerCase();
}
async function bodyOf(request) {
  const body = await readJson(request);
  if (!isPlainObject(body)) throw http(400, 'bad_json', 'Send a JSON object as the request body.');
  return body;
}

// GET /api/products   (public)
export function handleListProducts(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const { errors, value } = parseSearchQuery(new URL(request.url).searchParams);
    if (errors.length) throw http(400, 'bad_query', errors.join(' '));

    const rows = await db.listActiveProducts();
    const shops = new Map((await db.getShopsByIds([...new Set(rows.map((r) => r.shop_id))])).map((s) => [s.id, s]));
    const { items, total } = searchCatalog(rows, shops, value, now);

    // The search log feeds the demand-gap view. A logging problem must never break the search itself.
    if (shouldLogSearch(value)) {
      try {
        const user = await currentUser(request, db);
        await db.insertSearchLog({ user_id: user?.id ?? null, query: value.q ?? null, filters: deriveLogFilters(value, rows), result_count: total });
      } catch (e) { console.error('search log failed:', e?.message ?? e); }
    }
    return json(200, { data: items, meta: { page: value.page, limit: value.limit, total } });
  }, 'products');
}

// GET /api/products/:id   (public; hidden products only for their owner or an admin)
export function handleGetProduct(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const p = await db.getProduct(id);
    const shop = p ? await db.getShop(p.shop_id) : null;
    if (!p || !shop) throw http(404, 'product_not_found', 'No product with that id.');
    if (p.status !== 'active' || shop.verification_status === 'rejected') {
      const user = await currentUser(request, db);
      if (!(user && (user.id === shop.owner_id || hasRole(user, 'admin')))) throw http(404, 'product_not_found', 'No product with that id.');
    }
    return json(200, { data: toPublicProduct(p, shop, now, { withDescription: true }) });
  }, 'products');
}

// POST /api/products   (seller, for their own shop)
export function handleCreateProduct(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    if (!hasRole(user, 'seller')) throw http(403, 'seller_only', 'Only sellers can add products.');
    const body = await bodyOf(request);

    let shop;
    if (body.shop_id !== undefined) {
      if (typeof body.shop_id !== 'string' || !UUID.test(body.shop_id)) throw http(400, 'bad_shop_id', 'shop_id is not valid.');
      shop = await db.getShop(body.shop_id.toLowerCase());
      if (!shop || shop.owner_id !== user.id) throw http(403, 'not_your_shop', 'You can only add products to your own shop.');
    } else {
      const mine = await db.getShopsByOwner(user.id);
      if (mine.length === 0) throw http(409, 'no_shop', 'Create your shop before adding products.');
      if (mine.length > 1) throw http(400, 'shop_id_required', 'You have more than one shop: send shop_id.');
      shop = mine[0];
    }
    if (shop.verification_status === 'rejected') throw http(403, 'shop_rejected', 'This shop was rejected and cannot add products.');

    const { errors, value } = validateProductInput(body);
    const priceError = checkPrices(value.price, value.discount_price);
    if (priceError) errors.push(priceError);
    if (errors.length) throw http(400, 'invalid_product', errors.join(' '));

    const row = await db.insertProduct({
      shop_id: shop.id, name: value.name, description: value.description ?? null, category: value.category,
      custom_category: value.custom_category ?? null, gender: value.gender, age_group: value.age_group,
      colors: value.colors ?? [], occasion_tags: value.occasion_tags ?? [], image_urls: value.image_urls ?? [],
      price: value.price, discount_price: value.discount_price ?? null, variants: value.variants, status: value.status ?? 'active',
    });
    return json(201, { data: toPublicProduct(row, shop, now, { withDescription: true }) });
  }, 'products');
}

// PATCH /api/products/:id   (the owner, or an admin who may only change status)
export function handlePatchProduct(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const user = await requireUser(request, db);
    const p = await db.getProduct(id);
    const shop = p ? await db.getShop(p.shop_id) : null;
    if (!p || !shop) throw http(404, 'product_not_found', 'No product with that id.');

    const isOwner = shop.owner_id === user.id;
    const isAdmin = hasRole(user, 'admin');
    if (!isOwner && !isAdmin) {
      throw p.status === 'active' ? http(403, 'not_your_product', 'You can only change your own products.') : http(404, 'product_not_found', 'No product with that id.');
    }
    const body = await bodyOf(request);
    if (body.shop_id !== undefined && String(body.shop_id).toLowerCase() !== p.shop_id) throw http(400, 'cannot_move_product', 'A product cannot be moved to another shop.');
    delete body.shop_id;
    if (!isOwner && Object.keys(body).some((k) => k !== 'status')) throw http(403, 'admin_status_only', 'Admins can only change a product\'s status.');
    if (isOwner && shop.verification_status === 'rejected') throw http(403, 'shop_rejected', 'This shop was rejected and cannot change products.');

    const { errors, value } = validateProductInput(body, { partial: true });
    if (Object.keys(value).length === 0 && errors.length === 0) throw http(400, 'nothing_to_update', 'Send at least one field to change.');
    const priceError = checkPrices(value.price ?? p.price, value.discount_price !== undefined ? value.discount_price : p.discount_price);
    if (priceError) errors.push(priceError);
    if (errors.length) throw http(400, 'invalid_product', errors.join(' '));

    const updated = await db.updateProduct(id, value);
    if (!updated) throw http(404, 'product_not_found', 'No product with that id.');
    return json(200, { data: toPublicProduct(updated, shop, now, { withDescription: true }) });
  }, 'products');
}
