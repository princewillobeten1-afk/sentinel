import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { toNansenChain } from '@/lib/nansen/chains';
import {
  fetchNansenSmartMoneyDexTrades,
  fetchNansenSmartMoneyHoldings,
  fetchNansenSmartMoneyLeaderboard,
  fetchNansenSmartMoneyNetflow,
  fetchNansenSmartMoneyScreener,
  getNansenRateLimitStatus,
  isNansenConfigured,
} from '@/lib/nansen/client';
import type { NansenRadarView, NansenSmartMoneyRadarResponse } from '@/lib/nansen/types';

export const dynamic = 'force-dynamic';

const VALID_VIEWS = new Set<NansenRadarView>([
  'screener',
  'netflow',
  'holdings',
  'dex-trades',
  'leaderboard',
]);

const VALID_SCREENER_TIMEFRAMES = new Set([
  '5m',
  '10m',
  '1h',
  '6h',
  '24h',
  '7d',
  '30d',
]);

/**
 * GET /api/v1/nansen/smart-money
 *
 * Fetches ONLY the requested Smart Money radar view (`screener` default = 1 credit)
 * across `solana`, `robinhood`, or `all`.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawChain = url.searchParams.get('chain') ?? 'solana';
    const rawView = (url.searchParams.get('view') ?? 'screener').trim().toLowerCase() as NansenRadarView;
    const rawTimeframe = url.searchParams.get('timeframe') ?? '24h';
    const rawLimit = Number(url.searchParams.get('limit') ?? '25');
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 25;

    if (!VALID_VIEWS.has(rawView)) {
      throw new ApiError('Invalid Smart Money view parameter', 400);
    }

    const chain = toNansenChain(rawChain);
    const timeframe = VALID_SCREENER_TIMEFRAMES.has(rawTimeframe) ? rawTimeframe : '24h';
    const configured = isNansenConfigured();

    const base: NansenSmartMoneyRadarResponse = {
      configured,
      chain,
      view: rawView,
      timeframe,
      screener: [],
      netflows: [],
      holdings: [],
      dexTrades: [],
      leaderboard: [],
      pagination: null,
      rateLimit: getNansenRateLimitStatus(),
      fetchedAt: new Date().toISOString(),
    };

    if (!configured) {
      return jsonResponse(base as unknown as Record<string, unknown>);
    }

    const chains = [chain];

    if (rawView === 'screener') {
      const res = await fetchNansenSmartMoneyScreener({
        chains,
        timeframe: timeframe as '5m' | '10m' | '1h' | '6h' | '24h' | '7d' | '30d',
        perPage: limit,
      });
      base.screener = res?.data ?? [];
      base.pagination = res?.pagination ?? null;
    } else if (rawView === 'netflow') {
      const res = await fetchNansenSmartMoneyNetflow({ chains, perPage: limit });
      base.netflows = res?.data ?? [];
      base.pagination = res?.pagination ?? null;
    } else if (rawView === 'holdings') {
      const res = await fetchNansenSmartMoneyHoldings({ chains, perPage: limit });
      base.holdings = res?.data ?? [];
      base.pagination = res?.pagination ?? null;
    } else if (rawView === 'dex-trades') {
      const res = await fetchNansenSmartMoneyDexTrades({ chains, perPage: limit });
      base.dexTrades = res?.data ?? [];
      base.pagination = res?.pagination ?? null;
    } else if (rawView === 'leaderboard') {
      const res = await fetchNansenSmartMoneyLeaderboard({ chains, timeframe: 30, perPage: limit });
      base.leaderboard = res?.data ?? [];
      base.pagination = res?.pagination ?? null;
    }

    base.rateLimit = getNansenRateLimitStatus();
    base.fetchedAt = new Date().toISOString();
    return jsonResponse(base as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch Smart Money data', 500),
    );
  }
}
