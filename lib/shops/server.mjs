// Server-only: uses the SECRET key. Never import this file from browser code.
import { createClient } from '@supabase/supabase-js';
import { createShopsDb } from './db.mjs';

export function createServerDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
  return createShopsDb(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } }));
}
