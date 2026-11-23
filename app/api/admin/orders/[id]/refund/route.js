// POST /api/admin/orders/:id/refund
import { handleAdminRefund } from '../../../../../../lib/orders/handlers.mjs';
import { createServerDb } from '../../../../../../lib/orders/server.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  return handleAdminRefund(request, await params, createServerDb);
}
