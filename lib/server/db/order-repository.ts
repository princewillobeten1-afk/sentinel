import 'server-only';

import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';
import { assertOrderTransition, type OrderState } from '@/lib/order/state-machine';
import { ApiError } from '@/lib/server/errors';

/**
 * Postgres-backed order store (Phase 3 — Order Consolidation).
 *
 * Money never round-trips through a JS float here: `quantity`,
 * `limit_price`, `filled_quantity` are NUMERIC in Postgres and are read back
 * as strings (node-postgres' default for NUMERIC), which is exactly what
 * `lib/math/decimal.ts` wants. The replaced mock route used `parseFloat`.
 */

export interface OrderRow {
  id: string;
  user_id: string;
  wallet_id: string;
  token_id: string;
  order_type: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  side: 'BUY' | 'SELL';
  quantity: string;
  limit_price: string | null;
  stop_price: string | null;
  slippage_limit: string;
  status: OrderState;
  filled_quantity: string;
  average_fill_price: string | null;
  idempotency_key: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
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
  expiresAt?: string | null;
}

export class PgOrderRepository {
  /**
   * Creates an order and its initial state-transition record atomically.
   *
   * Idempotency (Sprint 42 §63-64): if the caller replays the same
   * `idempotencyKey`, the ORIGINAL order is returned rather than a second one
   * being created. Enforced by a UNIQUE index, so two concurrent identical
   * requests can't both pass a pre-check and then both insert.
   */
  async createOrder(input: CreateOrderInput): Promise<{ order: OrderRow; replayed: boolean }> {
    return dbPool.withTransaction(async (client) => {
      if (input.idempotencyKey) {
        const { rows: existing } = await client.query<OrderRow>(
          'SELECT * FROM orders WHERE user_id = $1 AND idempotency_key = $2',
          [input.userId, input.idempotencyKey],
        );
        if (existing[0]) return { order: existing[0], replayed: true };
      }

      const id = generateId('ord');
      const { rows } = await client.query<OrderRow>(
        `INSERT INTO orders (id, user_id, wallet_id, token_id, order_type, side, quantity,
                             limit_price, stop_price, slippage_limit, status, filled_quantity,
                             idempotency_key, expires_at)
         VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::numeric,
                 $8::numeric, $9::numeric, COALESCE($10::numeric, 0.0100), 'CREATED', 0,
                 $11::varchar, $12::timestamptz)
         RETURNING *`,
        [
          id,
          input.userId,
          input.walletId,
          input.tokenId,
          input.orderType,
          input.side,
          input.quantity,
          input.limitPrice ?? null,
          input.stopPrice ?? null,
          input.slippageLimit ?? null,
          input.idempotencyKey ?? null,
          input.expiresAt ?? null,
        ],
      );

      await client.query(
        `INSERT INTO order_state_transitions (id, order_id, from_state, to_state, reason)
         VALUES ($1::varchar, $2::varchar, NULL, 'CREATED', 'Order accepted')`,
        [generateId('ost'), id],
      );

      return { order: rows[0], replayed: false };
    });
  }

  async getOrder(orderId: string): Promise<OrderRow | undefined> {
    const { rows } = await dbPool.query<OrderRow>('SELECT * FROM orders WHERE id = $1', [orderId]);
    return rows[0];
  }

  /** Ownership-checked read — the object-level authorization point for a single order. */
  async getOrderForUser(orderId: string, userId: string): Promise<OrderRow | undefined> {
    const { rows } = await dbPool.query<OrderRow>(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId],
    );
    return rows[0];
  }

  async listOrdersForUser(
    userId: string,
    opts: { limit: number; offset: number; status?: OrderState },
  ): Promise<OrderRow[]> {
    const params: unknown[] = [userId];
    let where = 'WHERE user_id = $1';
    if (opts.status) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    params.push(opts.limit, opts.offset);
    const { rows } = await dbPool.query<OrderRow>(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows;
  }

  async countOrdersForUser(userId: string, status?: OrderState): Promise<number> {
    const params: unknown[] = [userId];
    let where = 'WHERE user_id = $1';
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    const { rows } = await dbPool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM orders ${where}`,
      params,
    );
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Moves an order to a new state, validating the transition and writing the
   * history row in the SAME transaction as the status update.
   *
   * `SELECT ... FOR UPDATE` is what makes the state machine actually hold under
   * concurrency: without it, two requests could both read SUBMITTED, both judge
   * their transition legal, and both write — silently losing one.
   */
  async transition(
    orderId: string,
    to: OrderState,
    opts: { reason?: string; filledQuantity?: string; averageFillPrice?: string; failureReason?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<OrderRow> {
    return dbPool.withTransaction(async (client) => {
      const { rows: locked } = await client.query<OrderRow>(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [orderId],
      );
      const current = locked[0];
      if (!current) {
        throw new ApiError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      assertOrderTransition(current.status, to);

      const { rows } = await client.query<OrderRow>(
        `UPDATE orders
         SET status = $2::varchar,
             filled_quantity = COALESCE($3::numeric, filled_quantity),
             average_fill_price = COALESCE($4::numeric, average_fill_price),
             failure_reason = COALESCE($5::text, failure_reason),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [orderId, to, opts.filledQuantity ?? null, opts.averageFillPrice ?? null, opts.failureReason ?? null],
      );

      await client.query(
        `INSERT INTO order_state_transitions (id, order_id, from_state, to_state, reason, metadata)
         VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::text, $6::jsonb)`,
        [
          generateId('ost'),
          orderId,
          current.status,
          to,
          opts.reason ?? null,
          opts.metadata ? JSON.stringify(opts.metadata) : null,
        ],
      );

      return rows[0];
    });
  }

  async getTransitions(orderId: string): Promise<Array<{ from_state: string | null; to_state: string; reason: string | null; created_at: string }>> {
    const { rows } = await dbPool.query<{ from_state: string | null; to_state: string; reason: string | null; created_at: string }>(
      'SELECT from_state, to_state, reason, created_at FROM order_state_transitions WHERE order_id = $1 ORDER BY created_at ASC',
      [orderId],
    );
    return rows;
  }
}

export const pgOrderRepository = new PgOrderRepository();
