// GET /api/admin/complaints/:id
import { handleAdminDetail } from '../../../../../lib/complaints/handlers.mjs';
import { createServerDb } from '../../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleAdminDetail(request, await params, createServerDb);
}
