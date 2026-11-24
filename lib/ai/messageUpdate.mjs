// POST /api/seller/message-update   { text, selections? }   (sellers only)
// Reads a forwarded chat message and returns a PREVIEW of product updates. It never writes to the database:
// the seller confirms in the UI, and the UI applies the change with PATCH /api/products/:id.
import { run, json, http, readJson, isPlainObject, UUID } from '../api/http.mjs';
import { requireUser, hasRole } from '../auth/current-user.mjs';
import { extractFromMessage, buildUpdates, MAX_TEXT } from './parseSellerMessage.mjs';

// selections: { "0": "<product uuid>" } = the seller's pick for item 0 after a low-confidence answer.
function cleanSelections(v) {
  const out = {};
  if (!isPlainObject(v)) return out;
  for (const [k, id] of Object.entries(v)) {
    if (/^\d{1,2}$/.test(k) && typeof id === 'string' && UUID.test(id)) out[Number(k)] = id.toLowerCase();
  }
  return out;
}

export function handleMessageUpdate(request, _params, dbOrFactory, { extract = extractFromMessage } = {}) {
  return run(dbOrFactory, async (db) => {
    const user = await requireUser(request, db);
    if (!hasRole(user, 'seller')) throw http(403, 'seller_only', 'Only sellers can use this.');

    const body = await readJson(request);
    if (!isPlainObject(body) || typeof body.text !== 'string') throw http(400, 'bad_request', 'Send the message as text.');
    const text = body.text.trim();
    if (!text) throw http(400, 'empty_message', 'Paste a message first.');
    if (text.length > MAX_TEXT) throw http(400, 'message_too_long', `The message is too long. Keep it under ${MAX_TEXT} characters.`);

    // ONLY this seller's own shops and products are ever loaded, so another shop's product can never be matched.
    const shops = (await db.getShopsByOwner(user.id)).filter((s) => s.verification_status !== 'rejected');
    if (shops.length === 0) throw http(409, 'no_shop', 'Create your shop before updating products.');
    const products = (await Promise.all(shops.map((s) => db.listProductsByShop(s.id)))).flat();
    if (products.length === 0) throw http(409, 'no_products', 'Add a product first.');

    let extraction;
    try { extraction = await extract(text); }
    catch (e) {
      console.error('message-update AI error:', e?.message ?? e);
      throw http(503, 'ai_unavailable', 'The AI helper is busy. Please try again in a moment.');
    }
    return json(200, buildUpdates(extraction, products, { selections: cleanSelections(body.selections) }));
  }, 'message-update');
}
