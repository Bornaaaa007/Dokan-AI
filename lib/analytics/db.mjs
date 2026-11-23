// Reads the analytics views through the Supabase client. The client is passed in, so this file is testable offline.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};

export function createAnalyticsDb(sb) {
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
    async getShopsByOwner(ownerId) {
      return (must(await sb.from('shops').select('id,name,plan,plan_expires_at').eq('owner_id', ownerId), 'load shops by owner')) ?? [];
    },
    async getShop(id) {
      return must(await sb.from('shops').select('id,name,plan,plan_expires_at').eq('id', id).maybeSingle(), 'load shop');
    },
    async getPerformance(shopId) {
      return (must(await sb.from('product_performance').select('*').eq('shop_id', shopId), 'load performance')) ?? [];
    },
    async getDemandGap() {
      return (must(await sb.from('demand_gap').select('*').order('opportunity_score', { ascending: false }).limit(50), 'load demand gap')) ?? [];
    },
    async getTrending() {
      return (must(await sb.from('trending_products').select('*').order('score_7d', { ascending: false }).limit(200), 'load trending')) ?? [];
    },
    async getTopSellers() {
      return (must(await sb.from('top_sellers').select('*').order('rnk', { ascending: true }), 'load top sellers')) ?? [];
    },
  };
}
