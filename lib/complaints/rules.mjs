// Complaint rules in one place. Pure functions, no database.

export const REASONS = {
  customer: ['not_delivered', 'not_as_described', 'wrong_size', 'other'],
  seller: ['refused_delivery', 'false_claim', 'other'],
};
export const LIMITS = {
  textMin: 10, textMax: 2000,
  evidenceMax: 10, urlMax: 500,
  filesPer24h: 5,
  responseHours: 48,
};
export const BADGE_LABEL = 'Verified complaints';
export const BADGE_LEVEL = 'fraud';

const ok = (value) => ({ ok: true, value });
const bad = (message) => ({ ok: false, message });

export const responseDueAt = (createdAt) => new Date(new Date(createdAt).getTime() + LIMITS.responseHours * 3600 * 1000);

function cleanText(v, label) {
  if (typeof v !== 'string') return bad(label + ' is required.');
  const t = v.trim();
  if (t.length < LIMITS.textMin) return bad(label + ' must be at least ' + LIMITS.textMin + ' characters.');
  if (t.length > LIMITS.textMax) return bad(label + ' must be at most ' + LIMITS.textMax + ' characters.');
  return ok(t);
}

export function cleanEvidence(v) {
  if (v === undefined || v === null) return ok([]);
  if (!Array.isArray(v)) return bad('evidence_urls must be a list of links.');
  if (v.length > LIMITS.evidenceMax) return bad('At most ' + LIMITS.evidenceMax + ' evidence links are allowed.');
  const out = [];
  for (const u of v) {
    const s = typeof u === 'string' ? u.trim() : '';
    if (!/^https?:\/\/\S+$/i.test(s) || s.length > LIMITS.urlMax) return bad('Each evidence link must be a http(s) URL under ' + LIMITS.urlMax + ' characters.');
    out.push(s);
  }
  return ok([...new Set(out)]);
}

export function validateFile(body, filerRole) {
  if (!body || typeof body !== 'object') return bad('Send a JSON body.');
  if (!REASONS[filerRole]?.includes(body.reason_code))
    return bad('reason_code must be one of: ' + (REASONS[filerRole] ?? []).join(', ') + '.');
  const d = cleanText(body.description, 'description');
  if (!d.ok) return d;
  const e = cleanEvidence(body.evidence_urls);
  if (!e.ok) return e;
  return ok({ reason_code: body.reason_code, description: d.value, evidence_urls: e.value });
}

export function validateRespond(body) {
  if (!body || typeof body !== 'object') return bad('Send a JSON body.');
  const t = cleanText(body.response_text, 'response_text');
  if (!t.ok) return t;
  const e = cleanEvidence(body.evidence_urls);
  if (!e.ok) return e;
  return ok({ response_text: t.value, response_evidence_urls: e.value });
}

export function validateDecision(body) {
  if (!body || typeof body !== 'object') return bad('Send a JSON body.');
  if (body.outcome !== 'upheld' && body.outcome !== 'rejected') return bad('outcome must be "upheld" or "rejected".');
  const n = cleanText(body.decision_note, 'decision_note');
  if (!n.ok) return n;
  return ok({ outcome: body.outcome, decision_note: n.value, proof_confirmed: body.proof_confirmed === true });
}
