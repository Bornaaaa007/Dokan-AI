import { supabase } from './supabaseClient';

// Fetches a CSV from our API with the login token and saves it as a file.
// Use: await downloadCsv('/seller/ledger?format=csv', 'ledger.csv')
export async function downloadCsv(path, filename) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api' + path, { headers: session ? { Authorization: 'Bearer ' + session.access_token } : {} });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error?.message || 'Download failed');
  }
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}