// Small shared helpers for API handlers: JSON replies, typed errors, one place that turns errors into responses.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const http = (status, code, message) => new HttpError(status, code, message);

export const resolveDb = (d) => (typeof d === 'function' ? d() : d);

export async function run(dbOrFactory, fn, label = 'api') {
  try {
    return await fn(resolveDb(dbOrFactory));
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: { code: e.code, message: e.message } });
    console.error(label + ' error:', e);   // details stay in the server log, never in the reply
    return json(500, { error: { code: 'internal', message: 'Something went wrong. Please try again.' } });
  }
}

export async function readJson(request) {
  try { return await request.json(); } catch { return undefined; }
}
export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
