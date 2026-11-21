// Calls the Dokan AI stylist Edge Function on Supabase.
// Needs ONE env var in your Next.js project's .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=https://btkxjvaguppnzdexrlrn.supabase.co
// (The function was deployed with --no-verify-jwt, so no key is needed for the demo.)
// Restart `npm run dev` after editing .env.local.

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function askStylist({ message, conversationId }) {
  if (!BASE) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local and restart the dev server.');
  let res;
  try {
    res = await fetch(`${BASE}/functions/v1/stylist-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversation_id: conversationId || undefined }),
    });
  } catch {
    throw new Error('Could not reach the stylist. Check your internet connection.');
  }
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(json?.error?.message || `The stylist returned an error (${res.status}).`);
  return json.data;
}