import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { marketStreamManager } from '@/lib/market/live/stream-manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/market/live/status
 *
 * Debug/smoke-test surface for the Birdeye + Helius streaming integration.
 * Importing `marketStreamManager` here also guarantees `start()` has run at
 * least once (defense-in-depth alongside instrumentation.ts's boot-time call
 * — start() is idempotent, so this never opens a second connection).
 */
export async function GET() {
  try {
    marketStreamManager.start();
    return jsonResponse(marketStreamManager.getHealth());
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to read stream status', 500));
  }
}
