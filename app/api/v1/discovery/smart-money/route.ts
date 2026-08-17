import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { DiscoveryToken } from '@/lib/discovery/types';
import { resolveOffset, nextCursorFor, computeFilterFingerprint } from '@/lib/discovery/cursor';
import { getMockDiscoveryTokens } from '@/lib/discovery/service';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, request) => {
    try {
      const url = new URL(request.url);
      const params = parseDiscoveryQuery(url);

      const fingerprint = computeFilterFingerprint({ section: 'smart-money', chain: params.chain, timeWindow: params.timeWindow });
      const offset = resolveOffset(params.offset, params.cursor, fingerprint);

      const allTokens = getMockDiscoveryTokens({ ...queryToFilter(params), section: 'smart-money' });
      const mappedTokens: DiscoveryToken[] = allTokens.slice(offset, offset + params.limit);

      const nextCursor = nextCursorFor(
        offset,
        params.limit,
        mappedTokens.length,
        fingerprint,
        offset + mappedTokens.length < allTokens.length,
      );

      return jsonResponse({
        section: 'smart-money',
        chain: params.chain,
        timeWindow: params.timeWindow,
        updatedAt: new Date().toISOString(),
        totalCount: mappedTokens.length,
        limit: params.limit,
        offset,
        nextCursor,
        tokens: mappedTokens,
      }, 200);
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch smart money tokens', 500));
    }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
