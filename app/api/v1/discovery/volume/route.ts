import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { getTokenListV3 } from '@/lib/api/birdeye/discovery';
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

      const fingerprint = computeFilterFingerprint({ section: 'volume', chain: params.chain, timeWindow: params.timeWindow });
      const offset = resolveOffset(params.offset, params.cursor, fingerprint);

      let mappedTokens: DiscoveryToken[] = [];
      let nextCursor: string | null = null;
      let hit = false;

      try {
        const cacheKey = `volume:${params.chain}:v24hUSD:desc::${params.limit}:${offset}`;
        const feedResult = await externalFeedCache.getOrFetch(cacheKey, () =>
          getTokenListV3({
            limit: params.limit,
            offset,
            sort_by: 'v24hUSD',
            sort_type: 'desc',
          }),
        );
        hit = feedResult.hit;

        mappedTokens = feedResult.value.items.map((t) =>
          mapBirdeyeToDiscoveryToken(t, params.chain)
        );

        nextCursor = nextCursorFor(offset, params.limit, mappedTokens.length, fingerprint, feedResult.value.has_next);
      } catch {
        const mock = getMockDiscoveryTokens(queryToFilter(params));
        mappedTokens = mock.slice(offset, offset + params.limit);
      }

      return jsonResponse({
        section: 'volume',
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
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch volume discovery tokens', 500));
    }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
