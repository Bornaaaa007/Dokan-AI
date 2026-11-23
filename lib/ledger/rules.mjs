// Pure ledger rules (PRD PAY-5): turn paid orders into ledger entries, add them up, write CSV. No database here.
import { http, UUID } from '../api/http.mjs';

export const LEDGER_STATUSES = ['held', 'released', 'refunded'];
// An order has a ledger entry once money has moved. `pending` and `failed` payments never reach the ledger.
export const LEDGER_DB_STATUSES = ['paid', 'held', 'released', 'refunded'];
export const MAX_ROWS = 10000;
export const PAGE_MAX = 200;
const DHAKA_OFFSET_HOURS = 6;

// Money seen by the platform for one order. Seller payout = item price minus commission (PAY-3).
export function toEntry(o, { shop, customer } = {}, role = 'seller') {
  const itemTotal = o.item_total;
  const commission = o.commission_amount ?? 0;
  const payout = itemTotal - commission;
  const paidOnline = o.payment_method === 'cod' ? o.delivery_charge : itemTotal + o.delivery_charge;
  const status = o.payment_status === 'paid' ? 'held' : o.payment_status;
  const entry = {
    order_id: o.id,
    shop_id: o.shop_id,
    shop_name: shop?.name ?? null,
    payment_method: o.payment_method,
    item_total: itemTotal,
    delivery_charge: o.delivery_charge,
    order_total: itemTotal + o.delivery_charge,
    paid_online: paidOnline,
    commission_rate: Number(o.commission_rate ?? 0),
    commission_amount: commission,
    seller_payout: payout,
    escrow_status: status,
    order_status: o.status,
    // What has actually settled: nothing is booked or paid out until the escrow is released.
    commission_booked: status === 'released' ? commission : 0,
    paid_to_seller: status === 'released' ? payout : 0,
    refunded_amount: status === 'refunded' ? paidOnline : 0,
    placed_at: o.placed_at ?? null,
    paid_at: o.paid_at ?? null,
    delivered_at: o.delivered_at ?? null,
    released_at: o.released_at ?? null,
    refunded_at: o.refunded_at ?? null,
  };
  if (role === 'admin') entry.customer_id = o.customer_id;
  return entry;
}

const sum = (rows, k) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
export function summarize(entries) {
  const by = (s) => entries.filter((e) => e.escrow_status === s);
  return {
    orders: entries.length,
    item_total: sum(entries, 'item_total'),
    in_escrow: sum(by('held'), 'seller_payout'),
    commission_booked: sum(entries, 'commission_booked'),
    paid_to_sellers: sum(entries, 'paid_to_seller'),
    refunded: sum(entries, 'refunded_amount'),
    orders_held: by('held').length,
    orders_released: by('released').length,
    orders_refunded: by('refunded').length,
  };
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

export function parseLedgerQuery(sp, { isAdmin }) {
  const errors = [];
  const format = (sp.get('format') ?? 'json').toLowerCase();
  if (!['json', 'csv'].includes(format)) errors.push('format must be json or csv.');
  const status = sp.get('status') ? sp.get('status').toLowerCase() : undefined;
  if (status && !LEDGER_STATUSES.includes(status)) errors.push(`status must be one of: ${LEDGER_STATUSES.join(', ')}.`);
  const from = sp.get('from') || undefined;
  const to = sp.get('to') || undefined;
  if (from && !isDate(from)) errors.push('from must be a date like 2026-11-01.');
  if (to && !isDate(to)) errors.push('to must be a date like 2026-11-30.');
  if (from && to && isDate(from) && isDate(to) && from > to) errors.push('from must not be after to.');
  const shopId = sp.get('shop_id') || undefined;
  if (shopId && isAdmin && !UUID.test(shopId)) errors.push('shop_id is not valid.');
  const int = (k, def, min, max) => { const s = sp.get(k); if (s == null || s === '') return def; if (!/^\d+$/.test(s) || Number(s) < min || Number(s) > max) { errors.push(`${k} must be between ${min} and ${max}.`); return def; } return Number(s); };
  const value = {
    format, status, from, to,
    shopId: isAdmin && shopId ? shopId.toLowerCase() : undefined,   // a seller can never pick another shop
    page: int('page', 1, 1, 100000), limit: int('limit', 50, 1, PAGE_MAX),
  };
  return { errors, value };
}

// Dates are in Dhaka time (UTC+6, no daylight saving). "to" is the whole last day.
export function dateRangeIso({ from, to }) {
  const start = from ? new Date(`${from}T00:00:00+06:00`).toISOString() : undefined;
  const end = to ? new Date(new Date(`${to}T00:00:00+06:00`).getTime() + 86400000).toISOString() : undefined;
  return { start, end };   // start inclusive, end exclusive
}

export function toDhaka(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t + DHAKA_OFFSET_HOURS * 3600000).toISOString().slice(0, 16).replace('T', ' ');
}
export const dhakaToday = (now = new Date()) => toDhaka(now.toISOString()).slice(0, 10);

// CSV cells that start with = + - @ are read as formulas by Excel. Shop names come from users, so neutralise them.
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const COLUMNS = [
  ['Order ID', 'order_id'], ['Placed (Dhaka)', 'placed_at', 'date'], ['Paid (Dhaka)', 'paid_at', 'date'], ['Delivered (Dhaka)', 'delivered_at', 'date'],
  ['Released (Dhaka)', 'released_at', 'date'], ['Refunded (Dhaka)', 'refunded_at', 'date'], ['Shop', 'shop_name'], ['Payment method', 'payment_method'],
  ['Item total (BDT)', 'item_total'], ['Delivery (BDT)', 'delivery_charge'], ['Order total (BDT)', 'order_total'], ['Paid online (BDT)', 'paid_online'],
  ['Commission rate', 'commission_rate'], ['Commission (BDT)', 'commission_amount'], ['Seller payout (BDT)', 'seller_payout'],
  ['Escrow status', 'escrow_status'], ['Order status', 'order_status'],
  ['Commission booked (BDT)', 'commission_booked'], ['Paid to seller (BDT)', 'paid_to_seller'], ['Refunded (BDT)', 'refunded_amount'],
];

// UTF-8 with a byte order mark so Excel shows Bangla shop names correctly.
export function toCsv(entries, role = 'seller') {
  const cols = role === 'admin' ? [...COLUMNS, ['Customer ID', 'customer_id']] : COLUMNS;
  const lines = [cols.map((c) => csvCell(c[0])).join(',')];
  for (const e of entries) lines.push(cols.map(([, k, kind]) => csvCell(kind === 'date' ? toDhaka(e[k]) : e[k])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export const tooMany = () => http(413, 'too_many_rows', `The ledger has more than ${MAX_ROWS} rows. Narrow it with from and to dates.`);
