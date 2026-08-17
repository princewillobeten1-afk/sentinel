import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { SolanaMarketDataProvider } from '@/lib/market/solana-provider';

export const dynamic = 'force-dynamic';

const provider = new SolanaMarketDataProvider();

/**
 * GET /api/v1/market/live/token/:symbol?timeframe=15m
 *
 * Debug/smoke-test surface for the real Birdeye REST provider — calls
 * SolanaMarketDataProvider directly (server-only), independent of
 * lib/market/service.ts's mock-wired client path.
 */
export async function GET(request: Request, { params }: { params: { symbol: string } }) {
  try {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') ?? '15m';

    // Sequenced rather than Promise.all: this route is a debug/smoke-test
    // surface where latency doesn't matter, and getTokenMarketData() alone
    // already fires 3 concurrent Birdeye calls internally — stacking 2 more
    // on top of that materially increases how easily a burst trips Birdeye's
    // rate limit (confirmed during manual testing).
    const marketData = await provider.getTokenMarketData(params.symbol);
    const candles = await provider.getTokenCandles(params.symbol, timeframe);
    const trades = await provider.getRecentTrades(params.symbol);

    return jsonResponse({ marketData, candles, trades });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load real market data', 500));
  }
}
