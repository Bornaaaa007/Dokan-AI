// GET /api/admin/shops?status=pending
import { handleAdminListShops } from '../../../../lib/shops/handlers.mjs';
import { createServerDb } from '../../../../lib/shops/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleAdminListShops(request, {}, createServerDb);
}
