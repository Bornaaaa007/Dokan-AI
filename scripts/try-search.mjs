import { createClient } from '@supabase/supabase-js';
import { loadCatalog, searchScenario } from '../lib/ai/search.mjs';

const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(process.env.SUPABASE_URL, key);
const [scenario = 'wedding_woman', color] = process.argv.slice(2);

const catalog = await loadCatalog(db);
const res = searchScenario(catalog, scenario, { color });
console.log('scenario: ' + scenario + (color ? ' | colour: ' + color : ''));
console.log('limits: ' + res.limits.lowest + ' to ' + res.limits.highest);
for (const slot of res.slots) {
  console.log('\n' + slot.name.toUpperCase() + ' (' + slot.candidates.length + ')');
  console.table(slot.candidates.map((c) => ({
    name: c.name, price: c.price, shop: c.shop_name, verified: c.shop_verified, colour_match: c.color_match, sizes: c.sizes.join(','),
  })));
}
const all = res.slots.flatMap((s) => s.candidates.map((c) => c.name));
for (const name of ['[DEMO] Trendy Party Sari', 'Red Banarasi Style Sari', 'Sample Hidden Test Product'])
  console.log(name + ': ' + (all.includes(name) ? 'present' : 'absent'));
