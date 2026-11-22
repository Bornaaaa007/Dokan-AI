// GET /api/admin/complaints?status=open
import { handleAdminList } from '../../../../lib/complaints/handlers.mjs';
import { createServerDb } from '../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleAdminList(request, {}, createServerDb);
}
