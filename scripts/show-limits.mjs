import { createClient } from '@supabase/supabase-js';
import { SCENARIOS, TOO_HIGH_FACTOR } from '../lib/ai/scenarios.mjs';
import { computeLimits } from '../lib/ai/guardrail.mjs';

const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(process.env.SUPABASE_URL, key);
const { data: products, error } = await db.from('products')
  .select('id,name,custom_category,category,gender,age_group,occasion_tags,price,discount_price,variants,status')
  .eq('status', 'active');
if (error) { console.error(error.message); process.exit(1); }

const rows = Object.entries(SCENARIOS).map(([key, sc]) => {
  const l = computeLimits(products, sc);
  return { scenario: key, too_low_below: l.floor, full_look_from: l.lowest, full_look_to: l.highest,
           too_high_above: l.highest * TOO_HIGH_FACTOR, missing: l.missingSlots.join(',') };
});
console.table(rows);
