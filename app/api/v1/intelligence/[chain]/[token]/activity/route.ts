import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { MOCK_TOKENS } from '@/lib/mocks/intelligence';
import {
  getSentActivityData,
  getQuantActivityData,
  getBonkActivityData,
  getAlphaActivityData,
} from '@/lib/mocks/activity-mocks';
import { processActivityPipeline } from '@/lib/activity/pipeline';
import type { ActivityWindow } from '@/lib/activity/types';

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

    let pipelineRes;
    if (symbol === 'SENT') {
      const data = getSentActivityData();
      pipelineRes = processActivityPipeline({ trades: data.trades, context: data.context, windows: [windowParam] });
    } else if (symbol === 'QUANT') {
      const data = getQuantActivityData();
      pipelineRes = processActivityPipeline({ trades: data.trades, context: data.context, windows: [windowParam] });
    } else if (symbol === 'BONK') {
      const data = getBonkActivityData();
      pipelineRes = processActivityPipeline({ trades: data.trades, context: data.context, windows: [windowParam] });
    } else if (symbol === 'ALPHA') {
      const data = getAlphaActivityData();
      pipelineRes = processActivityPipeline({
        trades: data.trades,
        context: data.context,
        currentPositionsUsd: data.currentPositionsUsd,
        realizedPnlUsd: data.realizedPnlUsd,
        unrealizedPnlUsd: data.unrealizedPnlUsd,
        windows: [windowParam],
      });
    } else {
      throw new ApiError(`No activity data for token: ${symbol}`, 404, 'NO_DATA');
    }

    return jsonResponse({
      tokenId: tokenIdentity.id,
      symbol,
      chain,
      organicAssessment: pipelineRes.organicAssessment,
      insiderReport: pipelineRes.insiderReport,
      featureStore: pipelineRes.featureStore,
      alertEvents: pipelineRes.alertEvents,
      processedAt: pipelineRes.processedAt,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch activity report', 500),
    );
  }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
