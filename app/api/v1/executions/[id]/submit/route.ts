import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { swapExecutionEngine } from '@/lib/execution/engine';

export const dynamic = 'force-dynamic';

/** POST /api/v1/executions/:id/submit — submit signed payload for broadcast and reconciliation */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { signedPayload } = body;

    if (!signedPayload) {
      throw new ApiError('Missing signed transaction payload', 400);
    }

    const result = await swapExecutionEngine.submitAndConfirmExecution({
      executionId: id,
      signedPayload,
    });

    return jsonResponse({
      executionId: result.executionId,
      transactionHash: result.transactionHash,
      status: result.status,
      receipt: result.receipt,
      quality: result.quality,
      confirmation: result.confirmation,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to submit and confirm execution', 500));
  }
}
