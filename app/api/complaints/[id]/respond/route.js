// POST /api/complaints/:id/respond
import { handleRespond } from '../../../../../lib/complaints/handlers.mjs';
import { createServerDb } from '../../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  return handleRespond(request, await params, createServerDb);
}
