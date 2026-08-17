import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { rankingEngine } from '@/lib/market-data/rankings/ranking-engine';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/losers — top losers across 1h, 6h, 24h windows */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeframe = (url.searchParams.get('timeframe') as '1h' | '6h' | '24h') || '24h';
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 10;

    const items = rankingEngine.getTopLosers(timeframe, limit);

    return jsonResponse({
      timeframe,
      items,
      count: items.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch top losers', 500));
  }
}
