// GET /api/complaints/mine
import { handleMyComplaints } from '../../../../lib/complaints/handlers.mjs';
import { createServerDb } from '../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleMyComplaints(request, {}, createServerDb);
}
