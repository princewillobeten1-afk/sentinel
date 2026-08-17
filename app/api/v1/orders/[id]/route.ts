export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { orderService } from '@/lib/order/order-service';

/**
 * Single-order API (Phase 3 — Order Consolidation).
 *
 * Replaces a hardcoded `mockOrder` that returned a FILLED order with a fake
 * transaction hash for ANY id, to any caller, with no authentication — so it
 * would happily "confirm" an order that never existed.
 *
 * Both handlers are ownership-checked: `orderService` resolves by
 * (orderId, userId), so one user cannot read or cancel another's order. A
 * miss returns 404 rather than 403 — an order id the caller doesn't own
 * shouldn't be confirmable as existing.
 */

/** GET /api/v1/orders/:id — the order plus its full state-transition history. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const [order, history] = await Promise.all([
      orderService.getOrder(params.id, user.userId),
      orderService.getHistory(params.id, user.userId),
    ]);
    return jsonResponse({ order, history });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load order', 500));
  }
}

/**
 * DELETE /api/v1/orders/:id — cancel.
 *
 * Cancellation is a state transition, not a row deletion: an order that was
 * placed is a financial record and must remain auditable. Illegal cancels
 * (e.g. of an already-FILLED order) are rejected by the state machine with
 * `INVALID_STATE_TRANSITION`, not silently ignored.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const order = await orderService.cancelOrder(params.id, user.userId);
    return jsonResponse({ order });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to cancel order', 500));
  }
}
