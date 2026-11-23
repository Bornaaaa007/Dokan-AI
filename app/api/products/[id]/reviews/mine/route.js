// GET /api/products/:id/reviews/mine
import { handleMyProductReview } from '../../../../../../lib/product-reviews/handlers.mjs';
import { createServerDb } from '../../../../../../lib/product-reviews/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleMyProductReview(request, await params, createServerDb);
}
