import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.SUPABASE_URL || !key) { console.error('Missing SUPABASE_URL or secret key in .env'); process.exit(1); }
const db = createClient(process.env.SUPABASE_URL, key);
const IDS_FILE = 'scripts/seed-ids.json';
const inserted = { search_logs: [], event_logs: [] };
const save = () => fs.writeFileSync(IDS_FILE, JSON.stringify(inserted));

async function reset() {
  if (!fs.existsSync(IDS_FILE)) { console.log('Nothing to reset.'); return; }
  const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
  for (const table of ['search_logs', 'event_logs']) {
    const list = ids[table] || [];
    for (let i = 0; i < list.length; i += 50) {
      const { error } = await db.from(table).delete().in('id', list.slice(i, i + 50));
      if (error) { console.error(table + ': ' + error.message); process.exit(1); }
    }
    console.log('deleted ' + list.length + ' rows from ' + table);
  }
  fs.unlinkSync(IDS_FILE);
}
if (process.argv.includes('--reset')) { await reset(); process.exit(0); }
if (fs.existsSync(IDS_FILE)) { console.error('Already seeded. Run with --reset first.'); process.exit(1); }

// Fixed seed: the same shape of data every run
let s = 20261121;
const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DAY = 86400000;
const when = (recent) => new Date(Date.now() - (recent ? rnd() * 7 : rnd() * 29 + 0.5) * DAY).toISOString();

const { data: users, error: e1 } = await db.from('users').select('id');
const { data: shops, error: e2 } = await db.from('shops').select('id,name,verification_status');
const { data: products, error: e3 } = await db.from('products').select('id,shop_id,name,status').eq('status', 'active');
if (e1 || e2 || e3) { console.error((e1 || e2 || e3).message); process.exit(1); }
if (!users.length) { console.error('No users found'); process.exit(1); }

async function insertAll(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await db.from(table).insert(rows.slice(i, i + 500)).select('id');
    if (error) { console.error(table + ': ' + error.message); save(); process.exit(1); }
    inserted[table].push(...data.map((r) => r.id));
    save();
  }
}

// ---- Search logs: maroon sari is the top search, with only 1 listing
const SEARCHES = [
  ['maroon sari', { custom_category: 'sari', color: 'maroon' }, 1, 40],
  ['maroon saree', { custom_category: 'sari', color: 'maroon' }, 1, 20],
  ['maroon katan sari', { custom_category: 'sari', color: 'maroon' }, 1, 10],
  ['wedding sari', { custom_category: 'sari', occasion: 'wedding' }, 7, 30],
  ['kurti', { custom_category: 'kurti' }, 6, 28],
  ['three piece', { custom_category: 'three-piece' }, 5, 24],
  ['panjabi', { custom_category: 'panjabi' }, 6, 22],
  ['formal shirt', { custom_category: 'formal shirt' }, 5, 18],
  ['heels', { custom_category: 'heels' }, 3, 16],
  ['jhumka', { custom_category: 'earrings' }, 2, 14],
  ['kids frock', { custom_category: 'frock' }, 2, 12],
  ['blue jamdani sari', { custom_category: 'sari', color: 'blue' }, 2, 12],
  ['watch', { custom_category: 'watch' }, 4, 10],
  ['purple lehenga', { custom_category: 'lehenga', color: 'purple' }, 0, 2],
  ['lilac sari', { custom_category: 'sari', color: 'lilac' }, 0, 2],
];
const searchRows = [];
for (const [query, filters, result_count, n] of SEARCHES)
  for (let i = 0; i < n; i++) searchRows.push({ user_id: pick(users).id, query, filters, result_count, created_at: when(rnd() < 0.4) });

// ---- Product roles: best sellers, poor sellers, brand-new (no events), normal
const eligible = products.filter((p) => !p.name.startsWith('[DEMO]'));
const byShop = {};
for (const p of eligible) (byShop[p.shop_id] ||= []).push(p);
const role = {};
for (const list of Object.values(byShop))
  shuffle(list).forEach((p, i) => { role[p.id] = i < 2 ? 'best' : i === 2 ? 'poor' : i === 3 ? 'new' : 'normal'; });
const maroon = eligible.find((p) => p.name === 'Maroon Katan Silk Sari');
if (maroon) role[maroon.id] = 'best';

const events = [];
const add = (p, type, recent) => events.push({ user_id: pick(users).id, product_id: p.id, shop_id: p.shop_id, type, created_at: when(recent) });
for (const p of eligible) {
  const r = role[p.id];
  if (r === 'new') continue;
  const views = r === 'best' ? int(25, 45) : r === 'poor' ? int(30, 50) : int(3, 12);
  const carts = Math.round(views * (r === 'best' ? 0.25 : r === 'poor' ? 0.05 : 0.1));
  for (let i = 0; i < views; i++) add(p, 'view', r === 'best' && rnd() < 0.6);
  for (let i = 0; i < carts; i++) add(p, 'add_to_cart', r === 'best' && rnd() < 0.6);
}

// ---- Purchases: Nilima, Jewel Box and Panjabi Ghor are the top 3.
// New Trend Fashion is unverified, and the small shops stay under 5 purchases.
const QUOTA = { 'Nilima Boutique': 22, 'Jewel Box BD': 17, 'Panjabi Ghor': 12, 'Rongdhonu Collection': 4, 'Gentry Formals': 3, 'Step Up Footwear': 2, 'Little Star Kids': 3, 'New Trend Fashion': 6 };
for (const shop of shops) {
  const n = QUOTA[shop.name] ?? 0;
  const cands = (byShop[shop.id] || []).filter((p) => (role[p.id] === 'best' || role[p.id] === 'normal') && p.name !== 'Maroon Katan Silk Sari');
  const weighted = cands.flatMap((p) => Array(role[p.id] === 'best' ? 6 : 1).fill(p));
  if (!weighted.length) continue;
  for (let i = 0; i < n; i++) add(pick(weighted), 'purchase', rnd() < 0.5);
}

await insertAll('search_logs', searchRows);
await insertAll('event_logs', events);

const count = {};
for (const e of events) count[e.type] = (count[e.type] || 0) + 1;
const perShop = {};
for (const e of events) if (e.type === 'purchase') { const n = shops.find((x) => x.id === e.shop_id)?.name; perShop[n] = (perShop[n] || 0) + 1; }
console.log('search_logs: ' + searchRows.length);
console.log('event_logs:', count);
console.log('purchases by shop:', perShop);
