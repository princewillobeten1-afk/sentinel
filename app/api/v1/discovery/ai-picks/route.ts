import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { DiscoveryToken } from '@/lib/discovery/types';
import { computeFilterFingerprint, resolveOffset, nextCursorFor } from '@/lib/discovery/cursor';
import { getLiveDiscoveryTokens } from '@/lib/discovery/live-solana-feed';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, request) => {
    try {
      const url = new URL(request.url);
      const params = parseDiscoveryQuery(url);

      const fingerprint = computeFilterFingerprint({ section: 'ai-picks', chain: params.chain, timeWindow: params.timeWindow });
      const offset = resolveOffset(params.offset, params.cursor, fingerprint);

      const allTokens = await getLiveDiscoveryTokens({ ...queryToFilter(params), section: 'ai-picks' });
      const mappedTokens: DiscoveryToken[] = allTokens.slice(offset, offset + params.limit);

      const nextCursor = nextCursorFor(
        offset,
        params.limit,
        mappedTokens.length,
        fingerprint,
        offset + mappedTokens.length < allTokens.length,
      );

      return jsonResponse({
        section: 'ai-picks',
        chain: params.chain,
        timeWindow: params.timeWindow,
        updatedAt: new Date().toISOString(),
        totalCount: allTokens.length,
        limit: params.limit,
        offset,
        nextCursor,
        tokens: mappedTokens,
      }, 200);
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch ai-picks tokens', 500));
    }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
