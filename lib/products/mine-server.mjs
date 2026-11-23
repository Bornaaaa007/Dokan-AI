// Server-only: uses the SECRET key. Never import this file from browser code.
import { createClient } from '@supabase/supabase-js';
import { createProductsDb } from './db.mjs';

const COLS = 'id,shop_id,name,description,custom_category,category,gender,age_group,colors,occasion_tags,image_urls,price,discount_price,variants,status,created_at';

export function createServerDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } });
  return {
    ...createProductsDb(sb),
    async listProductsByShop(shopId) {
      const { data, error } = await sb.from('products').select(COLS).eq('shop_id', shopId).order('created_at', { ascending: false }).limit(500);
      if (error) throw new Error('list my products: ' + error.message);
      return data ?? [];
    },
  };
}
