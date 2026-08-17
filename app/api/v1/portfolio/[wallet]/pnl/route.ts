import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { getPortfolioForWallet, PRIVATE_RESPONSE_HEADERS } from '@/lib/portfolio/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/portfolio/:wallet/pnl
 *
 * True Net P&L dashboard (spec §4, §5, §21, §45): realized, unrealized, fees
 * and net for Today / 7D / 30D / All-time, plus per-token attribution.
 */
export const GET = withApiGateway(
  async (ctx, request, params) => {
  try {
    const result = await getPortfolioForWallet({ user: ctx.user, wallet: params.wallet, request });

    return jsonResponse(
      {
        overview: {
          realizedPnl: result.overview.realizedPnl,
          unrealizedPnl: result.overview.unrealizedPnl,
          netPnl: result.overview.netPnl,
          fees: result.overview.fees,
          todayChange: result.overview.todayChange,
          todayChangePct: result.overview.todayChangePct,
        },
        windows: result.performance.windows.map((window) => ({
          window: window.window,
          from: window.from,
          to: window.to,
          netPnl: window.netPnl,
          realizedPnl: window.realizedPnl,
          unrealizedPnl: window.unrealizedPnl,
          fees: window.fees,
          tradingVolumeUsd: window.tradingVolumeUsd,
          drawdown: window.drawdown,
          sample: window.sample,
        })),
        attribution: result.performance.attribution,
        executionCosts: result.performance.executionCosts,
        positions: result.positions.map((position) => ({
          id: position.id,
          symbol: position.symbol,
          realizedPnl: position.pnl.realized,
          unrealizedPnl: position.pnl.unrealized,
          netPnl: position.pnl.net,
          fees: position.pnl.fees,
          hasUnknownBasis: position.pnl.hasUnknownBasis,
        })),
        limitations: result.performance.limitations,
      },
      200,
      PRIVATE_RESPONSE_HEADERS,
    );
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load P&L', 500));
  }
  },
  { scopes: ['READ_PORTFOLIO'], allowSessionAuth: true },
);
