import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { discoveryScreenSchema, queryToFilter } from '@/lib/discovery/query-model';
import { getMockDiscoveryTokens } from '@/lib/discovery/service';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { computeFilterFingerprint, resolveOffset, nextCursorFor } from '@/lib/discovery/cursor';

export const dynamic = 'force-dynamic';

export const POST = withApiGateway(
  async (_ctx, request) => {
  try {
    checkRateLimit('discovery_screen', 30, 60000);

    const body = await parseJsonBody(request);
    const params = validateSchema(discoveryScreenSchema, body);
    const filter = queryToFilter(params);

    const filteredTokens = getMockDiscoveryTokens(filter);

    // Apply sorting according to params.sort
    const sorted = [...filteredTokens].sort((a, b) => {
      switch (params.sort) {
        case 'trending':
          return b.discoveryScore.totalScore - a.discoveryScore.totalScore;
        case 'volume':
          return parseFloat(b.volume24hUsd) - parseFloat(a.volume24hUsd);
        case 'liquidity':
          return parseFloat(b.liquidityUsd) - parseFloat(a.liquidityUsd);
        case 'age':
          return a.ageMinutes - b.ageMinutes;
        case 'price_change':
          return b.priceChange15m - a.priceChange15m;
        case 'market_cap':
          return parseFloat(b.marketCapUsd) - parseFloat(a.marketCapUsd);
        case 'score':
        default:
          return b.discoveryScore.totalScore - a.discoveryScore.totalScore;
      }
    });

    const fingerprint = computeFilterFingerprint({ section: 'screen', sort: params.sort, ...filter });
    const offset = resolveOffset(params.offset, params.cursor, fingerprint);
    const paginated = sorted.slice(offset, offset + params.limit);
    const nextCursor = nextCursorFor(offset, params.limit, paginated.length, fingerprint, offset + paginated.length < sorted.length);

    return jsonResponse({
      screened: true,
      appliedFilters: filter,
      sort: params.sort,
      totalCount: sorted.length,
      limit: params.limit,
      offset,
      nextCursor,
      tokens: paginated,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to run discovery token screening', 500));
  }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
