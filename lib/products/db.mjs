// Database access for products. The Supabase client is passed in, so this file is testable offline.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};
const LIST_COLS = 'id,shop_id,name,custom_category,category,gender,age_group,colors,occasion_tags,image_urls,price,discount_price,variants,status,created_at';
const FULL_COLS = LIST_COLS + ',description';
// Never selects nid_number.
const SHOP_COLS = 'id,owner_id,name,city,verification_status,plan,plan_expires_at';

export function createProductsDb(sb) {
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
    // Hackathon-sized catalog: load the active products once and filter in code (cap keeps it safe).
    async listActiveProducts() {
      return must(await sb.from('products').select(LIST_COLS).eq('status', 'active').order('created_at', { ascending: false }).limit(5000), 'list products') ?? [];
    },
    async getShopsByIds(ids) {
      if (!ids.length) return [];
      return must(await sb.from('shops').select(SHOP_COLS).in('id', ids), 'load shops') ?? [];
    },
    async getShop(id) {
      return must(await sb.from('shops').select(SHOP_COLS).eq('id', id).maybeSingle(), 'load shop');
    },
    async getShopsByOwner(ownerId) {
      return must(await sb.from('shops').select(SHOP_COLS).eq('owner_id', ownerId), 'load shops by owner') ?? [];
    },
    async getProduct(id) {
      return must(await sb.from('products').select(FULL_COLS).eq('id', id).maybeSingle(), 'load product');
    },
    async insertProduct(row) {
      return must(await sb.from('products').insert(row).select(FULL_COLS).single(), 'save product');
    },
    async updateProduct(id, patch) {
      return must(await sb.from('products').update(patch).eq('id', id).select(FULL_COLS).maybeSingle(), 'update product');
    },
    async insertSearchLog(row) {
      must(await sb.from('search_logs').insert(row), 'save search log');
    },
  };
}
