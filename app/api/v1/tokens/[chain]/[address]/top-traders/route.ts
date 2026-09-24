import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { realtimeRepository } from '@/lib/server/db/realtime-repository';
import { getTradeHistory } from '@/lib/market/trade-history';
import { measuredTradeUsd, mergeTradeTape, type TapeTrade } from '@/lib/market/trade-tape';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/top-traders
 *
 * The most active wallets in this token over its recent trades.
 *
 * ## What this replaced
 *
 * First, four hardcoded rows for every token ("Elite Scalper — 87.5% win
 * rate, +420% ROI"). Then an honest aggregation over trades this platform's
 * own stream had captured — which, since the stream only watches a token while
 * it is open, was empty on nearly every page load.
 *
 * It now aggregates the indexer's recent tape (see
 * `lib/market/trade-history.ts`) plus anything the stream captured, and states
 * the window it covered: "most active in the last N trades" is a measurement;
 * "top trader" without a window is not.
 *
 * ## Why there is no win rate or ROI
 *
 * Those need each wallet's cost basis across its whole history in the token.
 * A recent-trades window shows flow, not profit, so profitability is absent
 * rather than estimated from a slice.
 */

interface Aggregate {
  trades: number;
  buys: number;
  sells: number;
  buyUsd: number;
  sellUsd: number;
  buyTokens: number;
  sellTokens: number;
  firstSeen: string;
  lastSeen: string;
}

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{80,92}$/;
/** Pages of 30: ~150 trades is enough to rank wallets on a busy token. */
const HISTORY_PAGES = 5;

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

    const history = await getTradeHistory(address, HISTORY_PAGES);

    const captured: TapeTrade[] = realtimeRepository.getInMemoryTradesForMint(address)
      .filter(t => SIGNATURE_RE.test(t.signature))
      .map(t => ({ eventId: t.eventId, signature: t.signature, mint: address,
        side: t.side, wallet: t.wallet ?? null,
        amountUsd: measuredTradeUsd(t.amount, t.priceUsd),
        amountSol: t.amountSol ?? null, amountTokens: t.amount ?? null,
        priceUsd: t.priceUsd ?? null, timestamp: t.timestamp ?? new Date().toISOString(),
        isMev: false, source: 'stream' }));
    const trades = mergeTradeTape(history.trades.map(t => ({ ...t, mint: address })), captured);
    const byWallet = new Map<string, Aggregate>();
    for (const t of trades) {
      if (!t.wallet) continue;
      const a = byWallet.get(t.wallet) ?? {
        trades: 0, buys: 0, sells: 0, buyUsd: 0, sellUsd: 0, buyTokens: 0, sellTokens: 0,
        firstSeen: t.timestamp, lastSeen: t.timestamp,
      };
      a.trades += 1;
      if (t.side === 'BUY') {
        a.buys += 1;
        a.buyUsd += t.amountUsd ?? 0;
        a.buyTokens += t.amountTokens ?? 0;
      } else {
        a.sells += 1;
        a.sellUsd += t.amountUsd ?? 0;
        a.sellTokens += t.amountTokens ?? 0;
      }
      if (t.timestamp < a.firstSeen) a.firstSeen = t.timestamp;
      if (t.timestamp > a.lastSeen) a.lastSeen = t.timestamp;
      byWallet.set(t.wallet, a);
    }

    // Busiest first; volume breaks ties so a wallet that moved real size ranks
    // above one that made the same number of dust trades.
    const topTraders = [...byWallet.entries()]
      .sort((x, y) => y[1].trades - x[1].trades || (y[1].buyUsd + y[1].sellUsd) - (x[1].buyUsd + x[1].sellUsd))
      .slice(0, limit)
      .map(([wallet, a], index) => ({
        rank: index + 1,
        wallet: `${wallet.slice(0, 4)}...${wallet.slice(-4)}`,
        fullWallet: wallet,
        totalTrades: a.trades,
        buys: a.buys,
        sells: a.sells,
        buyVolumeUsd: a.buyUsd,
        sellVolumeUsd: a.sellUsd,
        // Positive: the wallet took more USD out than it put in over the window.
        netFlowUsd: a.sellUsd - a.buyUsd,
        netTokens: a.buyTokens - a.sellTokens,
        firstSeen: a.firstSeen,
        lastSeen: a.lastSeen,
        // Not derivable from a window — see the module header.
        winRate: null,
        roi: null,
        totalProfitUsd: null,
      }));

    const timestamps = trades.map((t) => t.timestamp).sort();

    return jsonResponse({
      token: address,
      chain: chain.toLowerCase(),
      topTraders,
      count: topTraders.length,
      tradesConsidered: trades.length,
      windowStart: timestamps[0] ?? null,
      windowEnd: timestamps[timestamps.length - 1] ?? null,
      source: history.source,
      coverage: trades.length > 0
        ? `Wallets ranked by trade count over the last ${trades.length} trades. Win rate and ROI need a full cost basis and are not computed.`
        : history.error
          ? `No trade source could be reached (${history.error}).`
          : 'No trades found for this token.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch top traders', 500));
  }
}
