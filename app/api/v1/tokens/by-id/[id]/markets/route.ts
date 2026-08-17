import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { canonicalMarketRegistry } from '@/lib/market-data/discovery/market-registry';
import { priceEngine } from '@/lib/market-data/pricing/price-engine';
import { liquidityEngine } from '@/lib/market-data/liquidity/liquidity-engine';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/:id/markets — list all trading pools for a token */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const markets = canonicalMarketRegistry.getMarketsForToken(id);

    const enrichedMarkets = markets.map((m) => {
      const price = priceEngine.getMarketPrice(m.marketId);
      const reserves = liquidityEngine.getMarketReserve(m.marketId);
      return {
        ...m,
        priceUsd: price?.priceUsd || 0,
        status: price?.status || m.status,
        liquidityUsd: reserves?.liquidityUsd || 0,
      };
    });

    return jsonResponse({
      tokenId: id,
      marketCount: enrichedMarkets.length,
      markets: enrichedMarkets,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token markets', 500));
  }
}
