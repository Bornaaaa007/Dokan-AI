import { createClient } from '@supabase/supabase-js';
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.SUPABASE_URL || !key) {
  console.error('Missing SUPABASE_URL or the secret key in .env');
  process.exit(1);
}
const db = createClient(process.env.SUPABASE_URL, key);
const { count, error } = await db.from('products').select('*', { count: 'exact', head: true });
console.log(error ?? 'products: ' + count);
