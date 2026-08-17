import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { MOCK_TOKENS } from '@/lib/mocks/intelligence';
import {
  getSentActivityData,
  getQuantActivityData,
  getBonkActivityData,
  getAlphaActivityData,
} from '@/lib/mocks/activity-mocks';
import { analyzeOrganicActivity } from '@/lib/activity/organic-engine';
import type { ActivityWindow } from '@/lib/activity/types';
import { withApiGateway } from '@/lib/server/api-gateway';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, request, params) => {
  try {
    const { chain, token } = params;
    const symbol = token.toUpperCase();
    const url = new URL(request.url);
    const windowParam = (url.searchParams.get('window') as ActivityWindow) || '1h';

    if (chain !== 'solana') {
      throw new ApiError(`Unsupported chain: ${chain}`, 400, 'UNSUPPORTED_CHAIN');
    }

    const tokenIdentity = MOCK_TOKENS[symbol];
    if (!tokenIdentity) {
      throw new ApiError(`Token not found: ${symbol}`, 404, 'TOKEN_NOT_FOUND');
    }

    let data;
    if (symbol === 'SENT') data = getSentActivityData();
    else if (symbol === 'QUANT') data = getQuantActivityData();
    else if (symbol === 'BONK') data = getBonkActivityData();
    else if (symbol === 'ALPHA') data = getAlphaActivityData();
    else throw new ApiError(`No data for token: ${symbol}`, 404, 'NO_DATA');

    const organicResult = analyzeOrganicActivity({
      trades: data.trades,
      context: data.context,
      windows: ['1m', '5m', '15m', '1h', '4h', '24h', '7d'],
    });

    const targetAssessment = organicResult.assessments[windowParam] ?? organicResult.primaryAssessment;

    return jsonResponse({
      tokenId: tokenIdentity.id,
      symbol,
      chain,
      window: windowParam,
      primaryWindow: organicResult.primaryWindow,
      assessment: targetAssessment,
      allAssessments: organicResult.assessments,
      featureStore: organicResult.featureStore,
      generatedAt: organicResult.generatedAt,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch organic volume assessment', 500),
    );
  }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
