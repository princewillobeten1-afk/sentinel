import { jsonResponse, errorResponse } from '@/lib/server/api';
import { createMarketSnapshot } from '@/lib/market/snapshot-service';
import { getTokenByMint } from '@/lib/token/search-service';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { address } = params;
    const token = getTokenByMint(address);

    if (!token) {
      throw new ApiError(`Token '${address}' not found`, 404, 'TOKEN_NOT_FOUND');
    }

    const snapshot = createMarketSnapshot({
      tokenId: token.id,
      symbol: token.symbol,
      priceUsd: token.priceUsd,
      priceChange24h: token.priceChange24h,
      marketCapUsd: token.marketCapUsd.replace('$', '').replace('M', '000000').replace('B', '000000000'),
      liquidityUsd: token.liquidityUsd.replace('$', '').replace('M', '000000').replace('K', '000'),
      volume24hUsd: '8400000.00',
      buys: 1420,
      sells: 980,
      holders: 42100,
    });

    return jsonResponse({
      market: snapshot,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token market snapshot', 500));
  }
}
