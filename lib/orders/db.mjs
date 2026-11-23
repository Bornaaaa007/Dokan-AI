// Database access for orders. The Supabase client is passed in, so this file is testable offline.
// Anything that changes stock or money runs as a database function (scripts/orders.sql) so it is one transaction.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};
const rpcFail = (error) => { const e = new Error(error.message); e.code = 'rpc'; return e; };
const ORDER_COLS = 'id,customer_id,shop_id,items,item_total,delivery_charge,commission_rate,commission_amount,payment_method,payment_status,status,placed_at,delivered_at,delivery_address';

export function createOrdersDb(sb) {
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
    async getUsersByIds(ids) {
      if (!ids.length) return [];
      return must(await sb.from('users').select('id,name').in('id', ids), 'load users') ?? [];
    },
    // Never selects nid_number.
    async getShop(id) {
      return must(await sb.from('shops').select('id,owner_id,name,verification_status').eq('id', id).maybeSingle(), 'load shop');
    },
    async getShopsByIds(ids) {
      if (!ids.length) return [];
      return must(await sb.from('shops').select('id,owner_id,name').in('id', ids), 'load shops') ?? [];
    },
    async getShopsByOwner(ownerId) {
      return must(await sb.from('shops').select('id,owner_id,name').eq('owner_id', ownerId), 'load shops by owner') ?? [];
    },
    async getProductsByIds(ids) {
      return must(await sb.from('products').select('id,shop_id,name,price,discount_price,variants,status,image_urls').in('id', ids), 'load products') ?? [];
    },
    async getOrder(id) {
      return must(await sb.from('orders').select(ORDER_COLS).eq('id', id).maybeSingle(), 'load order');
    },
    async listOrders({ customerId, shopId, status, page, limit }) {
      let q = sb.from('orders').select(ORDER_COLS, { count: 'exact' });
      if (customerId) q = q.eq('customer_id', customerId);
      if (shopId) q = q.eq('shop_id', shopId);
      if (status) q = q.eq('status', status);
      const from = (page - 1) * limit;
      const { data, error, count } = await q.order('placed_at', { ascending: false }).range(from, from + limit - 1);
      if (error) throw new Error('list orders: ' + error.message);
      return { rows: data ?? [], total: count ?? 0 };
    },
    // One transaction: checks and lowers stock, then inserts the order.
    async placeOrder(a) {
      const { data, error } = await sb.rpc('place_order', {
        p_customer: a.customerId, p_shop: a.shopId, p_items: a.items, p_item_total: a.itemTotal,
        p_delivery: a.deliveryCharge, p_method: a.method, p_address: a.address,
      });
      if (error) throw rpcFail(error);
      return data;
    },
    // Only moves forward from the status the caller saw, so two quick clicks cannot both win.
    async updateStatus(id, from, patch) {
      return must(await sb.from('orders').update(patch).eq('id', id).eq('status', from).select(ORDER_COLS).maybeSingle(), 'update status');
    },
    // One transaction: puts stock back and refunds held money.
    async cancelOrder(id) {
      const { data, error } = await sb.rpc('cancel_order', { p_order: id });
      if (error) throw rpcFail(error);
      return data;
    },
    // Only an unpaid (or failed) order can be paid, and only once.
    async markPaid(id, patch) {
      return must(await sb.from('orders').update(patch).eq('id', id).in('payment_status', ['pending', 'failed']).select(ORDER_COLS).maybeSingle(), 'mark paid');
    },
    async markPaymentFailed(id) {
      must(await sb.from('orders').update({ payment_status: 'failed' }).eq('id', id).eq('payment_status', 'pending'), 'mark failed');
    },
    async insertEvents(rows) {
      must(await sb.from('event_logs').insert(rows), 'save purchase events');
    },
    // Skips any order with a complaint that is still open or upheld (an upheld one needs an admin refund decision).
    async releaseOrder(id) {
      const { data, error } = await sb.rpc('release_order', { p_order: id });
      if (error) throw rpcFail(error);
      return data === true;
    },
    async releaseDue(cutoffIso) {
      const { data, error } = await sb.rpc('release_due_orders', { p_cutoff: cutoffIso });
      if (error) throw rpcFail(error);
      return data ?? [];
    },
    async refundOrder(id) {
      const { data, error } = await sb.rpc('refund_order', { p_order: id });
      if (error) throw rpcFail(error);
      return data === true;
    },
  };
}
