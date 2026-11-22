// GET /api/products/:id  and  PATCH /api/products/:id
import { handleGetProduct, handlePatchProduct } from '../../../../lib/products/handlers.mjs';
import { createServerDb } from '../../../../lib/products/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleGetProduct(request, await params, createServerDb);
}
export async function PATCH(request, { params }) {
  return handlePatchProduct(request, await params, createServerDb);
}
