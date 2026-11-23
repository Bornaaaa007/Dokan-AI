// POST /api/shops/:id/premium
import { handleBuyPremium } from '../../../../../lib/shops/handlers.mjs';
import { createServerDb } from '../../../../../lib/shops/server.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  return handleBuyPremium(request, await params, createServerDb);
}
