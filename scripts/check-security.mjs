// Proves the database is closed to the public key. Run AFTER scripts/security.sql.
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
for (const fn of ['place_order', 'cancel_order', 'release_order', 'release_due_orders', 'refund_order']) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: '{}' });
  report(!r.ok && r.status !== 200, `anonymous cannot call ${fn}`, 'HTTP ' + r.status);
}
console.log(bad ? `\n${bad} check(s) FAILED: run scripts/security.sql (and scripts/orders.sql for the functions).` : '\nAll checks passed.');
process.exit(bad ? 1 : 0);
