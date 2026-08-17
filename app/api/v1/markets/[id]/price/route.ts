import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { priceEngine } from '@/lib/market-data/pricing/price-engine';
import { canonicalMarketRegistry } from '@/lib/market-data/discovery/market-registry';

export const dynamic = 'force-dynamic';

/** GET /api/v1/markets/:id/price — get price, status (FRESH/STALE), and confidence */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const market = canonicalMarketRegistry.getMarket(id);

    if (!market) {
      throw new ApiError(`Market not found: ${id}`, 404);
    }

    const price = priceEngine.getMarketPrice(market.marketId);

    if (!price) {
      throw new ApiError(`No price available for market: ${id}`, 404);
    }

    return jsonResponse({
      marketId: market.marketId,
      priceUsd: price.priceUsd,
      status: price.status,
      confidence: price.confidence,
      source: price.source,
      timestamp: price.timestamp,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch market price', 500));
  }
}
