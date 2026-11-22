// Request handlers for orders and sandbox payment.
// Identity comes ONLY from lib/auth/current-user.mjs. Money and stock changes run as database functions.
import { run, json, http, readJson, isPlainObject, UUID } from '../api/http.mjs';
import { requireUser, hasRole } from '../auth/current-user.mjs';
import { charge as sandboxCharge, GATEWAYS, OUTCOMES } from '../payments/sandbox.mjs';
import { validateOrderInput, parseListQuery, computeCommission, checkTransition, DELIVERY_CHARGE, ESCROW_HOURS } from './rules.mjs';

const lc = (s) => String(s ?? '').trim().toLowerCase();
const effectivePrice = (p) => (p.discount_price != null && p.discount_price < p.price ? p.discount_price : p.price);

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
const RPC_ERRORS = {
  product_unavailable: [409, 'One of the products is no longer available.'],
  variant_unavailable: [409, 'That size or colour is no longer available.'],
  out_of_stock: [409, 'Not enough stock for one of the items.'],
  order_not_found: [404, 'No order with that id.'],
  already_cancelled: [409, 'This order is already cancelled.'],
  cannot_cancel: [409, 'This order can no longer be cancelled.'],
};
async function rpc(fn) {
  try { return await fn(); } catch (e) {
    const known = e.code === 'rpc' ? RPC_ERRORS[e.message] : null;
    if (known) throw http(known[0], e.message, known[1]);
    throw e;
  }
}

// The same order looks different to each party: only seller and admin see commission, only the customer's own
// side sees what is due online, and the address goes to the people who need it to deliver.
function orderView(o, role, { shop, customer } = {}) {
  const base = {
    id: o.id, shop_id: o.shop_id, shop_name: shop?.name ?? null, items: o.items ?? [],
    item_total: o.item_total, delivery_charge: o.delivery_charge, total: o.item_total + o.delivery_charge,
    amount_due_online: o.payment_method === 'cod' ? o.delivery_charge : o.item_total + o.delivery_charge,
    payment_method: o.payment_method, payment_status: o.payment_status, status: o.status,
    placed_at: o.placed_at, delivered_at: o.delivered_at ?? null, delivery_address: o.delivery_address ?? null, my_role: role,
  };
  if (role === 'customer') return base;
  return { ...base, customer: { id: o.customer_id, name: customer?.name ?? null }, commission_rate: Number(o.commission_rate), commission_amount: o.commission_amount, seller_payout: o.item_total - o.commission_amount };
}

// Who is this person for this order? Strangers get a 404 so order ids cannot be probed.
async function partyFor(db, user, order) {
  const shop = await db.getShop(order.shop_id);
  if (hasRole(user, 'admin')) return { role: 'admin', shop };
  if (shop && user.id === shop.owner_id) return { role: 'seller', shop };
  if (user.id === order.customer_id) return { role: 'customer', shop };
  throw http(404, 'order_not_found', 'No order with that id.');
}
async function loadOrder(db, id) {
  const order = await db.getOrder(id);
  if (!order) throw http(404, 'order_not_found', 'No order with that id.');
  return order;
}
async function viewFor(db, order, role, shop) {
  const customer = role === 'customer' ? null : (await db.getUsersByIds([order.customer_id]))[0];
  return orderView(order, role, { shop, customer });
}

// POST /api/orders   (customer; one shop per order, the frontend splits a mixed cart)
export function handleCreateOrder(request, _params, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    if (hasRole(user, 'admin')) throw http(403, 'admin_cannot_buy', 'Admins cannot place orders.');
    const { errors, value } = validateOrderInput(await bodyOf(request));
    if (errors.length) throw http(400, 'invalid_order', errors.join(' '));

    const products = new Map((await db.getProductsByIds([...new Set(value.items.map((i) => i.product_id))])).map((p) => [p.id, p]));
    const shopIds = new Set();
    const lines = [];
    for (const it of value.items) {
      const p = products.get(it.product_id);
      if (!p || p.status !== 'active') throw http(404, 'product_not_found', 'One of the products does not exist or is no longer available.');
      shopIds.add(p.shop_id);
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const match = variants.filter((v) => lc(v?.size) === lc(it.size) && (!it.color || lc(v?.color) === it.color));
      if (match.length === 0) throw http(409, 'variant_unavailable', `${p.name}: that size or colour does not exist.`);
      if (match.length > 1) throw http(400, 'color_required', `${p.name}: choose a colour.`);
      if (!(Number(match[0].stock) >= it.qty)) throw http(409, 'out_of_stock', `${p.name}: only ${Math.max(0, Number(match[0].stock) || 0)} left in that size.`);
      lines.push({ product_id: p.id, name: p.name, size: match[0].size, color: lc(match[0].color), qty: it.qty, unit_price: effectivePrice(p), image_url: (p.image_urls ?? [])[0] ?? null });
    }
    if (shopIds.size > 1) throw http(400, 'multiple_shops', 'One order can only hold items from one shop. Place a separate order for each shop.');
    const shop = await db.getShop([...shopIds][0]);
    if (!shop || shop.verification_status === 'rejected') throw http(404, 'shop_not_found', 'This shop is not available.');
    if (shop.owner_id === user.id) throw http(400, 'own_shop', 'You cannot order from your own shop.');

    const itemTotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
    const order = await rpc(() => db.placeOrder({
      customerId: user.id, shopId: shop.id, items: lines, itemTotal, deliveryCharge: DELIVERY_CHARGE,
      method: value.payment_method, address: value.delivery_address,
    }));
    return json(201, { data: orderView(order, 'customer', { shop }) });
  }, 'orders');
}

// GET /api/orders?as=customer|seller|admin&status=&page=&limit=
export function handleListOrders(request, _params, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    const { errors, value } = parseListQuery(new URL(request.url).searchParams);
    if (errors.length) throw http(400, 'bad_query', errors.join(' '));
    const q = { status: value.status, page: value.page, limit: value.limit };
    if (value.as === 'customer') q.customerId = user.id;
    else if (value.as === 'admin') { if (!hasRole(user, 'admin')) throw http(403, 'admin_only', 'Admins only.'); }
    else {
      if (!hasRole(user, 'seller')) throw http(403, 'seller_only', 'Only sellers have shop orders.');
      const mine = await db.getShopsByOwner(user.id);
      if (!mine.length) return json(200, { data: [], meta: { page: value.page, limit: value.limit, total: 0 } });
      q.shopId = mine[0].id;
    }
    const { rows, total } = await db.listOrders(q);
    const shops = new Map((await db.getShopsByIds([...new Set(rows.map((r) => r.shop_id))])).map((s) => [s.id, s]));
    const users = new Map((value.as === 'customer' ? [] : await db.getUsersByIds([...new Set(rows.map((r) => r.customer_id))])).map((u) => [u.id, u]));
    const data = rows.map((o) => orderView(o, value.as, { shop: shops.get(o.shop_id), customer: users.get(o.customer_id) }));
    return json(200, { data, meta: { page: value.page, limit: value.limit, total } });
  }, 'orders');
}

// GET /api/orders/:id   (the customer, the shop owner or an admin)
export function handleGetOrder(request, params, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const user = await requireUser(request, db);
    const order = await loadOrder(db, id);
    const { role, shop } = await partyFor(db, user, order);
    return json(200, { data: await viewFor(db, order, role, shop) });
  }, 'orders');
}

// PATCH /api/orders/:id/status   { status: accepted | packed | shipped | delivered | cancelled }
export function handleUpdateStatus(request, params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const user = await requireUser(request, db);
    const order = await loadOrder(db, id);
    const { role, shop } = await partyFor(db, user, order);
    const body = await bodyOf(request);
    const to = typeof body.status === 'string' ? lc(body.status) : '';
    if (!['accepted', 'packed', 'shipped', 'delivered', 'cancelled'].includes(to)) throw http(400, 'bad_status', 'status must be accepted, packed, shipped, delivered or cancelled.');
    const bad = checkTransition({ order, to, actor: role });
    if (bad) throw http(bad.status, bad.code, bad.message);

    let updated;
    if (to === 'cancelled') updated = await rpc(() => db.cancelOrder(id));
    else {
      updated = await db.updateStatus(id, order.status, to === 'delivered' ? { status: to, delivered_at: now.toISOString() } : { status: to });
      if (!updated) throw http(409, 'status_changed', 'The order was changed by someone else. Reload and try again.');
      // The customer confirming receipt releases the escrow at once, unless a complaint is open.
      if (to === 'delivered' && role === 'customer') {
        try { if (await db.releaseOrder(id)) updated = (await db.getOrder(id)) ?? updated; } catch (e) { console.error('release failed:', e?.message ?? e); }
      }
    }
    return json(200, { data: await viewFor(db, updated, role, shop) });
  }, 'orders');
}

// POST /api/orders/:id/pay   { gateway?: bkash|nagad|card, outcome?: success|failure|pending }   (the customer)
// Sandbox order: pays items + delivery. Cash on delivery: pays only the delivery charge online (PRD 6.3).
export function handlePayOrder(request, params, dbOrFactory, { gateway = { charge: sandboxCharge }, now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const user = await requireUser(request, db);
    const order = await loadOrder(db, id);
    if (order.customer_id !== user.id) throw http(404, 'order_not_found', 'No order with that id.');
    const body = (await readJson(request)) ?? {};
    if (!isPlainObject(body)) throw http(400, 'bad_json', 'Send a JSON object, or no body.');
    const gw = body.gateway === undefined ? 'bkash' : lc(body.gateway);
    const outcome = body.outcome === undefined ? 'success' : lc(body.outcome);
    if (!GATEWAYS.includes(gw)) throw http(400, 'bad_gateway', `gateway must be one of: ${GATEWAYS.join(', ')}.`);
    if (!OUTCOMES.includes(outcome)) throw http(400, 'bad_outcome', `outcome must be one of: ${OUTCOMES.join(', ')}.`);
    if (order.status === 'cancelled') throw http(409, 'order_cancelled', 'This order was cancelled.');
    if (!['pending', 'failed'].includes(order.payment_status)) throw http(409, 'already_paid', 'This order has already been paid.');

    const amount = order.payment_method === 'cod' ? order.delivery_charge : order.item_total + order.delivery_charge;
    const result = gateway.charge({ amount, gateway: gw, outcome });
    const shop = await db.getShop(order.shop_id);
    if (result.status === 'pending') return json(202, { data: { payment: { status: 'pending', reference: result.reference, amount, gateway: gw }, order: orderView(order, 'customer', { shop }) } });
    if (result.status === 'failed') {
      await db.markPaymentFailed(id);
      return json(402, { error: { code: 'payment_failed', message: 'The sandbox payment failed. You can try again.' }, data: { payment: { status: 'failed', reference: result.reference, amount, gateway: gw } } });
    }

    // Success: the money is held in escrow and the commission is fixed on the order.
    const c = computeCommission(order.items);
    const paid = await db.markPaid(id, { payment_status: 'held', commission_rate: c.commission_rate, commission_amount: c.commission_amount, paid_at: now.toISOString() });
    if (!paid) throw http(409, 'already_paid', 'This order has already been paid.');
    // One purchase event per product feeds trending and performance. A logging problem must not undo the payment.
    try {
      await db.insertEvents([...new Set(order.items.map((i) => i.product_id))].map((pid) => ({ user_id: user.id, product_id: pid, shop_id: order.shop_id, type: 'purchase' })));
    } catch (e) { console.error('purchase events failed:', e?.message ?? e); }
    return json(200, { data: { payment: { status: 'success', reference: result.reference, amount, gateway: gw }, order: orderView(paid, 'customer', { shop }) } });
  }, 'orders');
}

// POST /api/admin/orders/:id/refund   (admins; full refund of money still held in escrow)
export function handleAdminRefund(request, params, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const id = idParam(params);
    const admin = await requireUser(request, db);
    if (!hasRole(admin, 'admin')) throw http(403, 'admin_only', 'Admins only.');
    const order = await loadOrder(db, id);
    if (!(await rpc(() => db.refundOrder(id)))) throw http(409, 'not_refundable', 'Only an order whose money is still held in escrow can be refunded.');
    console.log('[audit] order %s fully refunded by admin %s', id, admin.id);
    const shop = await db.getShop(order.shop_id);
    return json(200, { data: await viewFor(db, (await db.getOrder(id)) ?? order, 'admin', shop) });
  }, 'orders');
}

// POST /api/admin/payouts/release   (admins; releases escrow 48 hours after delivery when no complaint is open)
export function handleReleaseDue(request, _params, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const admin = await requireUser(request, db);
    if (!hasRole(admin, 'admin')) throw http(403, 'admin_only', 'Admins only.');
    const cutoff = new Date(now.getTime() - ESCROW_HOURS * 3600 * 1000).toISOString();
    const ids = await rpc(() => db.releaseDue(cutoff));
    console.log('[audit] %d orders released by admin %s', ids.length, admin.id);
    return json(200, { data: { released: ids.length, order_ids: ids } });
  }, 'orders');
}
