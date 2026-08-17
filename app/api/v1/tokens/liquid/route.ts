import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { rankingEngine } from '@/lib/market-data/rankings/ranking-engine';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/liquid — most liquid tokens */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 10;

    const items = rankingEngine.getMostLiquidTokens(limit);

    return jsonResponse({
      items,
      count: items.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch most liquid tokens', 500));
  }
}
