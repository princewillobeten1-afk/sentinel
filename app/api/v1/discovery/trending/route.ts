import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { getTrendingTokens } from '@/lib/api/birdeye/discovery';
import { mapBirdeyeToDiscoveryToken } from '@/lib/api/birdeye/mapper';
import { DiscoveryToken } from '@/lib/discovery/types';
import { externalFeedCache } from '@/lib/discovery/external-feed-cache';
import { computeFilterFingerprint, resolveOffset, nextCursorFor } from '@/lib/discovery/cursor';
import { getMockDiscoveryTokens } from '@/lib/discovery/service';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, request) => {
    try {
      const url = new URL(request.url);
      const params = parseDiscoveryQuery(url);

      const fingerprint = computeFilterFingerprint({ section: 'trending', chain: params.chain, timeWindow: params.timeWindow });
      const offset = resolveOffset(params.offset, params.cursor, fingerprint);

      let mappedTokens: DiscoveryToken[] = [];
      let nextCursor: string | null = null;
      let hit = false;

      try {
        const cacheKey = `trending:${params.chain}:rank:asc::${params.limit}:${offset}`;
        const feedResult = await externalFeedCache.getOrFetch(cacheKey, () =>
          getTrendingTokens({
            limit: params.limit,
            offset,
            chain: params.chain,
            sort_by: 'rank',
            sort_type: 'asc',
          }),
        );
        hit = feedResult.hit;

        mappedTokens = feedResult.value.tokens.map((t) =>
          mapBirdeyeToDiscoveryToken(t, params.chain)
        );

        nextCursor = nextCursorFor(
          offset,
          params.limit,
          mappedTokens.length,
          fingerprint,
          offset + mappedTokens.length < feedResult.value.total,
        );
      } catch {
        const mock = getMockDiscoveryTokens(queryToFilter(params));
        mappedTokens = mock.slice(offset, offset + params.limit);
      }

      return jsonResponse({
        section: 'trending',
        chain: params.chain,
        timeWindow: params.timeWindow,
        updatedAt: new Date().toISOString(),
        totalCount: mappedTokens.length,
        limit: params.limit,
        offset,
        nextCursor,
        tokens: mappedTokens,
      }, 200, { 'X-Cache': hit ? 'HIT' : 'MISS' });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch trending tokens', 500));
    }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
