// GET /api/admin/insights
import { handleAdminInsights } from '../../../../lib/analytics/handlers.mjs';
import { createServerDb } from '../../../../lib/analytics/server.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleAdminInsights(request, createServerDb);
}
