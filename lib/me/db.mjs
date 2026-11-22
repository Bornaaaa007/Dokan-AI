// Database access for GET /api/me. The Supabase client is passed in, so this file is testable offline.
const must = ({ data, error }, what) => {
  if (error) throw new Error(what + ': ' + error.message);
  return data;
};

export function createMeDb(sb) {
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
    async getProfile(id) {
      return must(await sb.from('users').select('id,name,email,phone,roles,gender,age_group,created_at').eq('id', id).maybeSingle(), 'load profile');
    },
    // Never selects nid_number.
    async getShopsByOwner(ownerId) {
      return must(await sb.from('shops').select('id,name,verification_status,plan,plan_expires_at').eq('owner_id', ownerId).order('created_at', { ascending: true }), 'load shops') ?? [];
    },
  };
}
