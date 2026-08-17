import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { dbRepository } from '@/lib/db/repository';
import { executionAuditService } from '@/lib/execution/audit-service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/executions/:id — query execution status, receipt, and audit trail */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const execution = dbRepository.getExecution(id);
    if (!execution) {
      throw new ApiError(`Execution record not found for ID: ${id}`, 404);
    }

    const receipt = dbRepository.getReceiptByExecutionId(id);
    const events = executionAuditService.getEvents(id);
    const attempts = dbRepository.getAttempts(id);

    return jsonResponse({
      executionId: execution.execution_id,
      userId: execution.user_id,
      walletAddress: execution.wallet_address,
      chainId: execution.chain_id,
      quoteId: execution.quote_id,
      status: execution.status,
      tokenIn: execution.token_in,
      tokenOut: execution.token_out,
      amountIn: execution.amount_in,
      expectedOutput: execution.expected_output,
      actualOutput: execution.actual_output,
      slippage: execution.slippage,
      route: JSON.parse(execution.route),
      receipt: receipt || null,
      attempts,
      events,
      createdAt: execution.created_at,
      updatedAt: execution.updated_at,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch execution status', 500));
  }
}
