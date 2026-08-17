import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { validateSchema } from '@/lib/server/validation';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { generateCandleRange, SUPPORTED_TIMEFRAMES } from '@/lib/market/mock-ohlcv';

export const dynamic = 'force-dynamic';

const chartQuerySchema = z.object({
  timeframe: z.enum(SUPPORTED_TIMEFRAMES).default('15m'),
  limit: z.coerce.number().int().min(1).max(500).default(150),
  // Unix seconds. When present, returns the `limit` candles strictly before
  // this time — the progressive "load older" path.
  before: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/v1/tokens/:chain/:address/chart — real, paginated OHLCV candles
 * (Sprint 31 — Item 12), replacing a hardcoded 5-candle stub. Backed by a
 * deterministic generator (`lib/market/mock-ohlcv.ts`), not a live feed —
 * see docs/performance/README.md for what's real vs simulated here.
 */
export const GET = withApiGateway(
  async (_ctx, request, params) => {
    try {
      const url = new URL(request.url);
      const query = validateSchema(chartQuerySchema, Object.fromEntries(url.searchParams));

      const { candles, hasMore } = generateCandleRange(params.address, query.timeframe, {
        count: query.limit,
        beforeTimeSeconds: query.before,
      });

      return jsonResponse({
        chain: params.chain,
        address: params.address,
        timeframe: query.timeframe,
        candles,
        hasMore,
        oldestTime: candles[0]?.time ?? null,
      });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch chart candles', 500));
    }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
