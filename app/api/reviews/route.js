// GET /api/reviews (public, approved only)   POST /api/reviews (signed in)
import { handleListReviews, handleCreateReview } from '../../../lib/reviews/handlers.mjs';
import { createServerDb } from '../../../lib/reviews/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleListReviews(request, createServerDb);
}
export async function POST(request) {
  return handleCreateReview(request, createServerDb);
}
