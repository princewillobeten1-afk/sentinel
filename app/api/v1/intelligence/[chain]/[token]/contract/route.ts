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
    const contractDim = report.riskDimensions.CONTRACT;

    return jsonResponse({
      token: report.token,
      contract: contractDim ? {
        score: contractDim.score,
        level: contractDim.level,
        confidence: contractDim.confidence,
        signals: contractDim.signals,
        evidence: contractDim.evidence,
        lastUpdated: contractDim.lastUpdated,
      } : null,
      observation: report.contractObservation || null,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch contract data', 500));
  }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
