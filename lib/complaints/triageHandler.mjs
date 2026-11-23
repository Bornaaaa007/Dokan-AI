// POST /api/admin/complaints/:id/triage   { language? }   (admin only)
// Gemini summarises the thread and SUGGESTS an outcome. This handler writes nothing to the database:
// the decision is still recorded only by PATCH /decision, from the admin's own request.
import { requireUser, hasRole } from '../auth/current-user.mjs';
import { run, json, http, readJson, isPlainObject, UUID } from '../api/http.mjs';
import { responseDueAt } from './rules.mjs';
import { triageComplaint } from '../ai/triageComplaint.mjs';

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();   // best effort, one per server instance: stops repeated clicks from burning AI quota
const recent = new Map();  // admin id -> request times
function tooMany(id, now) {
  const hits = (recent.get(id) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= 30) return true;
  recent.set(id, [...hits, now]);
  return false;
}

export function handleTriage(request, params, dbOrFactory, { triage = triageComplaint, now = new Date() } = {}) {
  return run(dbOrFactory, async (db) => {
    const id = params?.id;
    if (typeof id !== 'string' || !UUID.test(id)) throw http(400, 'bad_id', 'The id in the URL is not valid.');
    const admin = await requireUser(request, db);
    if (!hasRole(admin, 'admin')) throw http(403, 'admin_only', 'Admins only.');
    const body = await readJson(request);
    const language = isPlainObject(body) && body.language === 'bn' ? 'bn' : 'en';

    const c = await db.getComplaint(id);
    if (!c) throw http(404, 'complaint_not_found', 'No complaint with that id.');
    if (c.filed_by === admin.id || c.accused_id === admin.id) throw http(403, 'conflict_of_interest', 'You cannot review a complaint you are a party to.');

    const key = [id, c.status, c.responded_at ?? '', language].join(':');
    const hit = cache.get(key);
    if (hit && now.getTime() - hit.at < CACHE_MS) return json(200, { data: { ...hit.data, cached: true } });
    if (tooMany(admin.id, now.getTime())) throw http(429, 'slow_down', 'Please wait a little before running more AI reviews.');

    const [order, upheldBefore, badges] = await Promise.all([db.getOrder(c.order_id), db.countUpheldAgainst(c.accused_id), db.getActiveBadges(c.accused_id, now.toISOString())]);
    const due = responseDueAt(c.created_at);
    const thread = {
      complaint: c, order,
      responseOverdue: c.status === 'submitted' && now > due,
      respondedLate: c.responded_at ? new Date(c.responded_at) > due : null,
      history: { upheld_before: upheldBefore - (c.status === 'upheld' ? 1 : 0), has_active_badge: badges.some((b) => b.role === c.accused_role) },
    };

    let result;
    try {
      result = await triage({ thread, language });
    } catch (e) {
      console.error('complaint triage error:', e.message);
      throw http(503, 'ai_unavailable', 'The AI helper is busy. You can still review and decide this complaint yourself.');
    }
    const out = { ...result, generated_at: now.toISOString(), cached: false, advisory: true };
    cache.set(key, { at: now.getTime(), data: out });
    return json(200, { data: out });
  }, 'complaint triage');
}
