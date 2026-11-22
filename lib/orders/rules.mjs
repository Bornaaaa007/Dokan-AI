// Pure order rules: input checks, prices, commission, and the allowed status changes. No database here.
import { UUID } from '../api/http.mjs';

export const DELIVERY_CHARGE = 80;
export const ESCROW_HOURS = 48;
export const PAYMENT_METHODS = ['sandbox', 'cod'];
export const LIMITS = { lines: 20, qty: 10, size: 20, color: 20, text: 120, page_max: 50 };
// Admin-editable later. The rate depends on the unit price after discount (PRD section 6.1).
export const COMMISSION_BANDS = [{ below: 500, rate: 0.02 }, { below: 1000, rate: 0.03 }, { below: Infinity, rate: 0.05 }];

export const commissionRate = (unitPrice) => COMMISSION_BANDS.find((b) => unitPrice < b.below).rate;

// Commission on the item price only, never on delivery. The amount is authoritative;
// the stored rate is the effective rate (exact when all lines fall in one band).
export function computeCommission(items) {
  const itemTotal = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const amount = items.reduce((s, i) => s + Math.round(i.unit_price * i.qty * commissionRate(i.unit_price)), 0);
  return { item_total: itemTotal, commission_amount: amount, commission_rate: itemTotal ? Math.round((amount / itemTotal) * 100) / 100 : 0 };
}

const lc = (s) => String(s).trim().toLowerCase();
const text = (v, max) => (typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= max ? v.trim().replace(/\s+/g, ' ') : null);

export function validateOrderInput(body) {
  const errors = [];
  const value = {};
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > LIMITS.lines) {
    errors.push(`items must be a list of 1 to ${LIMITS.lines} lines.`);
  } else {
    const merged = new Map();
    for (const it of body.items) {
      const size = typeof it?.size === 'string' ? it.size.trim() : '';
      const color = it?.color == null || it.color === '' ? '' : typeof it.color === 'string' ? lc(it.color) : null;
      if (typeof it?.product_id !== 'string' || !UUID.test(it.product_id) || !size || size.length > LIMITS.size || color === null || color.length > LIMITS.color ||
          !Number.isInteger(it.qty) || it.qty < 1 || it.qty > LIMITS.qty) {
        errors.push(`Each item needs product_id, size, an optional color and qty from 1 to ${LIMITS.qty}.`);
        break;
      }
      const key = [it.product_id.toLowerCase(), lc(size), color].join('|');
      const prev = merged.get(key);
      if (prev) prev.qty += it.qty; else merged.set(key, { product_id: it.product_id.toLowerCase(), size, color, qty: it.qty });
    }
    if (!errors.length) {
      const lines = [...merged.values()];
      if (lines.some((l) => l.qty > LIMITS.qty)) errors.push(`Quantity per line is at most ${LIMITS.qty}.`); else value.items = lines;
    }
  }
  const method = body.payment_method === undefined ? 'sandbox' : typeof body.payment_method === 'string' ? lc(body.payment_method) : '';
  if (!PAYMENT_METHODS.includes(method)) errors.push(`payment_method must be one of: ${PAYMENT_METHODS.join(', ')}.`); else value.payment_method = method;

  const a = body.delivery_address;
  if (!a || typeof a !== 'object' || Array.isArray(a)) errors.push('delivery_address is required: { name, phone, line1, city }.');
  else {
    const phone = typeof a.phone === 'string' ? a.phone.replace(/[\s-]/g, '') : '';
    const addr = { name: text(a.name, LIMITS.text), phone, line1: text(a.line1, 200), city: text(a.city, 60), area: a.area == null || a.area === '' ? null : text(a.area, 60) };
    if (!addr.name || !addr.line1 || !addr.city || !/^\+?[0-9]{10,15}$/.test(phone) || (a.area != null && a.area !== '' && !addr.area)) errors.push('delivery_address needs a name, a phone number (10 to 15 digits), line1 and city.');
    else value.delivery_address = addr;
  }
  return { errors, value };
}

export function parseListQuery(sp) {
  const errors = [];
  const as = (sp.get('as') ?? 'customer').toLowerCase();
  if (!['customer', 'seller', 'admin'].includes(as)) errors.push('as must be customer, seller or admin.');
  const status = sp.get('status');
  if (status && !['placed', 'accepted', 'packed', 'shipped', 'delivered', 'cancelled'].includes(status.toLowerCase())) errors.push('status is not valid.');
  const int = (k, def, min, max) => { const s = sp.get(k); if (s == null || s === '') return def; if (!/^\d+$/.test(s) || Number(s) < min || Number(s) > max) { errors.push(`${k} must be between ${min} and ${max}.`); return def; } return Number(s); };
  return { errors, value: { as, status: status ? status.toLowerCase() : undefined, page: int('page', 1, 1, 100000), limit: int('limit', 20, 1, LIMITS.page_max) } };
}

const NEXT = { placed: ['accepted', 'cancelled'], accepted: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['delivered'] };
const NEEDS_PAYMENT = new Set(['accepted', 'packed', 'shipped']);
const PAID = new Set(['paid', 'held', 'released']);

// actor: 'seller' | 'customer' | 'admin'. Returns null when allowed, otherwise { status, code, message }.
export function checkTransition({ order, to, actor }) {
  if (!(NEXT[order.status] ?? []).includes(to)) return { status: 409, code: 'bad_transition', message: `An order that is ${order.status} cannot become ${to}.` };
  if (actor === 'customer') {
    const ok = (to === 'cancelled' && order.status === 'placed') || (to === 'delivered' && order.status === 'shipped');
    if (!ok) return { status: 403, code: 'customer_cannot', message: 'Customers can cancel an order before it is accepted, or confirm that a shipped order arrived.' };
  }
  if (NEEDS_PAYMENT.has(to) && !PAID.has(order.payment_status)) return { status: 409, code: 'payment_required', message: 'The order has not been paid yet.' };
  return null;
}
