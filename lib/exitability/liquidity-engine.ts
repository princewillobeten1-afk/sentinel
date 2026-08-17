/**
 * Liquidity Quality Engine (spec §7, §8, §15, §17, §18, §19, §20)
 *
 * Separates displayed liquidity from immediately usable liquidity, models
 * concentration and stability, and (for CLMMs) derives active liquidity and
 * depth across price bands below the current price.
 */

import type {
  ExitabilityContext,
  ExitabilitySignal,
  LiquidityChange,
  LiquidityQuality,
  PoolState,
} from './types';
import { adapterForPool } from './amm';
import {
  clamp,
  evidence,
  formatUsd,
  herfindahl,
  round,
  share,
} from './utils';

const PRICE_DROP_BANDS = [0.05, 0.1, 0.2];

export function analyzeLiquidityQuality(context: ExitabilityContext): LiquidityQuality {
  const pools = context.pools ?? [];
  const observedAt = context.observedAt;
  const signals: ExitabilitySignal[] = [];
  const limitations: string[] = [];

  const totalLiquidityUsd = round(pools.reduce((total, pool) => total + pool.tvlUsd, 0), 2);
  const usableByPool = pools.map((pool) => adapterForPool(pool).usableLiquidityUsd(pool));
  const usableLiquidityUsd = round(usableByPool.reduce((total, value) => total + value, 0), 2);
  const activeLiquidityUsd = round(
    pools.reduce((total, pool) => total + activeLiquidityForPool(pool), 0),
    2,
  );

  if (pools.length === 0) {
    limitations.push('No pool state available; liquidity quality cannot be assessed.');
  }
  if (usableLiquidityUsd < totalLiquidityUsd * 0.5) {
    signals.push({
      type: 'USABLE_LIQUIDITY_GAP',
      severity: usableLiquidityUsd < totalLiquidityUsd * 0.25 ? 'HIGH' : 'MEDIUM',
      polarity: 'NEGATIVE',
      value: round(share(usableLiquidityUsd, totalLiquidityUsd)),
      confidence: 0.82,
      evidence: [
        evidence(
          `Only ${formatUsd(usableLiquidityUsd)} of ${formatUsd(totalLiquidityUsd)} displayed liquidity is immediately usable`,
          'pool_state',
          observedAt,
          usableLiquidityUsd,
          0.82,
        ),
      ],
    });
  }

  // Pool concentration (HHI of usable shares) + top-pool share.
  const usableShares = usableByPool.map((value) => share(value, usableLiquidityUsd));
  const poolConcentration = round(herfindahl(usableShares));
  const topPoolShare = round(Math.max(0, ...usableShares));
  const poolDepthUsd = round(Math.max(0, ...usableByPool), 2);

  if (topPoolShare >= 0.7 && pools.length > 0) {
    signals.push({
      type: 'POOL_CONCENTRATION',
      severity: topPoolShare >= 0.9 ? 'HIGH' : 'MEDIUM',
      polarity: 'NEGATIVE',
      value: topPoolShare,
      confidence: 0.8,
      evidence: [
        evidence(
          `${round(topPoolShare * 100, 1)}% of usable liquidity sits in a single pool`,
          'pool_state',
          observedAt,
          topPoolShare,
          0.8,
        ),
      ],
    });
  }

  // Liquidity changes / volatility (spec §15).
  const liquidityChanges = aggregateLiquidityChanges(pools);
  const worstDrop = Math.min(0, ...liquidityChanges.map((change) => change.changePct));
  if (worstDrop <= -20) {
    signals.push({
      type: 'LIQUIDITY_DECLINE',
      severity: worstDrop <= -35 ? 'CRITICAL' : 'HIGH',
      polarity: 'NEGATIVE',
      value: round(worstDrop, 2),
      confidence: 0.85,
      evidence: [
        evidence(
          `Liquidity has declined ${round(Math.abs(worstDrop), 1)}% in a recent window`,
          'liquidity_history',
          observedAt,
          worstDrop,
          0.85,
        ),
      ],
    });
  }

  const stabilityScore = computeStabilityScore(pools, liquidityChanges);
  const bandDepth = computeBandDepth(pools);

  const lpLocked = pools.length > 0 ? pools.every((pool) => pool.lpLocked) : undefined;
  const lpLockedPct = pools.length > 0
    ? round(
        pools.reduce((total, pool) => total + (pool.lpLockedPct ?? 0) * share(pool.tvlUsd, totalLiquidityUsd), 0),
        2,
      )
    : undefined;

  const confidence = computeConfidence(context, pools);
  if (pools.some((pool) => pool.kind === 'CONCENTRATED_LIQUIDITY' && !pool.bands && pool.activeLiquidityUsd == null)) {
    limitations.push('Concentrated-liquidity band detail unavailable for one or more pools; active liquidity is estimated.');
  }

  return {
    tokenId: context.tokenId,
    chain: context.chain,
    totalLiquidityUsd,
    usableLiquidityUsd,
    activeLiquidityUsd,
    poolCount: pools.length,
    poolDepthUsd,
    poolConcentration,
    topPoolShare,
    liquidityChanges,
    stabilityScore,
    lpLocked,
    lpLockedPct,
    bandDepth,
    signals,
    confidence,
    limitations,
  };
}

function activeLiquidityForPool(pool: PoolState): number {
  if (pool.kind === 'CONCENTRATED_LIQUIDITY') {
    if (pool.activeLiquidityUsd != null) return pool.activeLiquidityUsd;
    if (pool.bands) {
      return pool.bands
        .filter((band) => band.lowerPriceRatio <= 1 && band.upperPriceRatio >= 1)
        .reduce((total, band) => total + band.liquidityUsd, 0);
    }
    return pool.tvlUsd * 0.35;
  }
  return pool.tvlUsd / 2;
}

function aggregateLiquidityChanges(pools: PoolState[]): LiquidityChange[] {
  // In production these come from LiquiditySnapshot history. Here we derive a
  // TVL-weighted change per window from any per-pool change metadata.
  const windows: LiquidityChange['window'][] = ['5m', '15m', '1h', '4h', '24h'];
  const totalTvl = pools.reduce((total, pool) => total + pool.tvlUsd, 0) || 1;
  return windows.map((window) => {
    const weighted = pools.reduce((total, pool) => {
      const meta = (pool as PoolState & { changes?: Record<string, number> }).changes;
      const changePct = meta?.[window] ?? 0;
      return total + changePct * (pool.tvlUsd / totalTvl);
    }, 0);
    return { window, changePct: round(weighted, 2) };
  });
}

function computeStabilityScore(pools: PoolState[], changes: LiquidityChange[]): number {
  if (pools.length === 0) return 0;
  let score = 70;

  const avgAge = pools.reduce((total, pool) => total + (pool.ageHours ?? 0), 0) / pools.length;
  if (avgAge >= 24 * 30) score += 15;
  else if (avgAge >= 24 * 7) score += 10;
  else if (avgAge >= 24) score += 5;
  else if (avgAge > 0 && avgAge < 6) score -= 10;

  const worstDrop = Math.min(0, ...changes.map((change) => change.changePct));
  if (worstDrop <= -50) score -= 45;
  else if (worstDrop <= -35) score -= 30;
  else if (worstDrop <= -20) score -= 18;
  else if (worstDrop <= -10) score -= 8;

  const variance = changes.reduce((total, change) => total + Math.abs(change.changePct), 0) / changes.length;
  score -= Math.min(20, variance * 0.4);

  if (pools.some((pool) => pool.lpLocked)) score += 6;

  return Math.round(clamp(score));
}

function computeBandDepth(pools: PoolState[]): { priceDropPct: number; liquidityUsd: number }[] {
  return PRICE_DROP_BANDS.map((drop) => {
    const ratio = 1 - drop;
    const liquidityUsd = pools.reduce((total, pool) => {
      if (pool.kind === 'CONCENTRATED_LIQUIDITY' && pool.bands) {
        const inRange = pool.bands
          .filter((band) => band.lowerPriceRatio <= ratio)
          .reduce((bandTotal, band) => bandTotal + band.liquidityUsd, 0);
        return total + inRange;
      }
      // CP pools provide depth continuously; approximate depth to a price drop.
      return total + (pool.tvlUsd / 2) * drop;
    }, 0);
    return { priceDropPct: round(drop * 100, 1), liquidityUsd: round(liquidityUsd, 2) };
  });
}

function computeConfidence(context: ExitabilityContext, pools: PoolState[]): number {
  let confidence = pools.length > 0 ? 0.7 : 0.2;
  if (pools.length >= 2) confidence += 0.05;
  if (context.dataCompleteFrom && context.dataCompleteTo) confidence += 0.1;
  if (pools.some((pool) => pool.bands || pool.activeLiquidityUsd != null)) confidence += 0.1;
  return round(Math.min(1, confidence));
}

