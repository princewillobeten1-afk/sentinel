import 'server-only';

import { dbPool } from '@/lib/server/db/pool';
import { createMarketSnapshot } from './snapshot-service';
import type { MarketSnapshot } from './types';

/**
 * Market snapshots read from measured data.
 *
 * Replaces `getMockMarketSnapshots()`, which returned two hardcoded entries —
 * SOL at `$142.500000000000000000` and a "SENTINEL" token at `$3.45`. Neither
 * was ever a measurement: while that literal claimed $142.50, the live SOL
 * price was $92.89, so the endpoint was not merely stale but contradicted the
 * price the rest of the page displayed.
 *
 * ## What is measured, and what is not
 *
 * `realtime_tokens` is filled by `db/discover-tokens.js` (Jupiter) and
 * `db/backfill-token-enrichment.js` (DexScreener). Both report on a **24-hour**
 * window, so `priceChange24h`, `volume24h`, `liquidity`, `marketCap`, `buys`,
 * `sells` and `holders` below are real.
 *
 * Neither source reports 1m/5m/1h intervals. Those are left to
 * `createMarketSnapshot`'s zero default, and **zero here means unmeasured, not
 * flat** — the same pre-existing convention as `lib/api/birdeye/mapper.ts`,
 * which sets them to `0` for the identical reason. Do not render them as a
 * price move; a real short-interval feed has to come from the trade stream.
 */
export async function getMarketSnapshots(limit = 25): Promise<MarketSnapshot[]> {
  const { rows } = await dbPool.query<{
    mint: string;
    symbol: string | null;
    price_usd: string | null;
    price_change_24h: string | null;
    volume_24h_usd: string | null;
    liquidity_usd: string | null;
    market_cap_usd: string | null;
    buy_count_24h: number | null;
    sell_count_24h: number | null;
    holder_count: number | null;
    updated_at: string | null;
  }>(
    `SELECT mint,
            symbol,
            price_usd,
            price_change_24h,
            volume_24h_usd,
            liquidity_usd,
            market_cap_usd,
            buy_count_24h,
            sell_count_24h,
            holder_count,
            updated_at
       FROM realtime_tokens
      WHERE enrichment_status = 'OK'
        AND price_usd IS NOT NULL
      ORDER BY volume_24h_usd DESC NULLS LAST
      LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)],
  );

  const num = (v: string | null): number => {
    if (v === null || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return rows.map((row) =>
    createMarketSnapshot({
      tokenId: row.mint,
      symbol: row.symbol ?? '—',
      priceUsd: row.price_usd ?? '0',
      priceChange24h: num(row.price_change_24h),
      volume24hUsd: row.volume_24h_usd ?? '0',
      liquidityUsd: row.liquidity_usd ?? '0',
      marketCapUsd: row.market_cap_usd ?? '0',
      buys: row.buy_count_24h ?? 0,
      sells: row.sell_count_24h ?? 0,
      holders: row.holder_count ?? 0,
      // The row's own measurement time, not `now()` — a snapshot must not
      // present enrichment from hours ago as a reading taken this second.
      timestamp: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    }),
  );
}
