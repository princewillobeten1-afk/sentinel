import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { rankingEngine } from '@/lib/market-data/rankings/ranking-engine';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/new — chronological new tokens feed with quality filters */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const chainId = url.searchParams.get('chainId') || undefined;
    const minLiquidityUsd = url.searchParams.get('minLiquidity') ? parseFloat(url.searchParams.get('minLiquidity')!) : undefined;
    const minVolumeUsd = url.searchParams.get('minVolume') ? parseFloat(url.searchParams.get('minVolume')!) : undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 20;

    const items = rankingEngine.getNewTokensFeed({
      chainId,
      minLiquidityUsd,
      minVolumeUsd,
      limit,
    });

    return jsonResponse({
      items,
      count: items.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch new tokens feed', 500));
  }
}
