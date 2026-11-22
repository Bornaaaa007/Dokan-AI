// PATCH /api/admin/shops/:id/verification
import { handleVerifyShop } from '../../../../../../lib/shops/handlers.mjs';
import { createServerDb } from '../../../../../../lib/shops/server.mjs';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  return handleVerifyShop(request, await params, createServerDb);
}
