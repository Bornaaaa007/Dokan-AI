// GET /api/orders/:id
import { handleGetOrder } from '../../../../lib/orders/handlers.mjs';
import { createServerDb } from '../../../../lib/orders/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleGetOrder(request, await params, createServerDb);
}
