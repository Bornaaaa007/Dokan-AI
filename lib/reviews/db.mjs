// Database access for platform reviews. The Supabase client is passed in, so this file is testable offline.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};
const COLS = 'id,user_id,rating,body,status,created_at,decided_at,decided_by';

export function createReviewsDb(sb) {
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
      return (must(await sb.from('users').select('id,name,roles').in('id', ids), 'load users')) ?? [];
    },
    async getMyReview(userId) {
      return must(await sb.from('platform_reviews').select(COLS).eq('user_id', userId).maybeSingle(), 'load my review');
    },
    async getReview(id) {
      return must(await sb.from('platform_reviews').select(COLS).eq('id', id).maybeSingle(), 'load review');
    },
    async insertReview(row) {
      const { data, error } = await sb.from('platform_reviews').insert(row).select(COLS).single();
      if (error) {
        if (error.code === '23505') { const e = new Error('duplicate'); e.code = 'duplicate'; throw e; }
        throw new Error('save review: ' + error.message);
      }
      return data;
    },
    async listByStatus(status, limit) {
      return (must(await sb.from('platform_reviews').select(COLS).eq('status', status).order('created_at', { ascending: false }).limit(limit), 'list reviews')) ?? [];
    },
    async approvedRatings() {
      const rows = must(await sb.from('platform_reviews').select('rating').eq('status', 'approved').limit(5000), 'load ratings');
      return (rows ?? []).map((r) => r.rating);
    },
    async setStatus(id, status, adminId, nowIso) {
      return must(await sb.from('platform_reviews').update({ status, decided_by: adminId, decided_at: nowIso }).eq('id', id).select(COLS).maybeSingle(), 'update review');
    },
  };
}
