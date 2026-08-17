import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { getPortfolioForWallet, PRIVATE_RESPONSE_HEADERS } from '@/lib/portfolio/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/portfolio/:wallet/exposure
 *
 * Exposure & concentration (spec §17, §18, §19, §45): breakdown by token,
 * chain, risk class and creator, plus liquidity-adjusted exposure.
 */
export const GET = withApiGateway(
  async (ctx, request, params) => {
  try {
    const result = await getPortfolioForWallet({ user: ctx.user, wallet: params.wallet, request });

    return jsonResponse({ exposure: result.exposure }, 200, PRIVATE_RESPONSE_HEADERS);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load exposure', 500));
  }
  },
  { scopes: ['READ_PORTFOLIO'], allowSessionAuth: true },
);
