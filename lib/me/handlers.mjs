// GET /api/me: the signed-in user, their roles and (for sellers) their shop.
// Identity comes only from lib/auth/current-user.mjs.
import { run, json, http } from '../api/http.mjs';
import { requireUser, hasRole } from '../auth/current-user.mjs';

export function handleMe(request, _params, dbOrFactory) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    const p = await db.getProfile(user.id);
    if (!p) throw http(401, 'not_signed_in', 'Please sign in first.');
    let shop = null;
    if (hasRole(p, 'seller')) {
      const mine = await db.getShopsByOwner(p.id);
      const s = mine[0];
      if (s) shop = { id: s.id, name: s.name, verification_status: s.verification_status, plan: s.plan, plan_expires_at: s.plan_expires_at ?? null };
    }
    return json(200, { data: {
      id: p.id, name: p.name, email: p.email ?? null, phone: p.phone ?? null, roles: p.roles ?? [],
      gender: p.gender ?? null, age_group: p.age_group ?? null, created_at: p.created_at, shop,
    } });
  }, 'me');
}
