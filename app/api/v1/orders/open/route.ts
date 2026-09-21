import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { dbPool } from '@/lib/server/db/pool';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/orders/open
 *
 * The caller's live orders, from the `orders` table.
 *
 * ## What this replaced
 *
 * The route returned two hardcoded rows — `mock-stop-1` and `mock-limit-1` —
 * with a comment reading "In a real DB, SELECT * FROM conditional_orders". The
 * table exists and has since the order-consolidation migration; nothing was
 * reading it.
 *
 * Scoped to the authenticated user, which the mock could not be. An order list
 * that is not scoped to its owner is worse than an empty one.
 */

const OPEN_STATUSES = ['CREATED', 'OPEN', 'MONITORING', 'PARTIALLY_FILLED'];

interface OrderRow {
  id: string;
  token_id: string | null;
  order_type: string;
  side: string;
  quantity: string | null;
  filled_quantity: string | null;
  limit_price: string | null;
  stop_price: string | null;
  slippage_limit: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const tokenId = url.searchParams.get('tokenId');

    const params: unknown[] = [user.userId, OPEN_STATUSES];
    let tokenClause = '';
    if (tokenId) {
      params.push(tokenId);
      tokenClause = 'AND token_id = $3';
    }

    const { rows } = await dbPool.query<OrderRow>(
      `SELECT id, token_id, order_type, side, quantity, filled_quantity,
              limit_price, stop_price, slippage_limit, status, created_at, expires_at
         FROM orders
        WHERE user_id = $1
          AND status = ANY($2)
          ${tokenClause}
        ORDER BY created_at DESC
        LIMIT 100`,
      params,
    );

    // NUMERIC columns arrive as strings from pg and stay strings here, so no
    // precision is lost crossing JSON. Absent stays null — an order with no
    // limit price is a market order, not one priced at zero.
    const orders = rows.map((row) => ({
      id: row.id,
      tokenId: row.token_id,
      orderType: row.order_type,
      side: row.side,
      quantity: row.quantity,
      filledQuantity: row.filled_quantity,
      limitPrice: row.limit_price,
      stopPrice: row.stop_price,
      slippageLimit: row.slippage_limit,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));

    return jsonResponse({ orders, count: orders.length });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to load open orders', 500),
    );
  }
}
