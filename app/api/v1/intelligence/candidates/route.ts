import { jsonResponse, errorResponse } from '@/lib/server/api';
import { getIntelligenceCandidates } from '@/lib/intelligence/live-service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || undefined;
    const query = url.searchParams.get('q') || undefined;
    return jsonResponse({ tokens: await getIntelligenceCandidates(category, query) }, 200, { 'Cache-Control': 'no-store' });
  }
  catch { return errorResponse(new Error('Intelligence candidates unavailable')); }
}
