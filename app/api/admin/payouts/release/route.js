// POST /api/admin/payouts/release
import { handleReleaseDue } from '../../../../../lib/orders/handlers.mjs';
import { createServerDb } from '../../../../../lib/orders/server.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  return handleReleaseDue(request, {}, createServerDb);
}
