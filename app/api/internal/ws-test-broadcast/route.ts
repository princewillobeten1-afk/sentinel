import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  topic: z.string().min(1),
  data: z.unknown().optional(),
});

/**
 * POST /api/internal/ws-test-broadcast — dev-only. Fires a synthetic event
 * directly through `broadcast()`, bypassing the real Birdeye/Helius signal
 * pipeline entirely. Exists because that pipeline is the only other way to
 * exercise the WS fan-out path, and it's routinely disabled locally
 * (`MARKET_STREAM_ENABLED=false`) to save bandwidth — this lets WS behavior
 * (subscriptions, per-topic sequencing, backpressure) be verified without
 * turning the live stream back on.
 */
export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError('Not available in production.', 404, 'NOT_FOUND');
    }

    const payload = await parseJsonBody(request);
    const { topic, data } = validateSchema(bodySchema, payload);

    const { broadcast } = await import('@/lib/ws/server');
    broadcast(topic, data ?? { test: true, sentAt: new Date().toISOString() });

    return jsonResponse({ broadcasted: true, topic });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to broadcast test event', 500));
  }
}
