import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { getPortfolioForWallet, PRIVATE_RESPONSE_HEADERS } from '@/lib/portfolio/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/portfolio/:wallet/performance
 *
 * Performance analytics (spec §21–§27, §35–§37, §45): trading performance,
 * holding-period segmentation, drawdown and strategy attribution. Every metric
 * carries its sample size; statistically meaningless ratios read as null
 * rather than a misleadingly precise number (spec §36, §37).
 */
export const GET = withApiGateway(
  async (ctx, request, params) => {
  try {
    const result = await getPortfolioForWallet({ user: ctx.user, wallet: params.wallet, request });

    return jsonResponse({ performance: result.performance }, 200, PRIVATE_RESPONSE_HEADERS);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load performance', 500));
  }
  },
  { scopes: ['READ_PORTFOLIO'], allowSessionAuth: true },
);
