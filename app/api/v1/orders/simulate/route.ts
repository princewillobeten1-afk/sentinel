import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { executionService } from '@/lib/execution/execution-service';

export const dynamic = 'force-dynamic';

/** POST /api/v1/orders/simulate — pre-flight simulation without blockchain side-effects */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { intentId } = body;

    if (!intentId) {
      throw new ApiError('Missing intentId', 400);
    }

    const simulation = await executionService.simulateTransaction(intentId);

    return jsonResponse({
      simulation,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to simulate transaction', 500));
  }
}
