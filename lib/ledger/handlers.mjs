// Payment ledger (PRD PAY-5). Sellers download their own shop's ledger; admins download everything.
// Identity comes ONLY from lib/auth/current-user.mjs.
import { run, json, http } from '../api/http.mjs';
import { requireUser, hasRole } from '../auth/current-user.mjs';
import { parseLedgerQuery, dateRangeIso, toEntry, summarize, toCsv, dhakaToday, tooMany, MAX_ROWS } from './rules.mjs';

async function build(db, q, role, shopId) {
  const { start, end } = dateRangeIso(q);
  const rows = await db.listLedgerOrders({ shopId, status: q.status, startIso: start, endIso: end });
  if (rows.length > MAX_ROWS) throw tooMany();
  const shops = new Map((await db.getShopsByIds([...new Set(rows.map((r) => r.shop_id))])).map((s) => [s.id, s]));
  const entries = rows.map((r) => toEntry(r, { shop: shops.get(r.shop_id) }, role));
  return { entries, summary: summarize(entries) };
}

function reply(q, role, { entries, summary }, now, name) {
  if (q.format === 'csv') {
    return new Response(toCsv(entries, role), { status: 200, headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${name}-${dhakaToday(now)}.csv"`,
    } });
  }
  const from = (q.page - 1) * q.limit;
  return json(200, { data: { entries: entries.slice(from, from + q.limit), summary }, meta: { page: q.page, limit: q.limit, total: entries.length } });
}

// GET /api/seller/ledger?format=json|csv&status=held|released|refunded&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&limit=
// A seller always gets their own shop. Shop owners only; admins use /api/admin/ledger.
export function handleSellerLedger(request, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    if (!hasRole(user, 'seller')) throw http(403, 'seller_only', 'Only sellers have a shop ledger.');
    const { errors, value: q } = parseLedgerQuery(new URL(request.url).searchParams, { isAdmin: false });
    if (errors.length) throw http(400, 'bad_query', errors.join(' '));
    const mine = await db.getShopsByOwner(user.id);
    if (!mine.length) return reply(q, 'seller', { entries: [], summary: summarize([]) }, now, 'dokan-ledger');
    return reply(q, 'seller', await build(db, q, 'seller', mine[0].id), now, 'dokan-ledger');
  }, 'ledger');
}

// GET /api/admin/ledger   same filters, plus shop_id=<uuid> to look at one shop
export function handleAdminLedger(request, dbOrFactory, { now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const admin = await requireUser(request, db);
    if (!hasRole(admin, 'admin')) throw http(403, 'admin_only', 'Admins only.');
    const { errors, value: q } = parseLedgerQuery(new URL(request.url).searchParams, { isAdmin: true });
    if (errors.length) throw http(400, 'bad_query', errors.join(' '));
    const result = await build(db, q, 'admin', q.shopId);
    if (q.format === 'csv') console.log('[audit] ledger CSV (%d rows) downloaded by admin %s', result.entries.length, admin.id);
    return reply(q, 'admin', result, now, 'dokan-ledger-all');
  }, 'ledger');
}
