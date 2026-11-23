import { supabase } from './supabaseClient';

// Calls our own backend with the logged-in user's token.
// Use: const { data } = await api('/orders?as=customer');
export async function api(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(json?.error?.message || 'Request failed');
    e.code = json?.error?.code;
    e.status = res.status;
    throw e;
  }
  return json; // { data, meta? }
}