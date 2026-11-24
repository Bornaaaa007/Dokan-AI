// POST /api/seller/message-update  { text, selections? }   (sellers only)
// Returns a preview of the product updates found in a pasted chat message. Nothing is saved here.
import { handleMessageUpdate } from '../../../../lib/ai/messageUpdate.mjs';
import { createServerDb } from '../../../../lib/products/mine-server.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  return handleMessageUpdate(request, {}, createServerDb);
}
