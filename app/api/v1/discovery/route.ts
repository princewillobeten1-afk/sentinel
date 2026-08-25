import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { getLiveDiscoveryTokens } from '@/lib/discovery/live-solana-feed';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(async (_ctx, request) => {
  try {
    const url = new URL(request.url);
    const params = parseDiscoveryQuery(url);
    const filter = queryToFilter(params);

    const tokens = await getLiveDiscoveryTokens(filter);

    return jsonResponse({
      engine: 'Sentinel Live Token Discovery Engine v2',
      availableEndpoints: [
        '/api/v1/discovery/trending',
        '/api/v1/discovery/new',
        '/api/v1/discovery/migrating',
        '/api/v1/discovery/graduated',
        '/api/v1/discovery/momentum',
        '/api/v1/discovery/volume',
        '/api/v1/discovery/liquidity',
        '/api/v1/discovery/movers',
        '/api/v1/discovery/smart-money',
        '/api/v1/discovery/ai-picks',
        '/api/v1/discovery/watchlist',
      ],
      chain: params.chain,
      timeWindow: params.timeWindow,
      totalDiscovered: tokens.length,
      topToken: tokens[0] ? { name: tokens[0].name, symbol: tokens[0].symbol, score: tokens[0].discoveryScore?.totalScore } : null,
      tokens,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch discovery overview', 500));
  }
}, { scopes: ['READ_MARKET_DATA'], optionalAuth: true });
