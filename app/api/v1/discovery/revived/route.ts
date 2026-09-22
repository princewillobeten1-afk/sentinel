import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { getLiveDiscoveryTokens } from '@/lib/discovery/live-solana-feed';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(async (_ctx, request) => {
  try {
    const params = parseDiscoveryQuery(new URL(request.url));
    const tokens = await getLiveDiscoveryTokens({ ...queryToFilter(params), section: 'revived' });
    return jsonResponse({ section: 'revived', chain: params.chain, timeWindow: params.timeWindow, updatedAt: new Date().toISOString(), tokens });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch revived tokens', 500));
  }
}, { scopes: ['READ_MARKET_DATA'], optionalAuth: true });