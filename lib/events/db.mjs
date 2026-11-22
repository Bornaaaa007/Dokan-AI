// Database access for events. The Supabase client is passed in, so this file is testable offline.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};

export function createEventsDb(sb) {
  return {
    async getUser(id) {
      return must(await sb.from('users').select('id,name,roles').eq('id', id).maybeSingle(), 'load user');
    },
    // Written for Supabase Auth: the token belongs to auth.users, and users.auth_id links to it.
    async getUserByToken(token) {
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data?.user) return null;
      return must(await sb.from('users').select('id,name,roles').eq('auth_id', data.user.id).maybeSingle(), 'load user by token');
    },
    async getProduct(id) {
      return must(await sb.from('products').select('id,shop_id,status').eq('id', id).maybeSingle(), 'load product');
    },
    // Never selects nid_number.
    async getShop(id) {
      return must(await sb.from('shops').select('id,owner_id,verification_status').eq('id', id).maybeSingle(), 'load shop');
    },
    async hasRecentEvent(userId, productId, type, sinceIso) {
      const { count, error } = await sb.from('event_logs').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('product_id', productId).eq('type', type).gte('created_at', sinceIso);
      if (error) throw new Error('check recent event: ' + error.message);
      return (count ?? 0) > 0;
    },
    async insertEvent(row) {
      must(await sb.from('event_logs').insert(row), 'save event');
    },
  };
}
