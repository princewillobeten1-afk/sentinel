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

    if (chain !== 'solana') {
      throw new ApiError(`Unsupported chain: ${chain}`, 400, 'UNSUPPORTED_CHAIN');
    }

    if (!MOCK_TOKENS[symbol]) {
      throw new ApiError(`Token not found: ${symbol}`, 404, 'TOKEN_NOT_FOUND');
    }

    const input = getMockReportInput(symbol);
    if (!input) {
      throw new ApiError(`No intelligence data for ${symbol}`, 404, 'NO_DATA');
    }

    const report = generateReport(input);

    return jsonResponse({
      token: report.token,
      totalSignals: report.signals.length,
      warnings: report.warnings.length,
      positives: report.positives.length,
      signals: report.signals.map(s => ({
        id: s.id,
        type: s.type,
        category: s.category,
        severity: s.severity,
        polarity: s.polarity,
        value: s.value,
        confidence: s.confidence,
        evidence: s.evidence,
        observedAt: s.observedAt,
        methodologyVersion: s.methodologyVersion,
      })),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch signals', 500));
  }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
