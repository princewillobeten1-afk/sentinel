import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { ohlcvEngine } from '@/lib/market-data/ohlcv/ohlcv-engine';
import { canonicalMarketRegistry } from '@/lib/market-data/discovery/market-registry';
import { priceEngine } from '@/lib/market-data/pricing/price-engine';
import { CandleInterval } from '@/lib/market-data/types';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/:id/ohlcv — canonical aggregated token candlestick series */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const interval = (url.searchParams.get('interval') as CandleInterval) || '1h';
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 150;

    // Use dominant active market for canonical candlestick resolution
    const priceData = priceEngine.getCanonicalTokenPrice(id);
    const dominantMarketId = priceData.dominantMarketId;

    let candles = dominantMarketId ? ohlcvEngine.getCandles(dominantMarketId, interval, limit) : [];

    if (candles.length === 0) {
      // Fallback to any active market for this token
      const markets = canonicalMarketRegistry.getMarketsForToken(id);
      if (markets.length > 0) {
        candles = ohlcvEngine.getCandles(markets[0].marketId, interval, limit);
      }
    }

    return jsonResponse({
      tokenId: id,
      interval,
      dominantMarketId,
      candles,
      count: candles.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token candles', 500));
  }
}
