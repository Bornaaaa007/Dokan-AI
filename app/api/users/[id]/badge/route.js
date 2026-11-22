// GET /api/users/:id/badge
import { handleUserBadge } from '../../../../../lib/complaints/handlers.mjs';
import { createServerDb } from '../../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleUserBadge(request, await params, createServerDb);
}
