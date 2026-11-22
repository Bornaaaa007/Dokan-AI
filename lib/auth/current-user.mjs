// ONE place that answers "who is calling?". Every new route uses this, so real login only has to change this file.
//
// 1) Authorization: Bearer <token>  -> db.getUserByToken(token). Written for Supabase Auth
//    (users.auth_id links to auth.users). If the auth teammate issues their own tokens, change getUserByToken in db.mjs.
// 2) x-user-id header (demo mode)   -> db.getUser(id).
//    TODO(auth): delete this branch once login works, or set DISABLE_DEV_USER_HEADER=true in production.
import { UUID, http } from '../api/http.mjs';

export async function currentUser(request, db) {
  const auth = request.headers.get('authorization');
  if (auth) {
    const m = /^Bearer\s+(\S+)$/i.exec(auth.trim());
    if (!m || typeof db.getUserByToken !== 'function') return null;   // a bad token never falls back to the demo header
    return (await db.getUserByToken(m[1])) ?? null;
  }
  if (process.env.DISABLE_DEV_USER_HEADER === 'true') return null;
  const id = request.headers.get('x-user-id');
  if (!id || !UUID.test(id)) return null;
  return (await db.getUser(id)) ?? null;
}

export async function requireUser(request, db) {
  const user = await currentUser(request, db);
  if (!user) throw http(401, 'not_signed_in', 'Please sign in first.');
  return user;
}

export const hasRole = (user, role) => Array.isArray(user?.roles) && user.roles.includes(role);
