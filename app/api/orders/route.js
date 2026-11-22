// GET /api/orders (my orders)  and  POST /api/orders (place an order)
import { handleListOrders, handleCreateOrder } from '../../../lib/orders/handlers.mjs';
import { createServerDb } from '../../../lib/orders/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleListOrders(request, {}, createServerDb);
}
export async function POST(request) {
  return handleCreateOrder(request, {}, createServerDb);
}
