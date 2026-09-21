import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { dbPool } from '@/lib/server/db/pool';
import { realtimeRepository } from '@/lib/server/db/realtime-repository';
import { getTradeHistory } from '@/lib/market/trade-history';
import { describeError } from '@/lib/server/describe-error';
import { logger } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/live-trades
 *   ?limit=50&side=BUY|SELL&wallet=<address>&pages=1..6
 *
 * The token's trade tape, newest first.
 *
 * ## Why the tape was empty
 *
 * This read only trades this platform's own stream had captured — and that
 * stream only watches a token while someone has it open, decoding at a
 * budgeted rate. Every page load therefore began with an empty tape, and a
 * token that had just migrated, trading hundreds of times a minute, showed
 * nothing. Measured on one: 0 captured rows while an indexer held 300.
 *
 * ## What it serves now
 *
 * The indexer's recent trades (see `lib/market/trade-history.ts`) merged with
 * whatever the stream captured, de-duplicated by signature. The stream's rows
 * are the freshest; the indexer's are the history the stream never saw.
 *
 * `wallet` narrows to one maker — how the Dev Activity tab gets the deployer's
 * own buys and sells. `pages` walks further back (30 trades per page) for
 * callers that want more than the latest screenful.
 */

interface TradeRow {
  signature: string;
  mint: string;
  wallet: string | null;
  side: 'BUY' | 'SELL';
  amount: string | null;
  amount_sol: string | null;
  price_usd: string | null;
  timestamp: string;
}

interface TapeTrade {
  signature: string;
  mint: string;
  wallet: string | null;
  side: 'BUY' | 'SELL';
  amountUsd: number | null;
  amountSol: number | null;
  amountTokens: number | null;
  priceUsd: number | null;
  timestamp: string;
  isMev: boolean;
  source: string;
}

const MAX_LIMIT = 200;

// `realtime_trades` still holds rows written during MOCK_REALTIME development
// whose "signatures" look like `sig_trade_1724…`. A real Solana signature is
// 80-92 base58 characters, which excludes them exactly.
const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{80,92}$/;

function toNum(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Trades our own stream captured — Postgres when it is up, memory when not. */
async function capturedTrades(mint: string): Promise<{ trades: TapeTrade[]; fromMemory: boolean }> {
  try {
    const { rows } = await dbPool.query<TradeRow>(
      `SELECT signature, mint, wallet, side, amount, amount_sol, price_usd, timestamp
         FROM realtime_trades
        WHERE mint = $1
          AND signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,92}$'
        ORDER BY timestamp DESC
        LIMIT 500`,
      [mint],
    );
    return {
      fromMemory: false,
      trades: rows.map((row) => ({
        signature: row.signature,
        mint: row.mint,
        wallet: row.wallet,
        side: row.side,
        amountUsd: toNum(row.amount),
        amountSol: toNum(row.amount_sol),
        amountTokens: null,
        priceUsd: toNum(row.price_usd),
        timestamp: new Date(row.timestamp).toISOString(),
        isMev: false,
        source: 'stream',
      })),
    };
  } catch (dbError) {
    logger.debug('[live-trades] Postgres unavailable, reading the in-memory capture buffer', {
      mint,
      error: describeError(dbError),
    });
    return {
      fromMemory: true,
      trades: realtimeRepository
        .getInMemoryTradesForMint(mint)
        .filter((t) => SIGNATURE_RE.test(t.signature))
        .map((t) => ({
          signature: t.signature,
          mint: t.mint,
          wallet: t.wallet ?? null,
          side: t.side,
          amountUsd: toNum(t.amount),
          amountSol: toNum(t.amountSol),
          amountTokens: null,
          priceUsd: toNum(t.priceUsd),
          timestamp: t.timestamp ?? new Date().toISOString(),
          isMev: false,
          source: 'stream',
        })),
    };
  }
}

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } },
) {
  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limitRaw))) : 50;

    const sideRaw = url.searchParams.get('side');
    const side = sideRaw === 'BUY' || sideRaw === 'SELL' ? sideRaw : null;
    const wallet = url.searchParams.get('wallet');
    const pagesRaw = Number(url.searchParams.get('pages') ?? (wallet ? 6 : 2));
    const pages = Number.isFinite(pagesRaw) ? pagesRaw : 2;

    const { address } = params;
    if (!address || address.length < 32) {
      throw new ApiError('A token mint address is required', 400);
    }

    const [history, captured] = await Promise.all([
      getTradeHistory(address, pages),
      capturedTrades(address),
    ]);

    // Captured rows win a tie: they were decoded by this platform from the
    // transaction itself. Indexer rows fill everything the stream never saw.
    const bySignature = new Map<string, TapeTrade>();
    for (const t of history.trades) {
      bySignature.set(t.signature, { ...t, mint: address });
    }
    for (const t of captured.trades) {
      const existing = bySignature.get(t.signature);
      // Keep the indexer's token amount when ours has none.
      bySignature.set(t.signature, existing ? { ...existing, ...t, amountTokens: existing.amountTokens } : t);
    }

    const trades = [...bySignature.values()]
      .filter((t) => (!side || t.side === side) && (!wallet || t.wallet === wallet))
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, limit);

    const sources = [
      history.source ? `${history.source === 'jupiter' ? 'Jupiter' : 'GeckoTerminal'} trade index` : null,
      captured.trades.length > 0 ? `this platform's live stream${captured.fromMemory ? ' (in-memory; Postgres unavailable)' : ''}` : null,
    ].filter(Boolean);

    return jsonResponse({
      mint: address,
      chain: params.chain,
      count: trades.length,
      source: history.source,
      coverage:
        sources.length > 0
          ? `Recent trades from ${sources.join(' and ')}, newest first.`
          : history.error
            ? `No trade source could be reached (${history.error}).`
            : 'No trades found for this token in the indexers or the live stream.',
      trades,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load live trades', 500));
  }
}
