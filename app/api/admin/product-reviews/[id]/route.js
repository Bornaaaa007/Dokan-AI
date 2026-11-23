// PATCH /api/admin/product-reviews/:id  { status: "visible" | "hidden" }
import { handleAdminSetProductReviewStatus } from '../../../../../lib/product-reviews/handlers.mjs';
import { createServerDb } from '../../../../../lib/product-reviews/server.mjs';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  return handleAdminSetProductReviewStatus(request, await params, createServerDb);
}
