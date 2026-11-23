// POST /api/seller/analytics/ai   (premium seller: own shop; admin: add ?shop_id=<uuid>)
import { handleSellerAiAnalysis } from '../../../../../lib/analytics/aiHandler.mjs';
import { createServerDb } from '../../../../../lib/analytics/server.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  return handleSellerAiAnalysis(request, createServerDb);
}