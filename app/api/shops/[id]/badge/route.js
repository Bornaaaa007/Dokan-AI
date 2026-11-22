// GET /api/shops/:id/badge
import { handleShopBadge } from '../../../../../lib/complaints/handlers.mjs';
import { createServerDb } from '../../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleShopBadge(request, await params, createServerDb);
}
