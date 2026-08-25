import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { dbPool } from '@/lib/server/db/pool';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/live-trades
 *
 * The token's trade tape, from trades this platform captured itself.
 *
 * `realtime_trades` has been filling from the Helius stream — thousands of rows
 * — while **no endpoint read it**. The Trades tab instead called Birdeye, whose
 * compute-unit quota is exhausted, so the tape was permanently empty or stale.
 * This exposes what we already have.
 *
 * Rows carry a bare on-chain `signature`, so each is resolvable on an explorer.
 * (It previously stored `helius_<sig>_<program>`, which no explorer accepts.)
 *
 * Coverage is honest rather than padded: the capture is rate-limited by the
 * enrichment budget, so a token nothing has traded through our stream returns
 * an empty list — not a fabricated tape.
 */

interface TradeRow {
  signature: string;
  mint: string;
  wallet: string | null;
  side: 'BUY' | 'SELL';
  amount: string | null;
  amount_sol: string | null;
  price_usd: string | null;
  slot: string | null;
  timestamp: string;
  source: string | null;
}

const MAX_LIMIT = 200;

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } },
) {
  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limitRaw)))
      : 50;

    const side = url.searchParams.get('side');
    const filterSide = side === 'BUY' || side === 'SELL' ? side : null;

    const { address } = params;
    if (!address || address.length < 32) {
      throw new ApiError('A token mint address is required', 400);
    }

    const { rows } = await dbPool.query<TradeRow>(
      // The base58 signature test is not cosmetic. `realtime_trades` still
      // holds ~19k rows written during MOCK_REALTIME development, whose
      // "signatures" look like `sig_trade_1724…`. They outnumber the real
      // captures and would render as genuine trades on the tape. A real Solana
      // signature is 80-92 base58 characters, which excludes them exactly.
      `SELECT signature, mint, wallet, side, amount, amount_sol, price_usd, slot, timestamp, source
         FROM realtime_trades
        WHERE mint = $1
          AND signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,92}$'
          ${filterSide ? 'AND side = $3' : ''}
        ORDER BY timestamp DESC
        LIMIT $2`,
      filterSide ? [address, limit, filterSide] : [address, limit],
    );

    // NUMERIC columns arrive as strings from pg. They stay strings in the
    // payload so no precision is lost crossing JSON; the client formats them.
    const trades = rows.map((row) => ({
      signature: row.signature,
      mint: row.mint,
      wallet: row.wallet,
      side: row.side,
      amountUsd: row.amount,
      amountSol: row.amount_sol,
      priceUsd: row.price_usd,
      slot: row.slot,
      timestamp: row.timestamp,
      source: row.source,
    }));

    return jsonResponse({
      mint: address,
      chain: params.chain,
      count: trades.length,
      // States the coverage limit plainly rather than letting an empty tape
      // read as "this token has never traded".
      coverage: 'Trades captured by this platform\'s live stream, newest first.',
      trades,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to load live trades', 500),
    );
  }
}
