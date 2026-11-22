// Request handlers for the complaint endpoints.
// Identity (demo mode): the acting user's id comes in the "x-user-id" header.
// TODO (when real login exists): replace actorOf() with verification of the signed-in user's token.
import { validateFile, validateRespond, validateDecision, responseDueAt, LIMITS, BADGE_LABEL, BADGE_LEVEL } from './rules.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN = ['submitted', 'responded'];
const ALL_STATUSES = ['submitted', 'responded', 'upheld', 'rejected', 'appealed'];
const DECIDED = new Set(['upheld', 'rejected']);

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const http = (status, code, message) => new HttpError(status, code, message);
const resolveDb = (d) => (typeof d === 'function' ? d() : d);

async function run(dbOrFactory, fn) {
  try {
    return await fn(resolveDb(dbOrFactory));
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: { code: e.code, message: e.message } });
    console.error('complaints error:', e);
    return json(500, { error: { code: 'internal', message: 'Something went wrong. Please try again.' } });
  }
}

async function readJson(request) {
  try { return await request.json(); } catch { return undefined; }
}
async function actorOf(request, db) {
  const id = request.headers.get('x-user-id');
  if (!id || !UUID.test(id)) throw http(401, 'not_signed_in', 'Send the signed-in user id in the x-user-id header.');
  const user = await db.getUser(id);
  if (!user) throw http(401, 'not_signed_in', 'Unknown user.');
  return user;
}
async function adminOf(request, db) {
  const user = await actorOf(request, db);
  if (!Array.isArray(user.roles) || !user.roles.includes('admin')) throw http(403, 'admin_only', 'Admins only.');
  return user;
}
function idParam(params) {
  const id = params?.id;
  if (typeof id !== 'string' || !UUID.test(id)) throw http(400, 'bad_id', 'The id in the URL is not valid.');
  return id;
}

// What a party to the complaint may see: never who decided it, and the note only after the decision.
function partyView(c, viewerId) {
  const mine = c.filed_by === viewerId ? 'filer' : 'accused';
  return {
    id: c.id, order_id: c.order_id, my_role: mine,
    reason_code: c.reason_code, description: c.description, evidence_urls: c.evidence_urls ?? [],
    response_text: c.response_text ?? null, response_evidence_urls: c.response_evidence_urls ?? [],
    status: c.status,
    decision_note: DECIDED.has(c.status) ? (c.decision_note ?? null) : null,
    response_due_at: mine === 'accused' && c.status === 'submitted' ? responseDueAt(c.created_at).toISOString() : null,
    created_at: c.created_at, responded_at: c.responded_at ?? null, decided_at: c.decided_at ?? null,
  };
}
function adminView(c) {
  return {
    id: c.id, order_id: c.order_id,
    filed_by: c.filed_by, filed_by_role: c.filed_by_role, accused_id: c.accused_id, accused_role: c.accused_role,
    reason_code: c.reason_code, description: c.description, evidence_urls: c.evidence_urls ?? [],
    response_text: c.response_text ?? null, response_evidence_urls: c.response_evidence_urls ?? [],
    status: c.status, decision_note: c.decision_note ?? null, decided_by: c.decided_by ?? null,
    created_at: c.created_at, responded_at: c.responded_at ?? null, decided_at: c.decided_at ?? null,
  };
}

// POST /api/orders/:id/complaints
export function handleFileComplaint(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const orderId = idParam(params);
    const actor = await actorOf(request, db);
    const body = await readJson(request);
    const order = await db.getOrder(orderId);
    const shop = order ? await db.getShop(order.shop_id) : null;
    if (!order || !shop) throw http(404, 'order_not_found', 'No order with that id.');
    if (order.customer_id === shop.owner_id) throw http(400, 'self_order', 'A complaint cannot be filed on an order from your own shop.');

    let role, accusedId, accusedRole;
    if (actor.id === order.customer_id) { role = 'customer'; accusedId = shop.owner_id; accusedRole = 'seller'; }
    else if (actor.id === shop.owner_id) { role = 'seller'; accusedId = order.customer_id; accusedRole = 'customer'; }
    else throw http(403, 'not_your_order', 'Only the customer or the shop owner of this order can file a complaint.');

    if (order.status === 'cancelled') throw http(409, 'order_cancelled', 'A cancelled order cannot have a complaint.');
    const v = validateFile(body, role);
    if (!v.ok) throw http(400, 'invalid_complaint', v.message);
    if (await db.findComplaint(orderId, actor.id)) throw http(409, 'already_filed', 'You already filed a complaint on this order.');
    const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    if ((await db.countRecentComplaints(actor.id, since)) >= LIMITS.filesPer24h)
      throw http(429, 'too_many_complaints', 'Too many complaints in the last 24 hours. Please try again later.');

    let row;
    try {
      row = await db.insertComplaint({ order_id: orderId, filed_by: actor.id, accused_id: accusedId, filed_by_role: role, accused_role: accusedRole, ...v.value });
    } catch (e) {
      if (e.code === 'duplicate') throw http(409, 'already_filed', 'You already filed a complaint on this order.');
      throw e;
    }
    return json(201, { data: partyView(row, actor.id) });
  });
}

// GET /api/complaints/mine
export function handleMyComplaints(request, _params, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const actor = await actorOf(request, db);
    const rows = await db.listForUser(actor.id);
    return json(200, { data: { complaints: rows.map((c) => partyView(c, actor.id)) } });
  });
}

// POST /api/complaints/:id/respond
export function handleRespond(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const actor = await actorOf(request, db);
    const body = await readJson(request);
    const c = await db.getComplaint(id);
    if (!c) throw http(404, 'complaint_not_found', 'No complaint with that id.');
    if (actor.id !== c.accused_id) throw http(403, 'not_accused', 'Only the accused party can respond to this complaint.');
    if (c.status !== 'submitted') throw http(409, 'not_open_for_response', 'This complaint is no longer waiting for a response.');
    const v = validateRespond(body);
    if (!v.ok) throw http(400, 'invalid_response', v.message);
    const saved = await db.saveResponse(id, actor.id, { ...v.value, responded_at: now.toISOString() });
    if (!saved) throw http(409, 'not_open_for_response', 'This complaint is no longer waiting for a response.');
    return json(200, { data: partyView(saved, actor.id) });
  });
}

// GET /api/admin/complaints?status=open|submitted|responded|upheld|rejected|appealed
export function handleAdminList(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    await adminOf(request, db);
    const status = new URL(request.url).searchParams.get('status') ?? 'open';
    const statuses = status === 'open' ? OPEN : ALL_STATUSES.includes(status) ? [status] : null;
    if (!statuses) throw http(400, 'bad_status', 'status must be open or one of: ' + ALL_STATUSES.join(', ') + '.');
    const rows = await db.listByStatus(statuses);
    const users = new Map((await db.getUsersByIds([...new Set(rows.flatMap((c) => [c.filed_by, c.accused_id]))])).map((u) => [u.id, u]));
    const who = (id, role) => ({ id, name: users.get(id)?.name ?? null, role });
    return json(200, { data: { complaints: rows.map((c) => {
      const due = responseDueAt(c.created_at);
      return {
        id: c.id, order_id: c.order_id, status: c.status, reason_code: c.reason_code,
        filed_by: who(c.filed_by, c.filed_by_role), accused: who(c.accused_id, c.accused_role),
        created_at: c.created_at, response_due_at: due.toISOString(),
        response_overdue: c.status === 'submitted' && now > due, has_response: Boolean(c.response_text),
      };
    }) } });
  });
}

// GET /api/admin/complaints/:id
export function handleAdminDetail(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    await adminOf(request, db);
    const c = await db.getComplaint(id);
    if (!c) throw http(404, 'complaint_not_found', 'No complaint with that id.');
    const order = await db.getOrder(c.order_id);
    const shop = order ? await db.getShop(order.shop_id) : null;
    const users = new Map((await db.getUsersByIds([c.filed_by, c.accused_id])).map((u) => [u.id, u]));
    const [upheldBefore, badges] = await Promise.all([db.countUpheldAgainst(c.accused_id), db.getActiveBadges(c.accused_id, now.toISOString())]);
    const due = responseDueAt(c.created_at);
    return json(200, { data: {
      complaint: adminView(c),
      filed_by: { id: c.filed_by, name: users.get(c.filed_by)?.name ?? null, role: c.filed_by_role },
      accused: { id: c.accused_id, name: users.get(c.accused_id)?.name ?? null, role: c.accused_role },
      order: order ? { ...order, shop_name: shop?.name ?? null } : null,
      response_due_at: due.toISOString(),
      response_overdue: c.status === 'submitted' && now > due,
      responded_late: c.responded_at ? new Date(c.responded_at) > due : null,
      accused_history: { upheld_before: upheldBefore - (c.status === 'upheld' ? 1 : 0), has_active_badge: badges.some((b) => b.role === c.accused_role) },
    } });
  });
}

const RPC_ERRORS = {
  complaint_not_found: [404, 'No complaint with that id.'],
  already_decided: [409, 'This complaint has already been decided.'],
  admin_required: [403, 'Admins only.'],
  conflict_of_interest: [403, 'You cannot decide a complaint you are a party to.'],
  note_required: [400, 'A written decision_note of at least 10 characters is required.'],
  invalid_outcome: [400, 'outcome must be "upheld" or "rejected".'],
};

// PATCH /api/admin/complaints/:id/decision
export function handleDecision(request, params, dbOrFactory, { issueBadges = false } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const admin = await adminOf(request, db);
    const v = validateDecision(await readJson(request));
    if (!v.ok) throw http(400, 'invalid_decision', v.message);
    const { outcome, decision_note, proof_confirmed } = v.value;

    let result;
    try {
      result = await db.decide({ complaintId: id, adminId: admin.id, outcome, note: decision_note, issueBadge: issueBadges && outcome === 'upheld' && proof_confirmed });
    } catch (e) {
      const known = e.code === 'rpc' ? RPC_ERRORS[e.message] : null;
      if (known) throw http(known[0], e.message, known[1]);
      throw e;
    }
    let badgeNote = null;
    if (outcome === 'upheld') {
      badgeNote = !proof_confirmed ? 'No badge: proof was not confirmed.'
        : !issueBadges ? 'No badge: badge issuing is switched off.'
        : result.badge_created ? 'Badge issued.' : 'The accused already has an active badge.';
    }
    return json(200, { data: {
      complaint: adminView(result.complaint),
      badge_issued: Boolean(result.badge_created),
      badge_expires_at: result.badge_created ? result.badge.expires_at : null,
      badge_note: badgeNote,
    } });
  });
}

// Public badge status: label and level only, never complaint details or the other party.
function badgeView(badges, role) {
  const roles = [...new Set(badges.filter((b) => !role || b.role === role).map((b) => b.role))];
  const has = roles.length > 0;
  return { has_badge: has, label: has ? BADGE_LABEL : null, level: has ? BADGE_LEVEL : null, roles };
}

// GET /api/users/:id/badge
export function handleUserBadge(_request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    return json(200, { data: badgeView(await db.getActiveBadges(id, now.toISOString())) });
  });
}

// GET /api/shops/:id/badge  (the shop owner's seller badge)
export function handleShopBadge(_request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const shop = await db.getShop(id);
    if (!shop) throw http(404, 'shop_not_found', 'No shop with that id.');
    return json(200, { data: badgeView(await db.getActiveBadges(shop.owner_id, now.toISOString()), 'seller') });
  });
}
