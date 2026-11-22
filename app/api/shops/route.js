// POST /api/shops
import { handleCreateShop } from '../../../lib/shops/handlers.mjs';
import { createServerDb } from '../../../lib/shops/server.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  return handleCreateShop(request, {}, createServerDb);
}
