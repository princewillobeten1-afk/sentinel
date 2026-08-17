import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { getPortfolioForWallet, PRIVATE_RESPONSE_HEADERS } from '@/lib/portfolio/service';
import { interpretPortfolioRisk } from '@/lib/portfolio/portfolio-risk';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/portfolio/:wallet/risk
 *
 * Risk Center payload (spec §15, §16, §45, §61): portfolio risk score, its
 * weighted decomposition, named drivers with evidence, and the positions each
 * driver implicates — never a recommendation to trade (spec §63).
 */
export const GET = withApiGateway(
  async (ctx, request, params) => {
  try {
    const result = await getPortfolioForWallet({ user: ctx.user, wallet: params.wallet, request });
    const interpretation = interpretPortfolioRisk(result.risk);

    const positionRisk = result.positions
      .filter((position) => position.status !== 'CLOSED')
      .map((position) => ({
        positionId: position.id,
        symbol: position.symbol,
        allocationPct: position.allocationPct,
        risk: position.risk,
      }))
      .sort((a, b) => b.risk.score - a.risk.score);

    return jsonResponse(
      {
        portfolioRisk: result.risk,
        headline: interpretation.headline,
        drivers: interpretation.drivers,
        positions: positionRisk,
        isAdvisory: false,
      },
      200,
      PRIVATE_RESPONSE_HEADERS,
    );
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load risk', 500));
  }
  },
  { scopes: ['READ_PORTFOLIO'], allowSessionAuth: true },
);
