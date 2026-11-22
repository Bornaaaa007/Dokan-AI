// POST /api/orders/:id/pay  (sandbox payment, no real money)
import { handlePayOrder } from '../../../../../lib/orders/handlers.mjs';
import { createServerDb } from '../../../../../lib/orders/server.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  return handlePayOrder(request, await params, createServerDb);
}
