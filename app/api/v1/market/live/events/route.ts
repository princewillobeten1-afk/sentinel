import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { liveMarketCache } from '@/lib/market/live/live-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/market/live/events?limit=50
 *
 * Returns the most recent normalized market events for eyeballing the live
 * stream without tailing server logs.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(200, Math.max(1, Number(limitParam) || 50)) : 50;

    return jsonResponse({ events: liveMarketCache.getRecentEvents(limit) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to read live events', 500));
  }
}
