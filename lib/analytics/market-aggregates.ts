import 'server-only';

import { dbPool } from '@/lib/server/db/pool';

/**
 * Market-wide aggregates, measured.
 *
 * `/api/v1/analytics/market` previously passed fixed numbers into the regime
 * classifier — `148_250_000` of volume, `1840` new mints, `185_000` median
 * depth, an advance/decline ratio of `2.1` — under a comment reading "aggregate
 * simulated market telemetry". Downstream of that, `decomposeVolume` was called
 * with `trades: []`, which makes it multiply the total by constants: 52/48
 * buy/sell, 18% wash, 4% creator, 8% insider. The Overview's headline
 * "74.8% organic" was the arithmetic result of those constants, identical on
 * every request and unrelated to any market.
 *
 * Everything here is computed from `realtime_tokens`. Where a figure cannot be
 * measured from what that table holds, it is returned as `null` rather than
 * estimated — a distinction the callers are expected to render as "—".
 */

export interface MarketAggregates {
  /** Sum of 24h volume across every priced token. */
  totalVolumeUsd: number | null;
  buyVolumeUsd: number | null;
  sellVolumeUsd: number | null;
  organicVolumeUsd: number | null;
  /** Total volume for only tokens with an organic-volume observation. */
  organicEligibleVolumeUsd: number | null;
  organicCoverageTokens: number;
  /** Organic share of volume with an organic-volume observation, 0–100. */
  organicVolumePct: number | null;
  /** The inverse of organic share. Not a probability model — a complement. */
  washTradingProbabilityPct: number | null;
  suspectedWashVolumeUsd: number | null;
  medianPoolDepthUsd: number | null;
  /** Tokens first seen in the last 24h. */
  newMintsCount24h: number;
  /** Rising tokens over falling. `null` when nothing is falling. */
  advanceDeclineRatio: number | null;
  solanaPriceChange24hPct: number | null;
  totalLiquidityUsd: number | null;
  traderCount24h: number | null;
  tokenCount: number;
  advancingCount: number;
  decliningCount: number;
  unchangedCount: number;
  /** When the freshest row in the aggregate was measured. */
  updatedAt: string | null;
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export async function getMarketAggregates(): Promise<MarketAggregates> {
  const { rows } = await dbPool.query<{
    token_count: string;
    total_volume: string | null;
    buy_volume: string | null;
    sell_volume: string | null;
    organic_volume: string | null;
    organic_eligible_volume: string | null;
    organic_coverage_tokens: string;
    total_liquidity: string | null;
    median_depth: string | null;
    trader_count: string | null;
    new_mints_24h: string;
    advancing: string;
    declining: string;
    unchanged: string;
    updated_at: string | null;
  }>(
    `SELECT COUNT(*)::text                                                        AS token_count,
            SUM(volume_24h_usd)::text                                            AS total_volume,
            SUM(buy_volume_24h_usd)::text                                        AS buy_volume,
            SUM(sell_volume_24h_usd)::text                                       AS sell_volume,
            SUM(organic_volume_24h_usd)::text                                    AS organic_volume,
            SUM(volume_24h_usd) FILTER (WHERE organic_volume_24h_usd IS NOT NULL)::text AS organic_eligible_volume,
            COUNT(*) FILTER (WHERE organic_volume_24h_usd IS NOT NULL)::text     AS organic_coverage_tokens,
            SUM(liquidity_usd)::text                                             AS total_liquidity,
            -- Median, not mean: a single very deep pool would drag an average
            -- far above anything a trader actually meets.
            percentile_cont(0.5) WITHIN GROUP (ORDER BY liquidity_usd)::text     AS median_depth,
            SUM(trader_count_24h)::text                                          AS trader_count,
            COUNT(*) FILTER (WHERE first_seen_at > NOW() - INTERVAL '24 hours')::text AS new_mints_24h,
            COUNT(*) FILTER (WHERE price_change_24h > 0)::text                   AS advancing,
            COUNT(*) FILTER (WHERE price_change_24h < 0)::text                   AS declining,
            COUNT(*) FILTER (WHERE price_change_24h = 0)::text                   AS unchanged,
            MAX(enriched_at)::text                                               AS updated_at
       FROM realtime_tokens
      WHERE enrichment_status = 'OK' AND price_usd IS NOT NULL`,
  );

  const r = rows[0];
  const tokenCount = Number(r?.token_count ?? 0);

  const totalVolumeUsd = num(r?.total_volume);
  const organicVolumeUsd = num(r?.organic_volume);
  const organicEligibleVolumeUsd = num(r?.organic_eligible_volume);

  const organicVolumePct =
    organicVolumeUsd !== null && organicEligibleVolumeUsd !== null && organicEligibleVolumeUsd > 0
      ? round((organicVolumeUsd / organicEligibleVolumeUsd) * 100, 1)
      : null;

  const declining = Number(r?.declining ?? 0);
  const advancing = Number(r?.advancing ?? 0);

  // SOL's own move, read from its row rather than assumed. Absent if SOL has
  // not been priced — the market has no reference point then, and saying so is
  // better than substituting zero.
  const { rows: solRows } = await dbPool.query<{ price_change_24h: string | null }>(
    `SELECT price_change_24h FROM realtime_tokens WHERE mint = $1`,
    [SOL_MINT],
  );

  return {
    totalVolumeUsd,
    buyVolumeUsd: num(r?.buy_volume),
    sellVolumeUsd: num(r?.sell_volume),
    organicVolumeUsd,
    organicEligibleVolumeUsd,
    organicCoverageTokens: Number(r?.organic_coverage_tokens ?? 0),
    organicVolumePct,
    washTradingProbabilityPct: organicVolumePct === null ? null : round(100 - organicVolumePct, 1),
    suspectedWashVolumeUsd:
      organicVolumeUsd !== null && organicEligibleVolumeUsd !== null
        ? round(Math.max(0, organicEligibleVolumeUsd - organicVolumeUsd), 2)
        : null,
    medianPoolDepthUsd: num(r?.median_depth),
    newMintsCount24h: Number(r?.new_mints_24h ?? 0),
    // Guarded: with nothing declining the ratio is undefined, not infinite.
    advanceDeclineRatio: declining > 0 ? round(advancing / declining, 2) : null,
    solanaPriceChange24hPct: num(solRows[0]?.price_change_24h),
    totalLiquidityUsd: num(r?.total_liquidity),
    traderCount24h: num(r?.trader_count),
    tokenCount,
    advancingCount: advancing,
    decliningCount: declining,
    unchangedCount: Number(r?.unchanged ?? 0),
    updatedAt: r?.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

export interface MarketMover {
  mint: string;
  symbol: string | null;
  name: string | null;
  change24hPct: number;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  observedAt: string | null;
}

/** A bounded, liquid-token comparison of measured 24h price changes. */
export async function getMarketMovers(limit = 6): Promise<{ gainers: MarketMover[]; decliners: MarketMover[] }> {
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  type Row = {
    mint: string; symbol: string | null; name: string | null; change_text: string;
    volume_24h_usd: string | null; liquidity_usd: string | null; enriched_at: string | null;
  };
  const query = (direction: 'ASC' | 'DESC', sign: '>' | '<') => dbPool.query<Row>(
    `SELECT mint, symbol, name, price_change_24h::text AS change_text, volume_24h_usd::text,
            liquidity_usd::text, enriched_at::text
       FROM realtime_tokens
      WHERE enrichment_status = 'OK' AND price_usd > 0
        AND price_change_24h ${sign} 0
        AND liquidity_usd >= 1000 AND volume_24h_usd >= 100
      ORDER BY realtime_tokens.price_change_24h ${direction}, volume_24h_usd DESC NULLS LAST
      LIMIT $1`,
    [safeLimit],
  );
  const [positive, negative] = await Promise.all([query('DESC', '>'), query('ASC', '<')]);
  const normalize = (row: Row): MarketMover => ({
    mint: row.mint, symbol: row.symbol, name: row.name,
    change24hPct: Number(row.change_text),
    volume24hUsd: num(row.volume_24h_usd), liquidityUsd: num(row.liquidity_usd),
    observedAt: row.enriched_at ? new Date(row.enriched_at).toISOString() : null,
  });
  return { gainers: positive.rows.map(normalize), decliners: negative.rows.map(normalize) };
}
