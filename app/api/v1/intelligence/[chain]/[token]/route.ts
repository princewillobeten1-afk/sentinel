import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { generateReport } from '@/lib/intelligence/report-generator';
import { getMockReportInput, MOCK_TOKENS } from '@/lib/mocks/intelligence';
import { intelligenceStore } from '@/lib/intelligence/store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:address/intelligence (Sprint 28 §16)
 *
 * `optionalAuth: true` — this route was public/unauthenticated before this
 * sprint and nothing in the existing web app was confirmed to send a
 * credential to it. Requiring one would risk silently breaking any existing
 * caller; a presented API key is still fully scope-checked/rate-limited/
 * metered when one IS sent, so developer traffic gets the real gateway.
 */
export const GET = withApiGateway(
  async (_ctx, _request, params) => {
    try {
      const { chain, token } = params;
      const symbol = token.toUpperCase();

      if (chain !== 'solana') {
        throw new ApiError(`Unsupported chain: ${chain}`, 400, 'UNSUPPORTED_CHAIN');
      }

      const tokenIdentity = MOCK_TOKENS[symbol];
      if (!tokenIdentity) {
        throw new ApiError(`Token not found: ${symbol}`, 404, 'TOKEN_NOT_FOUND');
      }

      const cached = intelligenceStore.getCurrentReport(tokenIdentity.id);
      if (cached && intelligenceStore.isCacheFresh(tokenIdentity.id)) {
        return jsonResponse({ ...cached, _meta: { source: 'cache', cachedAt: cached.generatedAt } });
      }

      const input = getMockReportInput(symbol);
      if (!input) {
        throw new ApiError(`No intelligence data available for ${symbol}`, 404, 'NO_DATA');
      }

      const report = generateReport(input);
      intelligenceStore.storeReport(tokenIdentity.id, report);

      return jsonResponse(report);
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to generate intelligence report', 500));
    }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
