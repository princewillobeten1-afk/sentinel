import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { canonicalMarketRegistry } from '@/lib/market-data/discovery/market-registry';
import { liquidityEngine } from '@/lib/market-data/liquidity/liquidity-engine';
import { priceEngine } from '@/lib/market-data/pricing/price-engine';

export const dynamic = 'force-dynamic';

/** GET /api/v1/markets/:id — get market details, reserves, and current status */
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

    const reserves = liquidityEngine.getMarketReserve(market.marketId);
    const price = priceEngine.getMarketPrice(market.marketId);

    return jsonResponse({
      market,
      reserves: reserves || null,
      price: price || null,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch market', 500));
  }
}
