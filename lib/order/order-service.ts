import 'server-only';

import { pgOrderRepository, type OrderRow, type CreateOrderInput } from '@/lib/server/db/order-repository';
import { dbPool } from '@/lib/server/db/pool';
import { ApiError } from '@/lib/server/errors';
import type { OrderState } from './state-machine';

/**
 * Order service (Phase 3 — Order Consolidation).
 *
 * Controller → validation → SERVICE → repository → Postgres. The route does
 * no business logic; this owns ownership checks, token/wallet resolution, and
 * state transitions. Replaces `app/api/v1/orders/route.ts`'s inline mock.
 */

/** Response DTO — never the raw row (Sprint 42 §85-86). */
export interface OrderDto {
  id: string;
  status: OrderState;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  walletId: string;
  tokenId: string;
  quantity: string;
  filledQuantity: string;
  limitPrice: string | null;
  stopPrice: string | null;
  averageFillPrice: string | null;
  slippageLimit: string;
  failureReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Explicit mapper: internal columns (`user_id`, `idempotency_key`) never reach
 * the API. Numeric columns stay STRINGS end-to-end — converting to a JS number
 * here would reintroduce exactly the float precision loss this phase removes.
 */
export function toOrderDto(row: OrderRow): OrderDto {
  return {
    id: row.id,
    status: row.status,
    side: row.side,
    orderType: row.order_type,
    walletId: row.wallet_id,
    tokenId: row.token_id,
    quantity: row.quantity,
    filledQuantity: row.filled_quantity,
    limitPrice: row.limit_price,
    stopPrice: row.stop_price,
    averageFillPrice: row.average_fill_price,
    slippageLimit: row.slippage_limit,
    failureReason: row.failure_reason,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export interface PlaceOrderInput {
  userId: string;
  walletId: string;
  tokenId: string;
  orderType: OrderRow['order_type'];
  side: OrderRow['side'];
  quantity: string;
  limitPrice?: string | null;
  stopPrice?: string | null;
  slippageLimit?: string | null;
  idempotencyKey?: string | null;
}

export class OrderService {
  /**
   * Validates ownership and referential integrity BEFORE insert so the caller
   * gets a precise 4xx instead of a raw foreign-key violation surfacing as a 500.
   */
  async placeOrder(input: PlaceOrderInput): Promise<{ order: OrderDto; replayed: boolean }> {
    const { rows: wallets } = await dbPool.query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM wallets WHERE id = $1',
      [input.walletId],
    );
    const wallet = wallets[0];
    if (!wallet) {
      throw new ApiError('Wallet not found', 404, 'WALLET_NOT_FOUND');
    }
    if (wallet.user_id !== input.userId) {
      // 403, not 404: the caller proved the wallet exists by id, so pretending
      // otherwise is misleading — matches lib/portfolio/service.ts's stance.
      throw new ApiError('This wallet is not linked to your account.', 403, 'WALLET_NOT_AUTHORIZED');
    }

    const { rows: tokens } = await dbPool.query<{ id: string }>('SELECT id FROM tokens WHERE id = $1', [input.tokenId]);
    if (!tokens[0]) {
      throw new ApiError('Unknown token.', 404, 'TOKEN_NOT_FOUND');
    }

    if (input.orderType === 'LIMIT' && !input.limitPrice) {
      throw new ApiError('limitPrice is required for a LIMIT order.', 400, 'INVALID_REQUEST');
    }
    if (input.orderType === 'STOP_LOSS' && !input.stopPrice) {
      throw new ApiError('stopPrice is required for a STOP_LOSS order.', 400, 'INVALID_REQUEST');
    }

    const created: CreateOrderInput = {
      userId: input.userId,
      walletId: input.walletId,
      tokenId: input.tokenId,
      orderType: input.orderType,
      side: input.side,
      quantity: input.quantity,
      limitPrice: input.limitPrice ?? null,
      stopPrice: input.stopPrice ?? null,
      slippageLimit: input.slippageLimit ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    };

    const { order, replayed } = await pgOrderRepository.createOrder(created);
    return { order: toOrderDto(order), replayed };
  }

  async getOrder(orderId: string, userId: string): Promise<OrderDto> {
    const row = await pgOrderRepository.getOrderForUser(orderId, userId);
    if (!row) {
      throw new ApiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    return toOrderDto(row);
  }

  async listOrders(userId: string, opts: { limit: number; offset: number; status?: OrderState }) {
    const [rows, total] = await Promise.all([
      pgOrderRepository.listOrdersForUser(userId, opts),
      pgOrderRepository.countOrdersForUser(userId, opts.status),
    ]);
    return { orders: rows.map(toOrderDto), total };
  }

  /** Ownership-checked state change — the only way an order's status moves. */
  async transition(
    orderId: string,
    userId: string,
    to: OrderState,
    opts: { reason?: string; filledQuantity?: string; averageFillPrice?: string; failureReason?: string } = {},
  ): Promise<OrderDto> {
    const owned = await pgOrderRepository.getOrderForUser(orderId, userId);
    if (!owned) {
      throw new ApiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    const row = await pgOrderRepository.transition(orderId, to, opts);
    return toOrderDto(row);
  }

  async cancelOrder(orderId: string, userId: string, reason = 'Cancelled by user'): Promise<OrderDto> {
    return this.transition(orderId, userId, 'CANCELLED', { reason });
  }

  async getHistory(orderId: string, userId: string) {
    const owned = await pgOrderRepository.getOrderForUser(orderId, userId);
    if (!owned) {
      throw new ApiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    const transitions = await pgOrderRepository.getTransitions(orderId);
    return transitions.map((t) => ({
      from: t.from_state,
      to: t.to_state,
      reason: t.reason,
      at: new Date(t.created_at).toISOString(),
    }));
  }
}

export const orderService = new OrderService();
