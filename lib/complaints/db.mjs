// Database access for complaints. The Supabase client is passed in, so this file is testable offline.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};
const COMPLAINT_COLS = '*';

export function createComplaintsDb(sb) {
  return {
    // Only non-sensitive user columns: never phone or email.
    async getUser(id) {
      return must(await sb.from('users').select('id,name,roles').eq('id', id).maybeSingle(), 'load user');
    },
    async getUsersByIds(ids) {
      if (!ids.length) return [];
      return (must(await sb.from('users').select('id,name,roles').in('id', ids), 'load users')) ?? [];
    },
    async getOrder(id) {
      return must(await sb.from('orders').select('id,customer_id,shop_id,items,item_total,delivery_charge,payment_method,payment_status,status,placed_at,delivered_at').eq('id', id).maybeSingle(), 'load order');
    },
    // Never selects nid_number.
    async getShop(id) {
      return must(await sb.from('shops').select('id,owner_id,name').eq('id', id).maybeSingle(), 'load shop');
    },
    async getComplaint(id) {
      return must(await sb.from('complaints').select(COMPLAINT_COLS).eq('id', id).maybeSingle(), 'load complaint');
    },
    async findComplaint(orderId, filedBy) {
      return must(await sb.from('complaints').select('id').eq('order_id', orderId).eq('filed_by', filedBy).maybeSingle(), 'check duplicate');
    },
    async countRecentComplaints(userId, sinceIso) {
      const { count, error } = await sb.from('complaints').select('id', { count: 'exact', head: true }).eq('filed_by', userId).gte('created_at', sinceIso);
      if (error) throw new Error('count complaints: ' + error.message);
      return count ?? 0;
    },
    async insertComplaint(row) {
      const { data, error } = await sb.from('complaints').insert(row).select(COMPLAINT_COLS).single();
      if (error) {
        if (error.code === '23505') { const e = new Error('duplicate'); e.code = 'duplicate'; throw e; }
        throw new Error('save complaint: ' + error.message);
      }
      return data;
    },
    // Atomic: only updates while the complaint is still "submitted" and the caller is the accused party.
    async saveResponse(id, accusedId, patch) {
      return must(await sb.from('complaints').update({ ...patch, status: 'responded' }).eq('id', id).eq('accused_id', accusedId).eq('status', 'submitted').select(COMPLAINT_COLS).maybeSingle(), 'save response');
    },
    async listForUser(userId) {
      return (must(await sb.from('complaints').select(COMPLAINT_COLS).or('filed_by.eq.' + userId + ',accused_id.eq.' + userId).order('created_at', { ascending: false }).limit(50), 'list my complaints')) ?? [];
    },
    async listByStatus(statuses) {
      return (must(await sb.from('complaints').select(COMPLAINT_COLS).in('status', statuses).order('created_at', { ascending: true }).limit(100), 'list complaints')) ?? [];
    },
    async countUpheldAgainst(userId) {
      const { count, error } = await sb.from('complaints').select('id', { count: 'exact', head: true }).eq('accused_id', userId).eq('status', 'upheld');
      if (error) throw new Error('count upheld: ' + error.message);
      return count ?? 0;
    },
    async getActiveBadges(userId, nowIso) {
      return (must(await sb.from('badges').select('id,role,expires_at').eq('user_id', userId).eq('status', 'active').gt('expires_at', nowIso), 'load badges')) ?? [];
    },
    // One transaction in the database: decision + optional badge. Errors come back as short codes.
    async decide({ complaintId, adminId, outcome, note, issueBadge }) {
      const { data, error } = await sb.rpc('decide_complaint', {
        p_complaint_id: complaintId, p_admin_id: adminId, p_outcome: outcome, p_note: note, p_issue_badge: issueBadge,
      });
      if (error) { const e = new Error(error.message); e.code = 'rpc'; throw e; }
      return data;
    },
  };
}
