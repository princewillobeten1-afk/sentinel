import { jsonResponse, errorResponse } from '@/lib/server/api';
import { withApiGateway } from '@/lib/server/api-gateway';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { rankingCache } from '@/lib/discovery/ranking-cache';
import { pgWatchlistRepository } from '@/lib/server/db/watchlist-repository';
import { ApiError } from '@/lib/server/errors';
import { computeFilterFingerprint, resolveOffset, nextCursorFor } from '@/lib/discovery/cursor';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (ctx, request) => {
  try {
    const user = ctx.user;
    const url = new URL(request.url);
    const params = parseDiscoveryQuery(url);

    // The caller's actual watchlist. This was two hardcoded mints — one of
    // which ('7xK99zK8mP2xQ5wN3a19') is not even a valid Solana address — so
    // every user's "personalized" ranking was boosted by the same two fake
    // entries regardless of what they had saved.
    const userWatchlistMints = (await pgWatchlistRepository.list(user.userId)).map((row) => row.mint);

    const personalizedList = await rankingCache.getPersonalizedRanking(
      user.userId,
      userWatchlistMints,
      params.chain,
      params.timeWindow
    );

    const fingerprint = computeFilterFingerprint({ section: 'watchlist', userId: user.userId, chain: params.chain, timeWindow: params.timeWindow });
    const offset = resolveOffset(params.offset, params.cursor, fingerprint);
    const paginated = personalizedList.slice(offset, offset + params.limit);
    const nextCursor = nextCursorFor(offset, params.limit, paginated.length, fingerprint, offset + paginated.length < personalizedList.length);

    return jsonResponse({
      section: 'watchlist',
      userId: user.userId,
      chain: params.chain,
      timeWindow: params.timeWindow,
      totalCount: personalizedList.length,
      limit: params.limit,
      offset,
      nextCursor,
      tokens: paginated,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch personalized watchlist discovery tokens', 500));
  }
  },
  { scopes: ['READ_MARKET_DATA'], allowSessionAuth: true },
);
