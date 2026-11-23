// GET /api/reviews/mine
import { handleMyReview } from '../../../../lib/reviews/handlers.mjs';
import { createServerDb } from '../../../../lib/reviews/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleMyReview(request, createServerDb);
}
