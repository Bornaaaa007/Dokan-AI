// POST /api/admin/complaints/:id/triage  (admin only: AI summary and a suggested outcome; the admin still decides)
import { handleTriage } from '../../../../../../lib/complaints/triageHandler.mjs';
import { createServerDb } from '../../../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request, { params }) {
  return handleTriage(request, await params, createServerDb);
}
