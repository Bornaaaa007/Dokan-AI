// POST /api/ai/describe-photo  { image_url, language? }   (sellers only)
import { run, json, http, readJson, isPlainObject } from '../../../../lib/api/http.mjs';
import { requireUser, hasRole } from '../../../../lib/auth/current-user.mjs';
import { createServerDb } from '../../../../lib/products/server.mjs';
import { describePhoto } from '../../../../lib/ai/describePhoto.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  return run(createServerDb, async (db) => {
    const user = await requireUser(request, db);
    if (!hasRole(user, 'seller')) throw http(403, 'seller_only', 'Only sellers can use this.');
    const body = await readJson(request);
    if (!isPlainObject(body) || typeof body.image_url !== 'string') throw http(400, 'bad_request', 'Send an image_url.');

    // Safety: only read photos from our own product-images bucket.
    const allowed = `${process.env.SUPABASE_URL}/storage/v1/object/public/product-images/`;
    if (!body.image_url.startsWith(allowed)) throw http(400, 'bad_image', 'Use a photo uploaded on Dokan AI.');

    const img = await fetch(body.image_url, { signal: AbortSignal.timeout(15000) });
    if (!img.ok) throw http(400, 'bad_image', 'Could not read that photo.');
    const mimeType = (img.headers.get('content-type') || '').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) throw http(400, 'bad_image', 'Use a JPG, PNG or WebP photo.');
    const base64 = Buffer.from(await img.arrayBuffer()).toString('base64');

    try {
      const data = await describePhoto({ mimeType, base64, language: body.language === 'bn' ? 'bn' : 'en' });
      return json(200, { data });
    } catch (e) {
      console.error('describe-photo error:', e.message);
      throw http(503, 'ai_unavailable', 'The AI helper is busy. You can fill the form yourself or try again in a moment.');
    }
  }, 'describe-photo');
}