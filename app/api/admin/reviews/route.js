// GET /api/admin/reviews?status=pending|approved|hidden
import { handleAdminListReviews } from '../../../../lib/reviews/handlers.mjs';
import { createServerDb } from '../../../../lib/reviews/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleAdminListReviews(request, createServerDb);
}
