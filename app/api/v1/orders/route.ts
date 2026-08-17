export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { orderService } from '@/lib/order/order-service';
import type { OrderState } from '@/lib/order/state-machine';

/**
 * Orders API (Phase 3 — Order Consolidation).
 *
 * Replaces the previous mock: `let orders: any[] = []` in module scope, with
 * no authentication, no validation, `parseFloat` arithmetic on money, and a
 * free-text status (`'QUOTING'`). Orders are now real rows in Postgres with a
 * CHECK-constrained status, an enforced state machine
 * (`lib/order/state-machine.ts`), and per-user idempotency.
 *
 * Amounts are strings the whole way down — a JS number cannot hold a
 * NUMERIC(36,18) without losing precision.
 */

const DECIMAL = /^\d+(\.\d+)?$/;

const placeOrderSchema = z.object({
  walletId: z.string().min(1),
  tokenId: z.string().min(1),
  orderType: z.enum(['MARKET', 'LIMIT', 'STOP_LOSS']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.string().regex(DECIMAL, 'quantity must be a decimal string').refine((v) => Number(v) > 0, 'quantity must be greater than zero'),
  limitPrice: z.string().regex(DECIMAL).optional().nullable(),
  stopPrice: z.string().regex(DECIMAL).optional().nullable(),
  slippageLimit: z.string().regex(DECIMAL).optional().nullable(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

const ORDER_STATES: OrderState[] = ['CREATED', 'PENDING', 'SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'FAILED', 'EXPIRED'];

/** GET /api/v1/orders — the caller's own orders. Never another user's. */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const rawLimit = Number(searchParams.get('limit') ?? 25);
    if (!Number.isFinite(rawLimit) || rawLimit < 1) {
      throw new ApiError('limit must be a positive number', 400, 'INVALID_REQUEST');
    }
    // Max 100 (Sprint 42 §56) — clients can never request unbounded rows.
    const limit = Math.min(rawLimit, 100);
    const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

    const statusParam = searchParams.get('status') ?? undefined;
    if (statusParam && !ORDER_STATES.includes(statusParam as OrderState)) {
      throw new ApiError(`Unknown status filter: ${statusParam}`, 400, 'INVALID_REQUEST');
    }

    const { orders, total } = await orderService.listOrders(user.userId, {
      limit,
      offset,
      status: statusParam as OrderState | undefined,
    });

    return jsonResponse({
      orders,
      meta: { total, limit, offset, hasMore: offset + orders.length < total },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to list orders', 500));
  }
}

/** POST /api/v1/orders — place an order. Idempotent when `idempotencyKey` is supplied. */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(placeOrderSchema, payload);

    const { order, replayed } = await orderService.placeOrder({
      userId: user.userId,
      walletId: data.walletId,
      tokenId: data.tokenId,
      orderType: data.orderType,
      side: data.side,
      quantity: data.quantity,
      limitPrice: data.limitPrice ?? null,
      stopPrice: data.stopPrice ?? null,
      slippageLimit: data.slippageLimit ?? null,
      idempotencyKey: data.idempotencyKey ?? null,
    });

    // A replay is not a new order, so it is not a 201.
    return jsonResponse({ order, replayed }, replayed ? 200 : 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to place order', 500));
  }
}
