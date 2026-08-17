import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { swapExecutionEngine } from '@/lib/execution/engine';
import { SwapExecutionRequest } from '@/lib/execution/types';

export const dynamic = 'force-dynamic';

/** POST /api/v1/executions — initiate, validate, route, simulate, and prepare swap execution */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      idempotencyKey,
      userId = 'user_default',
      walletAddress,
      chainId = 'solana',
      tokenIn,
      tokenOut,
      amountIn,
      slippage = 0.5,
      quoteId,
      mevStrategy,
    } = body;

    if (!idempotencyKey || !walletAddress || !tokenIn || !tokenOut || !amountIn || !quoteId) {
      throw new ApiError('Missing required swap execution parameters (idempotencyKey, walletAddress, tokenIn, tokenOut, amountIn, quoteId)', 400);
    }

    const execRequest: SwapExecutionRequest = {
      idempotencyKey,
      userId,
      walletAddress,
      chainId,
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      slippage: parseFloat(slippage.toString()),
      quoteId,
      mevStrategy,
    };

    const result = await swapExecutionEngine.prepareExecution(execRequest);

    return jsonResponse({
      executionId: result.executionId,
      status: result.status,
      intent: {
        intentId: result.intent.intentId,
        idempotencyKey: result.intent.idempotencyKey,
        isDuplicate: result.intent.isDuplicate,
        payload: result.intent.payload,
      },
      route: result.route,
      simulation: result.simulation,
      gasEstimate: result.gasEstimate,
      protection: result.protection,
      approvalCheck: result.approvalCheck,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to prepare swap execution', 500));
  }
}
