// GET /api/admin/ledger   (admin: every shop's payment ledger, JSON or CSV)
import { handleAdminLedger } from '../../../../lib/ledger/handlers.mjs';
import { createServerDb } from '../../../../lib/ledger/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleAdminLedger(request, createServerDb);
}
