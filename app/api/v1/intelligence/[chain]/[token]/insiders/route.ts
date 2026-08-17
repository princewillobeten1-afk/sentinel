import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { MOCK_TOKENS } from '@/lib/mocks/intelligence';
import {
  getSentActivityData,
  getQuantActivityData,
  getBonkActivityData,
  getAlphaActivityData,
} from '@/lib/mocks/activity-mocks';
import { analyzeInsiderCandidates } from '@/lib/activity/insider-engine';
import { withApiGateway } from '@/lib/server/api-gateway';

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

    let report;
    if (symbol === 'SENT') {
      const data = getSentActivityData();
      report = analyzeInsiderCandidates({ trades: data.trades, context: data.context });
    } else if (symbol === 'QUANT') {
      const data = getQuantActivityData();
      report = analyzeInsiderCandidates({ trades: data.trades, context: data.context });
    } else if (symbol === 'BONK') {
      const data = getBonkActivityData();
      report = analyzeInsiderCandidates({ trades: data.trades, context: data.context });
    } else if (symbol === 'ALPHA') {
      const data = getAlphaActivityData();
      report = analyzeInsiderCandidates({
        trades: data.trades,
        context: data.context,
        currentPositionsUsd: data.currentPositionsUsd,
        realizedPnlUsd: data.realizedPnlUsd,
        unrealizedPnlUsd: data.unrealizedPnlUsd,
      });
    } else {
      throw new ApiError(`No insider data for token: ${symbol}`, 404, 'NO_DATA');
    }

    return jsonResponse({
      tokenId: tokenIdentity.id,
      symbol,
      chain,
      report,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch insider detection report', 500),
    );
  }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
