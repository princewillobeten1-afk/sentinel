import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { validateSchema } from '@/lib/server/validation';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { CHART_TIMEFRAMES, isSolanaMint } from '@/lib/market/chart-model';
import { getChartHistory } from '@/lib/market/chart-history';

export const dynamic = 'force-dynamic';

const chartQuerySchema = z.object({
  timeframe: z.enum(CHART_TIMEFRAMES).default('15m'),
  limit: z.coerce.number().int().min(1).max(500).default(150),
  // Unix seconds. When present, returns the `limit` candles strictly before
  // this time — the progressive "load older" path.
  before: z.coerce.number().int().positive().optional(),
});

/**
 * Provider-backed, unpadded token-aggregate USD candles. No synthetic fallback.
 */
export const GET = withApiGateway(
  async (_ctx, request, params) => {
    try {
      const url = new URL(request.url);
      const query = validateSchema(chartQuerySchema, Object.fromEntries(url.searchParams));

      if (params.chain.toLowerCase() !== 'solana' || !isSolanaMint(params.address)) {
        throw new ApiError('A valid Solana mint is required for this chart.', 400);
      }
      const snapshot = await getChartHistory(params.address, query.timeframe, query.limit, query.before);
      return jsonResponse(snapshot, 200, { 'Cache-Control': 'no-store' });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch chart candles', 500));
    }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
