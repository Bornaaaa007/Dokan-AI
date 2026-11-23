// PATCH /api/admin/reviews/:id  { status: "approved" | "hidden" }
import { handleAdminSetStatus } from '../../../../../lib/reviews/handlers.mjs';
import { createServerDb } from '../../../../../lib/reviews/server.mjs';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  return handleAdminSetStatus(request, await params, createServerDb);
}
