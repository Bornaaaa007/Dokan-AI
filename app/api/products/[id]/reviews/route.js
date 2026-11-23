// GET /api/products/:id/reviews (public, visible only)   POST /api/products/:id/reviews (signed in, delivered order)
import { handleListProductReviews, handleCreateProductReview } from '../../../../../lib/product-reviews/handlers.mjs';
import { createServerDb } from '../../../../../lib/product-reviews/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleListProductReviews(request, await params, createServerDb);
}
export async function POST(request, { params }) {
  return handleCreateProductReview(request, await params, createServerDb);
}
