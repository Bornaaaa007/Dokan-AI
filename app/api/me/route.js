// GET /api/me  (the signed-in user, roles, and the seller's shop)
import { handleMe } from '../../../lib/me/handlers.mjs';
import { createServerDb } from '../../../lib/me/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleMe(request, {}, createServerDb);
}
