// Database access for product reviews. The Supabase client is passed in, so this file is testable offline.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};
const COLS = 'id,product_id,order_id,user_id,rating,body,status,created_at,decided_at,decided_by';

export function createProductReviewsDb(sb) {
  return {
    // Only non-sensitive user columns: never phone or email.
    async getUser(id) {
      return must(await sb.from('users').select('id,name,roles').eq('id', id).maybeSingle(), 'load user');
    },
    async getUserByToken(token) {
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data?.user) return null;
      return must(await sb.from('users').select('id,name,roles').eq('auth_id', data.user.id).maybeSingle(), 'load user by token');
    },
    async getUsersByIds(ids) {
      if (!ids.length) return [];
      return must(await sb.from('users').select('id,name,roles').in('id', ids), 'load users') ?? [];
    },
    async getProduct(id) {
      return must(await sb.from('products').select('id,name').eq('id', id).maybeSingle(), 'load product');
    },
    async getProductsByIds(ids) {
      if (!ids.length) return [];
      return must(await sb.from('products').select('id,name').in('id', ids), 'load products') ?? [];
    },
    async getOrder(id) {
      return must(await sb.from('orders').select('id,customer_id,status,payment_status,items').eq('id', id).maybeSingle(), 'load order');
    },
    // The customer's delivered, not refunded orders that contain this product (newest first).
    // items is jsonb: a JS array would be sent as a Postgres array literal ({...}) and fail, so the filter is a JSON string.
    async listDeliveredOrdersWith(userId, productId) {
      return must(await sb.from('orders').select('id,customer_id,status,payment_status,items').eq('customer_id', userId).eq('status', 'delivered').neq('payment_status', 'refunded')
        .contains('items', JSON.stringify([{ product_id: productId }]))
        .order('placed_at', { ascending: false }).limit(50), 'load delivered orders') ?? [];
    },
    async getReviewFor(orderId, productId) {
      return must(await sb.from('product_reviews').select(COLS).eq('order_id', orderId).eq('product_id', productId).maybeSingle(), 'load review');
    },
    async listMyReviews(userId, productId) {
      return must(await sb.from('product_reviews').select(COLS).eq('user_id', userId).eq('product_id', productId).order('created_at', { ascending: false }).limit(50), 'load my reviews') ?? [];
    },
    async getReview(id) {
      return must(await sb.from('product_reviews').select(COLS).eq('id', id).maybeSingle(), 'load review');
    },
    async insertReview(row) {
      const { data, error } = await sb.from('product_reviews').insert(row).select(COLS).single();
      if (error) {
        if (error.code === '23505') { const e = new Error('duplicate'); e.code = 'duplicate'; throw e; }
        throw new Error('save review: ' + error.message);
      }
      return data;
    },
    async listForProduct(productId, status, limit) {
      return must(await sb.from('product_reviews').select(COLS).eq('product_id', productId).eq('status', status).order('created_at', { ascending: false }).limit(limit), 'list reviews') ?? [];
    },
    // Count and average are computed in the database (function product_review_summary), not in JavaScript.
    async ratingSummary(productId) {
      const rows = must(await sb.rpc('product_review_summary', { p_product: productId }), 'load rating summary');
      const row = Array.isArray(rows) ? rows[0] : rows;
      const count = Number(row?.review_count ?? 0);
      return count ? { count, average: Number(row.average) } : { count: 0, average: null };
    },
    async countRecentReviews(userId, sinceIso) {
      const { count, error } = await sb.from('product_reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', sinceIso);
      if (error) throw new Error('count recent reviews: ' + error.message);
      return count ?? 0;
    },
    async listByStatus(status, limit) {
      return must(await sb.from('product_reviews').select(COLS).eq('status', status).order('created_at', { ascending: false }).limit(limit), 'list reviews') ?? [];
    },
    async setStatus(id, status, adminId, nowIso) {
      return must(await sb.from('product_reviews').update({ status, decided_by: adminId, decided_at: nowIso }).eq('id', id).select(COLS).maybeSingle(), 'update review');
    },
  };
}
