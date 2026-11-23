// GET /api/products/mine  (seller's own products, hidden ones included)
import { handleMyProducts } from '../../../../lib/products/mine.mjs';
import { createServerDb } from '../../../../lib/products/mine-server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleMyProducts(request, {}, createServerDb);
}
