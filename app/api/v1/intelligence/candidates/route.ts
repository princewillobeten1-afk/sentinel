import { jsonResponse, errorResponse } from '@/lib/server/api';
import { getIntelligenceCandidates } from '@/lib/intelligence/live-service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return jsonResponse({ tokens: await getIntelligenceCandidates() }, 200, { 'Cache-Control': 'no-store' }); }
  catch { return errorResponse(new Error('Intelligence candidates unavailable')); }
}
