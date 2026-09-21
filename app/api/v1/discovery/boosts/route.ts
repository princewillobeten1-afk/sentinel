import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { dexScreenerBoostsService } from '@/lib/discovery/dexscreener-boosts';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, request) => {
    try {
      const url = new URL(request.url);
      const chain = url.searchParams.get('chain') || undefined;
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));

      dexScreenerBoostsService.start();
      const health = dexScreenerBoostsService.getHealth();
      const allBoosts = dexScreenerBoostsService.getAllBoosts(chain);
      const sliced = allBoosts.slice(0, limit);

      return jsonResponse(
        {
          health,
          total: allBoosts.length,
          limit,
          boosts: sliced,
        },
        200,
      );
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token boosts', 500));
    }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
