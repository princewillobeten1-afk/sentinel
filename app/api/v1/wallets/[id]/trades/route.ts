export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { dbPool } from '@/lib/server/db/pool';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) {
      throw new ApiError('Invalid wallet identifier', 400, 'INVALID_REQUEST');
    }

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

    let trades: any[] = [];
    try {
      const res = await dbPool.query(
        `SELECT signature, mint, wallet, side, amount, amount_sol as "amountSol", price_usd as "priceUsd", slot, timestamp
         FROM trades WHERE wallet = $1 ORDER BY timestamp DESC LIMIT $2`,
        [id, limit]
      );
      trades = res.rows;
    } catch {
      // Degrade gracefully
    }

    return jsonResponse({
      wallet: id,
      count: trades.length,
      trades,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch wallet trades', 500));
  }
}
