// Proves the database is closed to the public key. Run AFTER scripts/security.sql and scripts/orders.sql.
// Usage: node --env-file=.env.local scripts/check-security.mjs
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (the same two the login page uses).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'); process.exit(1); }
const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
let bad = 0;
const report = (ok, what, detail = '') => { if (!ok) bad++; console.log((ok ? 'PASS  ' : 'FAIL  ') + what + (detail ? '  (' + detail + ')' : '')); };

const tables = ['users', 'shops', 'products', 'orders', 'complaints', 'badges', 'search_logs', 'event_logs', 'ai_conversations'];
for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: H });
  const body = await r.json().catch(() => null);
  report(r.ok && Array.isArray(body) && body.length === 0, `anonymous cannot read ${t}`, Array.isArray(body) ? body.length + ' rows' : 'HTTP ' + r.status);
}
for (const v of ['demand_gap', 'trending_products', 'product_performance', 'top_sellers']) {
  const r = await fetch(`${url}/rest/v1/${v}?select=*&limit=1`, { headers: H });
  const body = await r.json().catch(() => null);
  report(!r.ok || (Array.isArray(body) && body.length === 0), `anonymous cannot read view ${v}`, 'HTTP ' + r.status);
}
for (const [t, row] of [['badges', { user_id: '00000000-0000-4000-8000-000000000000', role: 'seller' }], ['complaints', { reason_code: 'other' }], ['users', { name: 'x', roles: ['admin'] }], ['event_logs', { type: 'view' }]]) {
  const r = await fetch(`${url}/rest/v1/${t}`, { method: 'POST', headers: H, body: JSON.stringify(row) });
  report(!r.ok, `anonymous cannot write to ${t}`, 'HTTP ' + r.status);
}

// The functions take arguments, so each call sends the real parameter names. With empty arguments Supabase
// answers 404 whether the function exists or not, which proves nothing. Only a permission error counts as locked.
const ZERO = '00000000-0000-4000-8000-000000000000';
const rpcCalls = {
  place_order: { p_customer: ZERO, p_shop: ZERO, p_items: [], p_item_total: 0, p_delivery: 0, p_method: 'sandbox', p_address: {} },
  cancel_order: { p_order: ZERO },
  release_order: { p_order: ZERO },
  release_due_orders: { p_cutoff: '2000-01-01T00:00:00Z' },
  refund_order: { p_order: ZERO },
};
for (const [fn, args] of Object.entries(rpcCalls)) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  const body = await r.text();
  const locked = r.status === 401 || r.status === 403 || /permission denied/i.test(body);
  report(locked, `anonymous is blocked from ${fn}`, 'HTTP ' + r.status + (r.status === 404 ? ', function missing: run scripts/orders.sql' : ''));
}
console.log(bad ? `\n${bad} check(s) FAILED: run scripts/security.sql (and scripts/orders.sql for the functions).` : '\nAll checks passed.');
process.exit(bad ? 1 : 0);