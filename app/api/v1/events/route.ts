export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { eventBus } from '@/lib/server/events/event-bus';

/**
 * GET /api/v1/events?after=:sequence&since=:timestamp
 *
 * Sequence-based / timestamp-based event catch-up endpoint for reconnecting WebSocket clients.
 * Prevents missing token creation, price updates, or trades during transient connection drops.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const afterSequence = url.searchParams.get('after') ? Number(url.searchParams.get('after')) : undefined;
    const sinceTimestamp = url.searchParams.get('since') ? Number(url.searchParams.get('since')) : undefined;

    const events = eventBus.getEventsAfter(afterSequence, sinceTimestamp);

    return jsonResponse({
      count: events.length,
      latestSequence: events[events.length - 1]?.sequence ?? afterSequence ?? 0,
      events,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error(String(error)));
  }
}
