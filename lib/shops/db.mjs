// Database access for shops. The Supabase client is passed in, so this file is testable offline.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};
// nid_number is only ever selected here so the ADMIN view can show it; the public and owner views strip it.
const SHOP_COLS = 'id,owner_id,name,description,city,social_url,nid_number,verification_status,plan,plan_expires_at,return_policy,rejection_note,created_at';

export function createShopsDb(sb) {
  return {
    async getUser(id) {
      return must(await sb.from('users').select('id,name,roles').eq('id', id).maybeSingle(), 'load user');
    },
    async getUserByToken(token) {
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data?.user) return null;
      return must(await sb.from('users').select('id,name,roles').eq('auth_id', data.user.id).maybeSingle(), 'load user by token');
    },
    async getUserEmail(id) {
      const row = must(await sb.from('users').select('email').eq('id', id).maybeSingle(), 'load email');
      return row?.email ?? null;
    },
    async addRole(userId, role) {
      const row = must(await sb.from('users').select('roles').eq('id', userId).maybeSingle(), 'load roles');
      const roles = Array.isArray(row?.roles) ? row.roles : [];
      if (roles.includes(role)) return roles;
      must(await sb.from('users').update({ roles: [...roles, role] }).eq('id', userId), 'add role');
      return [...roles, role];
    },
    async getShop(id) {
      return must(await sb.from('shops').select(SHOP_COLS).eq('id', id).maybeSingle(), 'load shop');
    },
    async getShopsByOwner(ownerId) {
      return must(await sb.from('shops').select(SHOP_COLS).eq('owner_id', ownerId), 'load shops by owner') ?? [];
    },
    async insertShop(row) {
      const { data, error } = await sb.from('shops').insert(row).select(SHOP_COLS).single();
      if (error) throw new Error('save shop: ' + error.message);
      return data;
    },
    async updateShop(id, patch) {
      return must(await sb.from('shops').update(patch).eq('id', id).select(SHOP_COLS).maybeSingle(), 'update shop');
    },
    async listShopsByStatus(status, page, limit) {
      const from = (page - 1) * limit;
      const { data, error, count } = await sb.from('shops').select(SHOP_COLS, { count: 'exact' })
        .eq('verification_status', status).order('created_at', { ascending: true }).range(from, from + limit - 1);
      if (error) throw new Error('list shops: ' + error.message);
      return { rows: data ?? [], total: count ?? 0 };
    },
  };
}
