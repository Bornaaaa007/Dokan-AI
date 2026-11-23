// POST /api/events  (records a product view or add-to-cart)
import { handleRecordEvent } from '../../../lib/events/handlers.mjs';
import { createServerDb } from '../../../lib/events/server.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  return handleRecordEvent(request, {}, createServerDb);
}
