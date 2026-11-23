import test from 'node:test';
import assert from 'node:assert/strict';
import { toEntry, summarize, parseLedgerQuery, dateRangeIso, toDhaka, csvCell, toCsv } from './rules.mjs';

const order = (o = {}) => ({ id: 'o1', customer_id: 'c1', shop_id: 's1', item_total: 600, delivery_charge: 80, commission_rate: 0.03, commission_amount: 18, payment_method: 'sandbox', payment_status: 'held', status: 'placed', placed_at: '2026-11-22T10:00:00Z', paid_at: '2026-11-22T10:05:00Z', ...o });
const sp = (s) => new URLSearchParams(s);

test('entry: 600 BDT items, 80 delivery, 3% commission', () => {
  const e = toEntry(order(), { shop: { name: 'Nilima' } });
  assert.equal(e.order_total, 680); assert.equal(e.paid_online, 680);
  assert.equal(e.commission_amount, 18); assert.equal(e.seller_payout, 582);
  assert.equal(e.commission_booked, 0); assert.equal(e.paid_to_seller, 0);   // still in escrow
  assert.equal(e.customer_id, undefined);                                    // sellers never see the customer id
});
test('entry: released books the commission and pays the seller', () => {
  const e = toEntry(order({ payment_status: 'released' }));
  assert.equal(e.commission_booked, 18); assert.equal(e.paid_to_seller, 582); assert.equal(e.refunded_amount, 0);
});
test('entry: refunded books nothing and returns the money paid online', () => {
  const e = toEntry(order({ payment_status: 'refunded' }));
  assert.equal(e.commission_booked, 0); assert.equal(e.paid_to_seller, 0); assert.equal(e.refunded_amount, 680);
});
test('entry: cash on delivery pays only the delivery charge online', () => {
  assert.equal(toEntry(order({ payment_method: 'cod' })).paid_online, 80);
});
test('entry: admin view carries the customer id', () => assert.equal(toEntry(order(), {}, 'admin').customer_id, 'c1'));
test('summary adds up each state', () => {
  const s = summarize([toEntry(order()), toEntry(order({ id: 'o2', payment_status: 'released' })), toEntry(order({ id: 'o3', payment_status: 'refunded' }))]);
  assert.deepEqual(s, { orders: 3, item_total: 1800, in_escrow: 582, commission_booked: 18, paid_to_sellers: 582, refunded: 680, orders_held: 1, orders_released: 1, orders_refunded: 1 });
});
test('query: defaults, bad values, and seller cannot choose a shop', () => {
  assert.equal(parseLedgerQuery(sp(''), { isAdmin: false }).value.format, 'json');
  assert.ok(parseLedgerQuery(sp('format=xml'), { isAdmin: false }).errors.length);
  assert.ok(parseLedgerQuery(sp('status=pending'), { isAdmin: false }).errors.length);
  assert.ok(parseLedgerQuery(sp('from=2026-02-30'), { isAdmin: false }).errors.length);
  assert.ok(parseLedgerQuery(sp('from=2026-12-01&to=2026-11-01'), { isAdmin: false }).errors.length);
  assert.ok(parseLedgerQuery(sp('limit=500'), { isAdmin: false }).errors.length);
  const sid = '00000000-0000-4000-8000-000000000020';
  assert.equal(parseLedgerQuery(sp('shop_id=' + sid), { isAdmin: false }).value.shopId, undefined);
  assert.equal(parseLedgerQuery(sp('shop_id=' + sid), { isAdmin: true }).value.shopId, sid);
  assert.ok(parseLedgerQuery(sp('shop_id=nope'), { isAdmin: true }).errors.length);
});
test('date range uses Dhaka days and includes the whole last day', () => {
  assert.deepEqual(dateRangeIso({ from: '2026-11-01', to: '2026-11-30' }), { start: '2026-10-31T18:00:00.000Z', end: '2026-11-30T18:00:00.000Z' });
  assert.deepEqual(dateRangeIso({}), { start: undefined, end: undefined });
});
test('toDhaka shifts by 6 hours and tolerates empty values', () => {
  assert.equal(toDhaka('2026-11-22T20:30:00Z'), '2026-11-23 02:30');
  assert.equal(toDhaka(null), ''); assert.equal(toDhaka('junk'), '');
});
test('csv cells: quoting and formula guard', () => {
  assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"'); assert.equal(csvCell('+1'), "'+1"); assert.equal(csvCell('@a'), "'@a");
  assert.equal(csvCell(0), '0'); assert.equal(csvCell(null), '');
});
test('csv: BOM, header, one row per entry, customer column only for admin', () => {
  const e = toEntry(order(), { shop: { name: '=cmd' } }, 'admin');
  const seller = toCsv([toEntry(order(), { shop: { name: 'Nilima' } })]);
  assert.ok(seller.startsWith('﻿Order ID,'));
  assert.equal(seller.trim().split('\r\n').length, 2);
  assert.ok(!seller.includes('Customer ID'));
  const admin = toCsv([e], 'admin');
  assert.ok(admin.includes('Customer ID')); assert.ok(admin.includes("'=cmd"));
  assert.ok(admin.includes('2026-11-22 16:05'));   // paid_at in Dhaka time
});
