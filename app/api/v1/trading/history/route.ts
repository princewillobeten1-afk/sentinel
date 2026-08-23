export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import { orderService } from '@/lib/order/order-service';
import { dbPool } from '@/lib/server/db/pool';
import type { OrderState } from '@/lib/order/state-machine';

/**
 * The caller's trade history.
 *
 * This returned a hardcoded three-item array — the same fabricated trades for
 * every user, including a `$3.4500` price and an `8kL9z…Signature001` tx hash
 * that match nothing on chain. Authentication was enforced, which made it worse:
 * a signed-in user saw confident trades they had never placed.
 *
 * History is now the `orders` table (Phase 3), which is where placed orders
 * actually live. Token symbol and name are joined from the registry so the feed
 * reads in the terms a trader uses rather than as internal ids.
 */

const TERMINAL_STATES: OrderState[] = ['FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'FAILED', 'EXPIRED'];

interface TokenLookup {
  id: string;
  symbol: string;
  name: string;
  address: string;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);

    const rawLimit = Number(url.searchParams.get('limit') ?? 50);
    if (!Number.isFinite(rawLimit) || rawLimit < 1) {
      throw new ApiError('limit must be a positive number', 400, 'INVALID_REQUEST');
    }
    const limit = Math.min(rawLimit, 200);
    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);

    const statusParam = url.searchParams.get('status') ?? undefined;
    if (statusParam && !TERMINAL_STATES.includes(statusParam as OrderState)) {
      throw new ApiError(
        `status must be one of: ${TERMINAL_STATES.join(', ')}`,
        400,
        'INVALID_REQUEST',
      );
    }

    const { orders, total } = await orderService.listOrders(user.userId, {
      limit,
      offset,
      status: statusParam as OrderState | undefined,
    });

    // One lookup for the whole page rather than a query per row.
    const tokenIds = Array.from(new Set(orders.map((o) => o.tokenId).filter(Boolean)));
    const tokens = new Map<string, TokenLookup>();
    if (tokenIds.length > 0) {
      const { rows } = await dbPool.query<TokenLookup>(
        'SELECT id, symbol, name, address FROM tokens WHERE id = ANY($1::varchar[])',
        [tokenIds],
      );
      for (const row of rows) tokens.set(row.id, row);
    }

    const trades = orders.map((o) => {
      const token = tokens.get(o.tokenId);
      return {
        id: o.id,
        // Null until execution reports one. An order that has not settled has no
        // transaction hash, and inventing a placeholder would make an unfilled
        // order look confirmed.
        txHash: null,
        tokenName: token?.name ?? null,
        tokenSymbol: token?.symbol ?? null,
        tokenMint: token?.address ?? null,
        side: o.side.toLowerCase(),
        orderType: o.orderType,
        status: o.status,
        quantity: o.quantity,
        filledQuantity: o.filledQuantity,
        limitPrice: o.limitPrice,
        averageFillPrice: o.averageFillPrice,
        slippageLimit: o.slippageLimit,
        failureReason: o.failureReason,
        timestamp: o.createdAt,
        updatedAt: o.updatedAt,
      };
    });

    return jsonResponse({
      trades,
      meta: { total, limit, offset, hasMore: offset + trades.length < total },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load trade history', 500));
  }
}
