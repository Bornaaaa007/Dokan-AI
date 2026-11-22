// GET /api/seller/analytics?shop_id=<uuid>
import { handleSellerAnalytics } from '../../../../lib/analytics/handlers.mjs';
import { createServerDb } from '../../../../lib/analytics/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleSellerAnalytics(request, createServerDb);
}
