// Request handlers for platform reviews (the "what do you think of Dokan AI" reviews on the home page).
// Identity comes only from lib/auth/current-user.mjs.
import { requireUser } from '../auth/current-user.mjs';
import { run, json, http, readJson, UUID } from '../api/http.mjs';
import { validateReview, displayName, summarize, LIMITS, STATUSES, ADMIN_SETTABLE } from './rules.mjs';

async function adminOf(request, db) {
  const user = await requireUser(request, db);
  if (!Array.isArray(user.roles) || !user.roles.includes('admin')) throw http(403, 'admin_only', 'Admins only.');
  return user;
}
const myView = (r) => (r ? { id: r.id, rating: r.rating, body: r.body, status: r.status, created_at: r.created_at } : null);

// GET /api/reviews  (public, approved only)
export function handleListReviews(request, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const asked = Number(new URL(request.url).searchParams.get('limit'));
    const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, LIMITS.listMax) : 6;
    const rows = await db.listByStatus('approved', limit);
    const users = new Map((await db.getUsersByIds([...new Set(rows.map((r) => r.user_id))])).map((u) => [u.id, u]));
    const summary = summarize(await db.approvedRatings());
    return json(200, { data: {
      summary,
      reviews: rows.map((r) => ({ id: r.id, name: displayName(users.get(r.user_id)?.name), rating: r.rating, body: r.body, created_at: r.created_at })),
    } });
  }, 'list reviews');
}

// POST /api/reviews  { rating, body }  -> saved as "pending" until an admin approves it
export function handleCreateReview(request, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    const v = validateReview(await readJson(request));
    if (!v.ok) throw http(400, 'invalid_review', v.message);
    if (await db.getMyReview(user.id)) throw http(409, 'already_reviewed', 'You already sent a review.');
    let row;
    try { row = await db.insertReview({ user_id: user.id, ...v.value, status: 'pending' }); }
    catch (e) {
      if (e.code === 'duplicate') throw http(409, 'already_reviewed', 'You already sent a review.');
      throw e;
    }
    return json(201, { data: { review: myView(row) } });
  }, 'create review');
}

// GET /api/reviews/mine
export function handleMyReview(request, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    return json(200, { data: { review: myView(await db.getMyReview(user.id)) } });
  }, 'my review');
}

// GET /api/admin/reviews?status=pending|approved|hidden
export function handleAdminListReviews(request, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    await adminOf(request, db);
    const status = new URL(request.url).searchParams.get('status') ?? 'pending';
    if (!STATUSES.includes(status)) throw http(400, 'bad_status', 'status must be one of: ' + STATUSES.join(', ') + '.');
    const rows = await db.listByStatus(status, 100);
    const users = new Map((await db.getUsersByIds([...new Set(rows.map((r) => r.user_id))])).map((u) => [u.id, u]));
    return json(200, { data: { reviews: rows.map((r) => ({
      id: r.id, user_id: r.user_id, name: users.get(r.user_id)?.name ?? null, rating: r.rating, body: r.body,
      status: r.status, created_at: r.created_at, decided_at: r.decided_at ?? null,
    })) } });
  }, 'admin list reviews');
}

// PATCH /api/admin/reviews/:id  { status: "approved" | "hidden" }
export function handleAdminSetStatus(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const admin = await adminOf(request, db);
    const id = params?.id;
    if (typeof id !== 'string' || !UUID.test(id)) throw http(400, 'bad_id', 'The id in the URL is not valid.');
    const body = await readJson(request);
    const status = body?.status;
    if (!ADMIN_SETTABLE.includes(status)) throw http(400, 'bad_status', 'status must be approved or hidden.');
    if (!(await db.getReview(id))) throw http(404, 'review_not_found', 'No review with that id.');
    const row = await db.setStatus(id, status, admin.id, now.toISOString());
    if (!row) throw http(404, 'review_not_found', 'No review with that id.');
    return json(200, { data: { review: { id: row.id, status: row.status } } });
  }, 'admin set review status');
}
