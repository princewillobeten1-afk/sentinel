export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { ExecutionEngine } from '@/lib/execution/engine';
import { Quote } from '@/lib/execution/types';

const engine = new ExecutionEngine();

export const POST = withApiGateway(
  async (ctx, request) => {
    try {
      const body = await request.json();
      const quote: Quote = body.quote;
      const wallet: string = body.wallet || ctx.user.primaryWalletAddress || '';

      if (!quote) {
        throw new ApiError('Quote required', 400, 'MISSING_QUOTE');
      }

      const simulation = await engine.preflightCheck(quote, wallet);
      return jsonResponse(simulation);
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to simulate execution', 500));
    }
  },
  { scopes: ['TRADE'], allowSessionAuth: true },
);
