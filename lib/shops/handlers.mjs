// Request handlers for shops. Identity comes ONLY from lib/auth/current-user.mjs.
import { run, json, http, readJson, isPlainObject, UUID } from '../api/http.mjs';
import { currentUser, requireUser, hasRole } from '../auth/current-user.mjs';
import { validateShopInput, validateVerification, PREMIUM_PLANS, premiumExpiry } from './rules.mjs';
import { sendMail } from '../mail/send.mjs';

const isPremiumNow = (s, now) => s.plan === 'premium' && (!s.plan_expires_at || new Date(s.plan_expires_at) > now);

// Three views of one shop. The NID goes to admins only; owners just see whether one is on file.
export function toShopView(shop, viewer, now = new Date()) {
  const isAdmin = hasRole(viewer, 'admin');
  const isOwner = !!viewer && viewer.id === shop.owner_id;
  const featured = isPremiumNow(shop, now);
  const view = {
    id: shop.id, name: shop.name, description: shop.description ?? null, city: shop.city ?? null,
    social_url: shop.social_url ?? null, return_policy: shop.return_policy ?? null,
    verified: shop.verification_status === 'verified', featured, created_at: shop.created_at,
  };
  if (isOwner || isAdmin) {
    Object.assign(view, {
      verification_status: shop.verification_status, plan: featured ? 'premium' : 'free',
      plan_expires_at: featured ? shop.plan_expires_at ?? null : null, rejection_note: shop.rejection_note ?? null,
    });
  }
  if (isOwner) view.nid_set = !!shop.nid_number;
  if (isAdmin) { view.owner_id = shop.owner_id; view.nid_number = shop.nid_number ?? null; }
  return view;
}

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
async function loadShop(db, id) {
  const shop = await db.getShop(id);
  if (!shop) throw http(404, 'shop_not_found', 'No shop with that id.');
  return shop;
}

// POST /api/shops  (any signed-in user; creating a shop makes them a seller)
export function handleCreateShop(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    if (hasRole(user, 'admin')) throw http(403, 'admin_cannot_sell', 'Admin accounts cannot own a shop.');
    const body = await bodyOf(request);
    const { errors, value } = validateShopInput(body);
    if (errors.length) throw http(400, 'invalid_shop', errors.join(' '));
    if ((await db.getShopsByOwner(user.id)).length > 0) throw http(409, 'shop_exists', 'You already have a shop.');

    await db.addRole(user.id, 'seller');   // role first: a seller without a shop is harmless, a shop without the role is not
    const shop = await db.insertShop({
      owner_id: user.id, name: value.name, description: value.description ?? null, city: value.city ?? null,
      social_url: value.social_url ?? null, nid_number: value.nid_number ?? null, return_policy: value.return_policy ?? null,
      verification_status: 'pending', plan: 'free', plan_expires_at: null,
    });
    return json(201, { data: toShopView(shop, { ...user, roles: [...(user.roles ?? []), 'seller'] }, now) });
  }, 'shops');
}

// GET /api/shops/mine  (signed in; data is null when the user has no shop yet)
export function handleMyShop(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    const [shop] = await db.getShopsByOwner(user.id);
    return json(200, { data: shop ? toShopView(shop, user, now) : null });
  }, 'shops');
}

// GET /api/shops/:id  (public; rejected shops only for the owner and admins)
export function handleGetShop(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const shop = await loadShop(db, idParam(params));
    const viewer = await currentUser(request, db);
    if (shop.verification_status === 'rejected' && !(viewer && (viewer.id === shop.owner_id || hasRole(viewer, 'admin')))) {
      throw http(404, 'shop_not_found', 'No shop with that id.');
    }
    return json(200, { data: toShopView(shop, viewer, now) });
  }, 'shops');
}

// PATCH /api/shops/:id  (owner). Editing a rejected shop sends it back to review.
export function handlePatchShop(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const user = await requireUser(request, db);
    const shop = await loadShop(db, id);
    if (shop.owner_id !== user.id) throw http(403, 'not_your_shop', 'You can only change your own shop.');
    const body = await bodyOf(request);
    for (const k of ['verification_status', 'plan', 'plan_expires_at', 'owner_id', 'rejection_note']) {
      if (body[k] !== undefined) throw http(400, 'field_not_editable', `${k} cannot be changed here.`);
    }
    const { errors, value } = validateShopInput(body, { partial: true });
    if (errors.length) throw http(400, 'invalid_shop', errors.join(' '));
    if (Object.keys(value).length === 0) throw http(400, 'nothing_to_update', 'Send at least one field to change.');
    // A verified shop cannot swap its business name or NID without going back to review.
    const sensitive = value.name !== undefined && value.name !== shop.name || value.nid_number !== undefined && value.nid_number !== shop.nid_number;
    if (shop.verification_status === 'rejected' || (shop.verification_status === 'verified' && sensitive)) {
      value.verification_status = 'pending';
      value.rejection_note = null;
    }
    const updated = await db.updateShop(id, value);
    return json(200, { data: toShopView(updated, user, now) });
  }, 'shops');
}

// POST /api/shops/:id/premium  (owner; sandbox payment, no real money)
export function handleBuyPremium(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const user = await requireUser(request, db);
    const shop = await loadShop(db, id);
    if (shop.owner_id !== user.id) throw http(403, 'not_your_shop', 'You can only upgrade your own shop.');
    if (shop.verification_status === 'rejected') throw http(403, 'shop_rejected', 'A rejected shop cannot buy Premium.');
    const body = await bodyOf(request);
    const months = body.months;
    if (!Object.prototype.hasOwnProperty.call(PREMIUM_PLANS, months) || typeof months !== 'number') {
      throw http(400, 'bad_plan', 'months must be 1, 3 or 6.');
    }
    const expires = premiumExpiry(shop, months, now);
    const updated = await db.updateShop(id, { plan: 'premium', plan_expires_at: expires.toISOString() });
    return json(200, { data: { shop: toShopView(updated, user, now), paid: PREMIUM_PLANS[months], months, sandbox: true } });
  }, 'shops');
}

// GET /api/admin/shops?status=pending  (admin)
export function handleAdminListShops(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const admin = await requireUser(request, db);
    if (!hasRole(admin, 'admin')) throw http(403, 'admin_only', 'Admins only.');
    const sp = new URL(request.url).searchParams;
    const status = (sp.get('status') || 'pending').toLowerCase();
    if (!['pending', 'verified', 'rejected'].includes(status)) throw http(400, 'bad_status', 'status must be pending, verified or rejected.');
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') || '20', 10) || 20));
    const { rows, total } = await db.listShopsByStatus(status, page, limit);
    return json(200, { data: rows.map((s) => toShopView(s, admin, now)), meta: { page, limit, total } });
  }, 'shops');
}

// PATCH /api/admin/shops/:id/verification  (admin). Rejection needs a reason; the owner is emailed.
export function handleVerifyShop(request, params, dbOrFactory, { now = new Date(), mail = sendMail } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const admin = await requireUser(request, db);
    if (!hasRole(admin, 'admin')) throw http(403, 'admin_only', 'Admins only.');
    const shop = await loadShop(db, id);
    const body = await bodyOf(request);
    const v = validateVerification(body);
    if (v.error) throw http(400, 'invalid_decision', v.error);

    const updated = await db.updateShop(id, { verification_status: v.status, rejection_note: v.status === 'rejected' ? v.reason : null });

    // Emailing is best effort: the decision is already saved, and mail() never throws.
    let emailed = false;
    try {
      const to = await db.getUserEmail(shop.owner_id);
      const text = v.status === 'verified'
        ? `Good news: your shop "${shop.name}" is now verified on Dokan AI.`
        : `Your shop "${shop.name}" was not approved.\n\nReason: ${v.reason}\n\nYou can fix this in your shop settings and send it for review again.`;
      emailed = (await mail({ to, subject: v.status === 'verified' ? 'Your shop is verified' : 'Your shop needs changes', text })).sent === true;
    } catch (e) { console.error('verification mail failed:', e?.message ?? e); }

    return json(200, { data: { shop: toShopView(updated, admin, now), emailed } });
  }, 'shops');
}
