import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { rankingEngine } from '@/lib/market-data/rankings/ranking-engine';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/trending — trending tokens with transparent momentum scores */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 10;

    const items = rankingEngine.getTrendingTokens(limit);

    return jsonResponse({
      items,
      count: items.length,
      algorithmVersion: 'v1.0-multi-momentum',
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch trending tokens', 500));
  }
}
