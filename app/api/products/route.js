// GET /api/products (search)  and  POST /api/products (seller adds a product)
import { handleListProducts, handleCreateProduct } from '../../../lib/products/handlers.mjs';
import { createServerDb } from '../../../lib/products/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleListProducts(request, {}, createServerDb);
}
export async function POST(request) {
  return handleCreateProduct(request, {}, createServerDb);
}
