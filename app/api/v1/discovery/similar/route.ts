import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseDiscoveryQuery, queryToFilter } from '@/lib/discovery/query-model';
import { getLiveDiscoveryTokens } from '@/lib/discovery/live-solana-feed';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(async (_ctx, request) => {
  try {
    const url = new URL(request.url);
    const referenceMint = url.searchParams.get('similarTo')?.trim();
    if (!referenceMint) throw new ApiError('similarTo is required for the Similar feed', 400, 'INVALID_REQUEST');
    const params = parseDiscoveryQuery(url);
    const tokens = await getLiveDiscoveryTokens({ ...queryToFilter(params), section: 'similar', similarTo: referenceMint });
    return jsonResponse({ section: 'similar', similarTo: referenceMint, chain: params.chain, timeWindow: params.timeWindow, updatedAt: new Date().toISOString(), tokens });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch similar tokens', 500));
  }
}, { scopes: ['READ_MARKET_DATA'], optionalAuth: true });