import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { getMockDiscoveryTokens } from '@/lib/discovery/service';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';

export const dynamic = 'force-dynamic';

/**
 * `optionalAuth: true` — confirmed via `lib/hooks/use-discovery-feed.ts` that
 * the live web app fetches this route with a plain unauthenticated `fetch()`;
 * requiring a credential here would break it. A presented API key still gets
 * full scope/rate-limit/usage-log treatment (Sprint 28 §29).
 */
export const GET = withApiGateway(async (_ctx, request) => {
  try {
    const url = new URL(request.url);
    const params = parseDiscoveryQuery(url);
    const filter = queryToFilter(params);

    const tokens = getMockDiscoveryTokens(filter);

    return jsonResponse({
      engine: 'Sentinel Token Discovery Engine v1',
      availableEndpoints: [
        '/api/v1/discovery/trending',
        '/api/v1/discovery/new',
        '/api/v1/discovery/momentum',
        '/api/v1/discovery/volume',
        '/api/v1/discovery/liquidity',
        '/api/v1/discovery/movers',
        '/api/v1/discovery/watchlist',
        '/api/v1/discovery/screen [POST]',
        '/api/v1/discovery/:token/signals',
      ],
      chain: params.chain,
      timeWindow: params.timeWindow,
      totalDiscovered: tokens.length,
      topToken: tokens[0] ? { name: tokens[0].name, symbol: tokens[0].symbol, score: tokens[0].discoveryScore.totalScore } : null,
      tokens,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch discovery overview', 500));
  }
}, { scopes: ['READ_MARKET_DATA'], optionalAuth: true });
