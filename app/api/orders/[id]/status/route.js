// PATCH /api/orders/:id/status
import { handleUpdateStatus } from '../../../../../lib/orders/handlers.mjs';
import { createServerDb } from '../../../../../lib/orders/server.mjs';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  return handleUpdateStatus(request, await params, createServerDb);
}
