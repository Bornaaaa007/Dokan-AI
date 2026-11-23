// GET /api/shops/mine
import { handleMyShop } from '../../../../lib/shops/handlers.mjs';
import { createServerDb } from '../../../../lib/shops/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleMyShop(request, {}, createServerDb);
}
