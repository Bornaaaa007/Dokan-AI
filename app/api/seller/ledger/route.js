// GET /api/seller/ledger   (seller: own shop's payment ledger, JSON or CSV)
import { handleSellerLedger } from '../../../../lib/ledger/handlers.mjs';
import { createServerDb } from '../../../../lib/ledger/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleSellerLedger(request, createServerDb);
}
