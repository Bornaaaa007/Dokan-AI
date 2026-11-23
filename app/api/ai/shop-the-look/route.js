// POST /api/ai/shop-the-look  { image_base64, mime_type, language? }   (any signed-in user)
// The photo goes straight to Gemini and is NOT stored. Matching with products happens in the browser (lib/visual/match.mjs).
import { run, json, http, readJson, isPlainObject } from '../../../../lib/api/http.mjs';
import { requireUser } from '../../../../lib/auth/current-user.mjs';
import { createServerDb } from '../../../../lib/products/server.mjs';
import { describeLook } from '../../../../lib/visual/describeLook.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BASE64 = 3_000_000;                 // about 2.2 MB of image
const recent = new Map();                     // user id -> request times. Best effort: one counter per server instance.
function tooMany(id) {
  const now = Date.now();
  const hits = (recent.get(id) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= 15) return true;         // 15 photos per hour per user protects the Gemini quota
  recent.set(id, [...hits, now]);
  return false;
}

export async function POST(request) {
  return run(createServerDb, async (db) => {
    const user = await requireUser(request, db);
    const body = await readJson(request);
    if (!isPlainObject(body) || typeof body.image_base64 !== 'string') throw http(400, 'bad_request', 'Send an image.');
    if (!/^image\/(jpeg|png|webp)$/.test(body.mime_type ?? '')) throw http(400, 'bad_image', 'Use a JPG, PNG or WebP photo.');
    if (body.image_base64.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(body.image_base64)) throw http(400, 'bad_image', 'That photo is too big or not valid.');
    if (tooMany(user.id)) throw http(429, 'slow_down', 'Please wait a little before trying more photos.');

    try {
      const data = await describeLook({ mimeType: body.mime_type, base64: body.image_base64, language: body.language === 'bn' ? 'bn' : 'en' });
      return json(200, { data });
    } catch (e) {
      console.error('shop-the-look error:', e.message);
      throw http(503, 'ai_unavailable', 'The AI helper is busy. Please try again in a moment.');
    }
  }, 'shop-the-look');
}