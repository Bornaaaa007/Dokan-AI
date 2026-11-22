// POST /api/orders/:id/complaints
import { handleFileComplaint } from '../../../../../lib/complaints/handlers.mjs';
import { createServerDb } from '../../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  return handleFileComplaint(request, await params, createServerDb);
}
