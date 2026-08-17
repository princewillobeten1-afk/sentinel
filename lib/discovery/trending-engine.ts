import { DiscoveryToken, TimeWindow } from './types';

export interface TrendingSignalBreakdown {
  activityScore: number;
  volumeAccelScore: number;
  txCountScore: number;
  momentumScore: number;
  attentionScore: number;
  liquidityScore: number;
  recencyScore: number;
}

export interface TrendingResult {
  trendingRankScore: number; // 0 - 100 (after decay)
  rawScore: number; // 0 - 100 (before decay)
  decayFactor: number; // 0.0 - 1.0
  breakdown: TrendingSignalBreakdown;
  trendingReason: string;
}

/**
 * TREND DECAY FUNCTION
 *
 * decayFactor = e^(-λ × ageMinutes)
 *
 * λ (lambda) = 0.008
 * Half-life ≈ ln(2) / λ ≈ 86.6 minutes (~1.4 hours)
 *
 * Behavior:
 *   - At 0 minutes:   decayFactor = 1.00 (full score)
 *   - At 30 minutes:  decayFactor ≈ 0.79
 *   - At 60 minutes:  decayFactor ≈ 0.62
 *   - At 90 minutes:  decayFactor ≈ 0.49 (roughly half)
 *   - At 120 minutes: decayFactor ≈ 0.38
 *   - At 180 minutes: decayFactor ≈ 0.24
 *   - At 360 minutes: decayFactor ≈ 0.06
 *   - At 1440 minutes (1d): decayFactor ≈ 0.0001 (effectively zero)
 *
 * A token will NOT remain #1 indefinitely from a single historical spike.
 * Sustained, fresh activity is required to maintain top trending position.
 */
const DECAY_LAMBDA = 0.008;

function calculateDecayFactor(ageMinutes: number): number {
  return Math.exp(-DECAY_LAMBDA * Math.max(0, ageMinutes));
}

/**
 * Trending Engine — Combines Activity, Volume, Transaction Count, Momentum, Attention, Liquidity, and Recency.
 * Applies exponential time-decay so tokens lose ranking without sustained activity.
 * Explicitly avoids sorting by market cap alone.
 */
export function calculateTrendingScore(token: DiscoveryToken, window: TimeWindow): TrendingResult {
  // 1. Activity & Market-side Imbalance (18%)
  const totalTx = token.buysCount + token.sellsCount;
  const buyRatio = totalTx > 0 ? token.buysCount / totalTx : 0.5;
  const imbalanceScore = Math.min(100, Math.max(0, token.buySellImbalancePct ?? Math.abs((buyRatio - 0.5) * 200)));
  const activityScore = Math.min(100, Math.max(0, imbalanceScore));

  // 2. Volume Acceleration (18%)
  const volumeAccelScore = Math.min(100, Math.max(0, token.volumeChange15mPct / 5));

  // 3. Transaction Count Density (12%)
  const txCountScore = Math.min(100, Math.max(0, Math.log10(Math.max(1, token.txCount15m)) * 30));

  // 3. Transaction Acceleration (12%)
  const txAccelScore = Math.min(100, Math.max(0, token.txAccelerationPct ? token.txAccelerationPct / 3 : 0));

  // 4. Price Momentum Velocity (15%)
  const pChange = Math.abs(token.priceChange15m);
  const momentumScore = Math.min(100, Math.max(0, pChange * 3.5));

  // 5. Market Attention & Holder Growth (13%)
  const attentionScore = Math.min(100, Math.max(0, token.holderGrowth1hPct * 3.0));

  // 6. Liquidity Depth & Stability (8%)
  const liqNum = parseFloat(token.liquidityUsd);
  const liquidityScore = Math.min(100, Math.max(0, Math.log10(Math.max(1, liqNum)) * 18));

  // 7. Token Recency Boost (6%)
  const recencyScore = token.ageMinutes <= 60 ? 100 : Math.max(10, 100 - token.ageMinutes / 20);

  // Composite Weighted Sum (raw, before decay)
  const weightedTotal =
    activityScore * 0.18 +
    volumeAccelScore * 0.18 +
    txCountScore * 0.12 +
    txAccelScore * 0.12 +
    momentumScore * 0.15 +
    attentionScore * 0.13 +
    liquidityScore * 0.08 +
    recencyScore * 0.06;

  const rawScore = Math.min(100, Math.max(0, Math.round(weightedTotal)));

  // Apply exponential time-decay based on token age
  const decayFactor = calculateDecayFactor(token.ageMinutes);
  const trendingRankScore = Math.min(100, Math.max(0, Math.round(rawScore * decayFactor)));

  const breakdown: TrendingSignalBreakdown = {
    activityScore: Math.round(activityScore),
    volumeAccelScore: Math.round(volumeAccelScore),
    txCountScore: Math.round(txCountScore),
    momentumScore: Math.round(momentumScore),
    attentionScore: Math.round(attentionScore),
    liquidityScore: Math.round(liquidityScore),
    recencyScore: Math.round(recencyScore),
  };

  const decayPct = ((1 - decayFactor) * 100).toFixed(0);
  const trendingReason = `Ranked by multi-signal velocity: ${token.txCount15m} trades in 15m with +${token.volumeChange15mPct}% volume acceleration (decay: −${decayPct}% from ${token.ageMinutes}m age)`;

  return {
    trendingRankScore,
    rawScore,
    decayFactor: Number(decayFactor.toFixed(4)),
    breakdown,
    trendingReason,
  };
}
