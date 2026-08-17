import { jsonResponse, errorResponse } from '@/lib/server/api';
import { getMockDiscoveryTokens } from '@/lib/discovery/service';
import { detectAnomalies } from '@/lib/discovery/anomaly-detector';
import { calculateTrendingScore } from '@/lib/discovery/trending-engine';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, _request, params) => {
  try {
    const tokenQuery = params.token;

    // Search by mint or symbol
    const allTokens = getMockDiscoveryTokens();
    const token = allTokens.find(
      (t) => t.mint.toLowerCase() === tokenQuery.toLowerCase() || t.symbol.toLowerCase() === tokenQuery.toLowerCase()
    ) || allTokens[0]; // fallback to top token if test query

    const anomalies = detectAnomalies(token);
    const trending = calculateTrendingScore(token, '15m');

    return jsonResponse({
      token: {
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        mint: token.mint,
        chain: token.chain,
      },
      discoveryScore: token.discoveryScore,
      trending,
      anomalies,
      signalsCount: token.discoveryScore.signals.length,
      signals: token.discoveryScore.signals,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token signals', 500));
  }
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
