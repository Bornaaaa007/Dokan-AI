// Usage: node --env-file=.env scripts/try-analytics.mjs "Nilima Boutique"
import { createClient } from '@supabase/supabase-js';
import { createAnalyticsDb } from '../lib/analytics/db.mjs';
import { buildSellerAnalytics, buildAdminInsights } from '../lib/analytics/shape.mjs';

const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } });
const db = createAnalyticsDb(sb);
const name = process.argv[2] || 'Nilima Boutique';

const { data: found, error } = await sb.from('shops').select('id').eq('name', name).maybeSingle();
if (error || !found) { console.error('Shop not found: ' + name + (error ? ' (' + error.message + ')' : '')); process.exit(1); }

const shop = await db.getShop(found.id);
const [performance, topSellers, demand, trending] = await Promise.all([
  db.getPerformance(found.id), db.getTopSellers(), db.getDemandGap(), db.getTrending(),
]);

const seller = buildSellerAnalytics({ shop, performance, trending, demand, topSellers });
console.log('=== seller analytics for ' + name + ' (' + seller.shop.plan + ')');
console.log(JSON.stringify(seller.summary));
console.log('top seller rank:', seller.shop.top_seller_rank);
if (seller.locked) console.log('Free plan: basic stats only.');
for (const i of seller.insights) console.log(' * ' + i.title + ': ' + i.text);

const admin = buildAdminInsights({ demand, trending, topSellers });
console.log('\n=== admin insights');
admin.suggestions.forEach((s) => console.log(' * ' + s));
console.log('top sellers:', admin.top_sellers.map((t) => t.rank + '. ' + t.name + ' (' + t.purchases_30d + ')').join(', '));
