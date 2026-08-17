import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { snapshotEngine } from '@/lib/market-data/snapshots/snapshot-engine';
import { marketDataQualityService } from '@/lib/market-data/quality/quality-service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/:id/market-data — canonical token market summary */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const snapshot = snapshotEngine.getTokenSnapshot(id);
    const quality = marketDataQualityService.evaluateTokenQuality(id);

    return jsonResponse({
      tokenId: snapshot.tokenId,
      symbol: snapshot.symbol,
      name: snapshot.name,
      price: snapshot.priceUsd,
      priceChange24h: snapshot.priceChange24h,
      volume24h: snapshot.volume24hUsd,
      liquidity: snapshot.totalLiquidityUsd,
      marketCap: snapshot.marketCapUsd,
      fdv: snapshot.fdvUsd,
      marketCount: snapshot.marketCount,
      confidence: snapshot.confidence,
      dataQualityScore: quality.dataQualityScore,
      divergenceStatus: quality.divergenceStatus,
      updatedAt: snapshot.timestamp,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token market data', 500));
  }
}
