import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { generateReport } from '@/lib/intelligence/report-generator';
import { getMockReportInput, MOCK_TOKENS } from '@/lib/mocks/intelligence';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, _request, params) => {
  try {
    const { chain, token } = params;
    const symbol = token.toUpperCase();

    if (chain !== 'solana') throw new ApiError(`Unsupported chain: ${chain}`, 400, 'UNSUPPORTED_CHAIN');
    if (!MOCK_TOKENS[symbol]) throw new ApiError(`Token not found: ${symbol}`, 404, 'TOKEN_NOT_FOUND');

    const input = getMockReportInput(symbol);
    if (!input) throw new ApiError(`No data for ${symbol}`, 404, 'NO_DATA');

    const report = generateReport(input);
    const liqDim = report.riskDimensions.LIQUIDITY;

    return jsonResponse({
      token: report.token,
      liquidity: liqDim ? {
        score: liqDim.score,
        level: liqDim.level,
        confidence: liqDim.confidence,
        signals: liqDim.signals,
        evidence: liqDim.evidence,
        lastUpdated: liqDim.lastUpdated,
      } : null,
      pools: input.liquidity?.pools || [],
      priceImpactEstimates: report.priceImpactEstimates,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch liquidity data', 500));
  }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
