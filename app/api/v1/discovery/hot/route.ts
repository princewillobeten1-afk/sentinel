import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { DiscoveryToken } from '@/lib/discovery/types';
import { computeFilterFingerprint, resolveOffset, nextCursorFor } from '@/lib/discovery/cursor';
import { getLiveDiscoveryTokens } from '@/lib/discovery/live-solana-feed';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/discovery/hot
 *
 * Tokens ranked by Jupiter's organic score — its own published measure of
 * genuine versus wash-traded activity. That distinction is this platform's
 * whole premise, so "hot" here means quality of flow, not merely size of it:
 * a token can top the volume tables on wash trading and still score low.
 *
 * Deliberately separate from `trending`, which ranks by traded volume.
 */
export const GET = withApiGateway(
  async (_ctx, request) => {
    try {
      const url = new URL(request.url);
      const params = parseDiscoveryQuery(url);

      const fingerprint = computeFilterFingerprint({ section: 'hot', chain: params.chain, timeWindow: params.timeWindow });
      const offset = resolveOffset(params.offset, params.cursor, fingerprint);

      const allTokens = await getLiveDiscoveryTokens({ ...queryToFilter(params), section: 'hot' });
      const mappedTokens: DiscoveryToken[] = allTokens.slice(offset, offset + params.limit);

      const nextCursor = nextCursorFor(
        offset,
        params.limit,
        mappedTokens.length,
        fingerprint,
        offset + mappedTokens.length < allTokens.length,
      );

      return jsonResponse({
        section: 'hot',
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
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch hot tokens', 500));
    }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
