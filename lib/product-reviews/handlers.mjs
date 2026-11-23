// Request handlers for product reviews. Identity comes only from lib/auth/current-user.mjs.
// A review needs a delivered (not refunded) order of the caller's own that contains the product. It is public right away
// (the purchase is the proof); an admin can hide it.
import { requireUser } from '../auth/current-user.mjs';
import { run, json, http, readJson, UUID } from '../api/http.mjs';
import { validateProductReview, checkEligible, displayName, LIMITS, STATUSES, ADMIN_SETTABLE } from './rules.mjs';

async function adminOf(request, db) {
  const user = await requireUser(request, db);
  if (!Array.isArray(user.roles) || !user.roles.includes('admin')) throw http(403, 'admin_only', 'Admins only.');
  return user;
}
const myView = (r) => (r ? { id: r.id, order_id: r.order_id, rating: r.rating, body: r.body, status: r.status, created_at: r.created_at } : null);

function productIdOf(params) {
  const id = params?.id;
  if (typeof id !== 'string' || !UUID.test(id)) throw http(400, 'bad_id', 'The product id in the URL is not valid.');
  return id.toLowerCase();
}
async function requireProduct(db, productId) {
  const p = await db.getProduct(productId);
  if (!p) throw http(404, 'product_not_found', 'No product with that id.');
  return p;
}

// GET /api/products/:id/reviews  (public, visible only)
export function handleListProductReviews(request, params, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const productId = productIdOf(params);
    await requireProduct(db, productId);
    const asked = Number(new URL(request.url).searchParams.get('limit'));
    const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, LIMITS.listMax) : 10;
    const rows = await db.listForProduct(productId, 'visible', limit);
    const users = new Map((await db.getUsersByIds([...new Set(rows.map((r) => r.user_id))])).map((u) => [u.id, u]));
    const summary = await db.ratingSummary(productId);
    return json(200, { data: {
      summary,
      reviews: rows.map((r) => ({ id: r.id, name: displayName(users.get(r.user_id)?.name), rating: r.rating, body: r.body, created_at: r.created_at, verified_purchase: true })),
    } });
  }, 'list product reviews');
}

// GET /api/products/:id/reviews/mine  -> which delivered order (if any) can still review this product, and my latest review
export function handleMyProductReview(request, params, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    const productId = productIdOf(params);
    await requireProduct(db, productId);
    const [orders, mine] = await Promise.all([db.listDeliveredOrdersWith(user.id, productId), db.listMyReviews(user.id, productId)]);
    const done = new Set(mine.map((r) => r.order_id));
    const open = orders.find((o) => !done.has(o.id));
    return json(200, { data: { eligible_order_id: open?.id ?? null, review: myView(mine[0] ?? null) } });
  }, 'my product review');
}

// POST /api/products/:id/reviews  { order_id, rating, body }
export function handleCreateProductReview(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    const productId = productIdOf(params);
    const v = validateProductReview(await readJson(request));
    if (!v.ok) throw http(400, 'invalid_review', v.message);
    await requireProduct(db, productId);
    const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    if ((await db.countRecentReviews(user.id, since)) >= LIMITS.perDay)
      throw http(429, 'too_many_reviews', 'Too many reviews in the last 24 hours. Please try again later.');
    const bad = checkEligible({ order: await db.getOrder(v.value.order_id), userId: user.id, productId });
    if (bad) throw http(bad.status, bad.code, bad.message);
    if (await db.getReviewFor(v.value.order_id, productId)) throw http(409, 'already_reviewed', 'You already reviewed this product for this order.');
    let row;
    try { row = await db.insertReview({ product_id: productId, user_id: user.id, ...v.value, status: 'visible' }); }
    catch (e) {
      if (e.code === 'duplicate') throw http(409, 'already_reviewed', 'You already reviewed this product for this order.');
      throw e;
    }
    return json(201, { data: { review: myView(row) } });
  }, 'create product review');
}

// GET /api/admin/product-reviews?status=visible|hidden
export function handleAdminListProductReviews(request, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    await adminOf(request, db);
    const status = new URL(request.url).searchParams.get('status') ?? 'visible';
    if (!STATUSES.includes(status)) throw http(400, 'bad_status', 'status must be one of: ' + STATUSES.join(', ') + '.');
    const rows = await db.listByStatus(status, 100);
    const users = new Map((await db.getUsersByIds([...new Set(rows.map((r) => r.user_id))])).map((u) => [u.id, u]));
    const products = new Map((await db.getProductsByIds([...new Set(rows.map((r) => r.product_id))])).map((p) => [p.id, p]));
    return json(200, { data: { reviews: rows.map((r) => ({
      id: r.id, product_id: r.product_id, product_name: products.get(r.product_id)?.name ?? null, order_id: r.order_id,
      user_id: r.user_id, name: users.get(r.user_id)?.name ?? null, rating: r.rating, body: r.body,
      status: r.status, created_at: r.created_at, decided_at: r.decided_at ?? null,
    })) } });
  }, 'admin list product reviews');
}

// PATCH /api/admin/product-reviews/:id  { status: "visible" | "hidden" }
export function handleAdminSetProductReviewStatus(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const admin = await adminOf(request, db);
    const id = params?.id;
    if (typeof id !== 'string' || !UUID.test(id)) throw http(400, 'bad_id', 'The id in the URL is not valid.');
    const status = (await readJson(request))?.status;
    if (!ADMIN_SETTABLE.includes(status)) throw http(400, 'bad_status', 'status must be visible or hidden.');
    if (!(await db.getReview(id))) throw http(404, 'review_not_found', 'No review with that id.');
    const row = await db.setStatus(id, status, admin.id, now.toISOString());
    if (!row) throw http(404, 'review_not_found', 'No review with that id.');
    return json(200, { data: { review: { id: row.id, status: row.status } } });
  }, 'admin set product review status');
}
