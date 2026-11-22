// PATCH /api/admin/complaints/:id/decision
// Badges are switched off by default. Set ISSUE_BADGES=true in .env to turn them on.
import { handleDecision } from '../../../../../../lib/complaints/handlers.mjs';
import { createServerDb, issueBadges } from '../../../../../../lib/complaints/server.mjs';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  return handleDecision(request, await params, createServerDb, { issueBadges: issueBadges() });
}
