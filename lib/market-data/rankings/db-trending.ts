import 'server-only';

import { dbPool } from '@/lib/server/db/pool';

/**
 * Trending tokens, ranked from measured data.
 *
 * Replaces `RankingEngine.getTrendingTokens()` for the API path. That version
 * read `TokenDiscoveryPipeline.listTokens()`, an in-memory `Map` seeded at
 * construction with four hardcoded tokens — three of them ACTIVE, which is why
 * the Overview's Trending tab showed exactly three entries no matter what limit
 * it asked for. Two of those seeds carried truncated display strings
 * (`3mA1...4c90`) where a mint address belongs, so they could never have been
 * looked up, traded, or charted.
 *
 * Its scoring had the same problem in miniature: `activityMomentum` was the
 * literal `18.5`, commented "simulated active trader interactions". Every token
 * scored identically on a third of the ranking.
 *
 * The score below is computed from columns that hold real measurements, and
 * every component degrades to zero when its input is missing rather than
 * inventing a middle value.
 */

export interface TrendingToken {
  rank: number;
  tokenId: string;
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  changePct: number | null;
  volumeUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  organicVolumeUsd: number | null;
  /** Share of 24h volume that is organic, 0–100. Null when unmeasured. */
  organicPct: number | null;
  holderCount: number | null;
  logoUrl: string | null;
  score: number;
  trendBreakdown: TrendBreakdown;
  marketSource: string | null;
  updatedAt: string | null;
}

export interface TrendBreakdown {
  /** 0–35. Turnover: how much of the pool changed hands. */
  volumeMomentum: number;
  /** 0–30. 24h price move, upside only. */
  priceMomentum: number;
  /** 0–20. Share of volume that is organic — measured, not assumed. */
  organicActivity: number;
  /** 0–15. Depth, log-scaled. */
  liquidityFactor: number;
  finalScore: number;
}

export interface TrendingRow {
  mint: string;
  token_id: string | null;
  symbol: string | null;
  name: string | null;
  logo_url: string | null;
  price_usd: string | null;
  price_change_24h: string | null;
  liquidity_usd: string | null;
  market_cap_usd: string | null;
  volume_24h_usd: string | null;
  organic_volume_24h_usd: string | null;
  holder_count: number | null;
  market_source: string | null;
  updated_at: string | null;
}

/** NUMERIC arrives from `pg` as a string. Null stays null. */
function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Scores one token, 0–100.
 *
 * Each component is clamped to its own ceiling so no single factor can carry a
 * token on its own, and each contributes **zero** when its input is missing.
 * That asymmetry is deliberate: a token we know nothing about should rank below
 * one we have measured, not float to the middle on default values.
 */
export function computeTrendScore(row: {
  volume24hUsd: number | null;
  organicVolume24hUsd: number | null;
  liquidityUsd: number | null;
  priceChange24h: number | null;
}): TrendBreakdown {
  const volume = row.volume24hUsd ?? 0;
  const liquidity = row.liquidityUsd ?? 0;

  // Turnover — volume against the depth backing it. A pool trading many times
  // its own liquidity is where momentum actually shows up, and unlike raw
  // volume it does not simply rank the largest tokens first every time.
  const turnover = liquidity > 0 ? volume / liquidity : 0;
  const volumeMomentum = Math.min(35, Math.log10(1 + turnover) * 20);

  // Upside only. A token down 40% is not trending; scoring |change| would rank
  // a collapse alongside a rally.
  const change = row.priceChange24h ?? 0;
  const priceMomentum = Math.min(30, Math.max(0, change) * 0.6);

  // The component that used to be the constant 18.5. Organic share is now
  // measured, so a token whose volume is mostly wash trading scores near zero
  // here — which is the entire point of this platform.
  const organic = row.organicVolume24hUsd;
  const organicActivity =
    organic !== null && volume > 0 ? Math.min(20, (organic / volume) * 100 * 0.8) : 0;

  const liquidityFactor = liquidity > 0 ? Math.min(15, Math.log10(liquidity) * 2.2) : 0;

  const finalScore = round2(volumeMomentum + priceMomentum + organicActivity + liquidityFactor);

  return {
    volumeMomentum: round2(volumeMomentum),
    priceMomentum: round2(priceMomentum),
    organicActivity: round2(organicActivity),
    liquidityFactor: round2(liquidityFactor),
    finalScore,
  };
}

/** Maps a database row onto the API shape, scoring it on the way. */
export function toTrendingToken(row: TrendingRow): TrendingToken {
  const volume24hUsd = num(row.volume_24h_usd);
  const organicVolumeUsd = num(row.organic_volume_24h_usd);

  const breakdown = computeTrendScore({
    volume24hUsd,
    organicVolume24hUsd: organicVolumeUsd,
    liquidityUsd: num(row.liquidity_usd),
    priceChange24h: num(row.price_change_24h),
  });

  return {
    rank: 0,
    // `tokenId` falls back to the mint so the field is never empty: the UI uses
    // it to build trade links, and an empty id produces a dead card.
    tokenId: row.token_id ?? row.mint,
    mint: row.mint,
    symbol: row.symbol ?? '—',
    name: row.name ?? row.symbol ?? 'Unknown',
    priceUsd: num(row.price_usd),
    changePct: num(row.price_change_24h),
    volumeUsd: volume24hUsd,
    liquidityUsd: num(row.liquidity_usd),
    marketCapUsd: num(row.market_cap_usd),
    organicVolumeUsd,
    organicPct:
      organicVolumeUsd !== null && volume24hUsd && volume24hUsd > 0
        ? round2((organicVolumeUsd / volume24hUsd) * 100)
        : null,
    holderCount: row.holder_count ?? null,
    logoUrl: row.logo_url ?? null,
    score: breakdown.finalScore,
    trendBreakdown: breakdown,
    marketSource: row.market_source ?? null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/**
 * Reads and ranks trending tokens.
 *
 * Only rows with a price are considered — a token with no measured price cannot
 * be ranked against one that has, and padding the list with unpriced entries
 * would fill the tab with cards reading "—" in every field.
 */
export async function getTrendingTokens(limit: number): Promise<TrendingToken[]> {
  const { rows } = await dbPool.query<TrendingRow>(
    `SELECT r.mint,
            t.id AS token_id,
            r.symbol,
            r.name,
            COALESCE(t.logo_url, r.image_url) AS logo_url,
            r.price_usd,
            r.price_change_24h,
            r.liquidity_usd,
            r.market_cap_usd,
            r.volume_24h_usd,
            r.organic_volume_24h_usd,
            r.holder_count,
            r.market_source,
            r.updated_at
       FROM realtime_tokens r
       LEFT JOIN tokens t ON t.address = r.mint
      WHERE r.enrichment_status = 'OK'
        AND r.price_usd IS NOT NULL
      -- A generous pre-filter: ranking happens in JS, so this only bounds how
      -- much is read. Ordered by volume so the cut keeps the liveliest tokens.
      ORDER BY r.volume_24h_usd DESC NULLS LAST
      LIMIT $1`,
    [Math.max(limit * 5, 100)],
  );

  return rows
    .map(toTrendingToken)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}
