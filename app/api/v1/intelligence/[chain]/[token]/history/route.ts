import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { intelligenceStore } from '@/lib/intelligence/store';
import { MOCK_TOKENS } from '@/lib/mocks/intelligence';

export const dynamic = 'force-dynamic';

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

    const snapshots = intelligenceStore.getSnapshots(tokenIdentity.id);

    return jsonResponse({
      token: tokenIdentity,
      totalSnapshots: snapshots.length,
      snapshots: snapshots.map(s => ({
        id: s.id,
        overallScore: s.overallScore,
        riskLevel: s.riskLevel,
        confidence: s.confidence,
        riskScores: s.riskScores,
        signalCount: s.signalCount,
        warningCount: s.warningCount,
        positiveCount: s.positiveCount,
        methodologyVersion: s.methodologyVersion,
        snapshotAt: s.snapshotAt,
      })),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch history', 500));
  }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
