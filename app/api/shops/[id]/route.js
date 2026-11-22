// GET /api/shops/:id  and  PATCH /api/shops/:id
import { handleGetShop, handlePatchShop } from '../../../../lib/shops/handlers.mjs';
import { createServerDb } from '../../../../lib/shops/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleGetShop(request, await params, createServerDb);
}
export async function PATCH(request, { params }) {
  return handlePatchShop(request, await params, createServerDb);
}
