export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { ExecutionEngine } from '@/lib/execution/engine';
import { ExecutionRequest, ExecutionPolicy, MEVPreference } from '@/lib/execution/types';

const engine = new ExecutionEngine();

export const POST = withApiGateway(
  async (ctx, request) => {
    try {
      const body = await request.json();

      const execReq: ExecutionRequest = {
        wallet: body.wallet || ctx.user.primaryWalletAddress || '',
        chain: body.chain || 'ETHEREUM',
        tokenIn: body.tokenIn,
        tokenOut: body.tokenOut,
        amount: body.amount,
        side: body.side || 'BUY',
        orderType: body.orderType || 'MARKET',
        slippageLimit: body.slippageLimit || 0.01,
        priority: body.priority || 'NORMAL',
        executionPolicy: body.executionPolicy || ExecutionPolicy.BALANCED,
        mevPreference: body.mevPreference || MEVPreference.STANDARD,
      };

      const quotes = await engine.getQuotes(execReq);

      return jsonResponse({ quotes });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch execution quotes', 500));
    }
  },
  { scopes: ['TRADE'], allowSessionAuth: true },
);
