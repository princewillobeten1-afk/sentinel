import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { canonicalMarketRegistry } from '@/lib/market-data/discovery/market-registry';
import { MarketStatus } from '@/lib/market-data/types';

export const dynamic = 'force-dynamic';

/** GET /api/v1/markets — list tracked markets with chain, protocol, and status filters */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const chainId = url.searchParams.get('chainId') || undefined;
    const protocol = url.searchParams.get('protocol') || undefined;
    const status = (url.searchParams.get('status') as MarketStatus) || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;

    const markets = canonicalMarketRegistry.listMarkets({
      chainId,
      protocol,
      status,
      limit,
    });

    return jsonResponse({
      markets,
      count: markets.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch markets', 500));
  }
}
