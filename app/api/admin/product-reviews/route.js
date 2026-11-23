// GET /api/admin/product-reviews?status=visible|hidden
import { handleAdminListProductReviews } from '../../../../lib/product-reviews/handlers.mjs';
import { createServerDb } from '../../../../lib/product-reviews/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleAdminListProductReviews(request, createServerDb);
}
