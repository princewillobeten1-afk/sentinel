import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { dbPool } from '@/lib/server/db/pool';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/top-traders
 *
 * The most active wallets in this token, from trades this platform captured.
 *
 * ## What this replaced
 *
 * Four hardcoded rows shown for every token: "Elite Scalper — 48 trades, 87.5%
 * win rate, +184.5 SOL, +420% ROI", "Whale Accumulator", "Momentum Bot",
 * "Swing Trader". The wallet addresses were the same ones that appeared in the
 * hardcoded trade tape, so the page corroborated itself with its own fiction.
 *
 * ## Why there is no win rate or ROI here
 *
 * Those need each wallet's cost basis and realised exits — a position ledger
 * per wallet, which this platform does not maintain. Volume and trade counts
 * are directly observable; profitability is not, so it is absent rather than
 * estimated. That is the difference between "we did not compute this" and the
 * previous "87.5%".
 *
 * Coverage is bounded by the enrichment budget: these are the wallets seen in
 * *captured* trades, not every trader in the token.
 */

interface TraderRow {
  wallet: string;
  trade_count: string;
  buy_count: string;
  sell_count: string;
  buy_usd: string | null;
  sell_usd: string | null;
  first_seen: string;
  last_seen: string;
}

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } },
) {
  try {
    const { chain, address } = params;
    if (!address || address.length < 32) {
      throw new ApiError('A token mint address is required', 400);
    }

    const limitRaw = Number(new URL(request.url).searchParams.get('limit') ?? 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.trunc(limitRaw))) : 10;

    const { rows } = await dbPool.query<TraderRow>(
      `SELECT wallet,
              COUNT(*)                                              AS trade_count,
              COUNT(*) FILTER (WHERE side = 'BUY')                  AS buy_count,
              COUNT(*) FILTER (WHERE side = 'SELL')                 AS sell_count,
              SUM(amount) FILTER (WHERE side = 'BUY')               AS buy_usd,
              SUM(amount) FILTER (WHERE side = 'SELL')              AS sell_usd,
              MIN(timestamp)                                        AS first_seen,
              MAX(timestamp)                                        AS last_seen
         FROM realtime_trades
        WHERE mint = $1
          AND wallet IS NOT NULL
          -- Excludes the synthetic rows left from MOCK_REALTIME development,
          -- whose "signatures" are not base58 and which outnumber the real
          -- captures in this table.
          AND signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,92}$'
        GROUP BY wallet
        ORDER BY COUNT(*) DESC, SUM(amount) DESC NULLS LAST
        LIMIT $2`,
      [address, limit],
    );

    const topTraders = rows.map((row, index) => {
      const buyUsd = row.buy_usd === null ? null : Number(row.buy_usd);
      const sellUsd = row.sell_usd === null ? null : Number(row.sell_usd);
      const netUsd = buyUsd === null && sellUsd === null ? null : (sellUsd ?? 0) - (buyUsd ?? 0);

      return {
        rank: index + 1,
        wallet: `${row.wallet.slice(0, 4)}...${row.wallet.slice(-4)}`,
        fullWallet: row.wallet,
        // Nothing on-chain labels a trader, so no tag is asserted.
        tag: null,
        totalTrades: Number(row.trade_count),
        buys: Number(row.buy_count),
        sells: Number(row.sell_count),
        buyVolumeUsd: buyUsd,
        sellVolumeUsd: sellUsd,
        netFlowUsd: netUsd,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        // Not derivable without a per-wallet cost basis — see module header.
        winRate: null,
        roi: null,
        totalProfitUsd: null,
      };
    });

    return jsonResponse({
      token: address,
      chain: chain.toLowerCase(),
      topTraders,
      count: topTraders.length,
      coverage:
        'Wallets ranked by captured trade count. Win rate and ROI are not computed — they need a per-wallet cost basis this platform does not track.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch top traders', 500),
    );
  }
}
