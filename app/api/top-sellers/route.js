// GET /api/top-sellers
import { handleTopSellers } from '../../../lib/analytics/handlers.mjs';
import { createServerDb } from '../../../lib/analytics/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleTopSellers(request, createServerDb);
}
