import type { LiquidityBand, PoolQuote, PoolState, TradeSide } from '../types';
import { round } from '../utils';
import type { AmmAdapter } from './types';

/**
 * Concentrated-liquidity (CLMM) adapter — Orca Whirlpools / Raydium CLMM style.
 *
 * The defining property (spec §19–20): displayed TVL can massively overstate
 * immediately usable liquidity when liquidity is positioned away from the
 * current price. This adapter fills an order by walking price bands outward
 * from the current price. Only liquidity inside bands the price actually
 * traverses is consumed; out-of-range liquidity contributes nothing to a fill.
 */
export const concentratedAdapter: AmmAdapter = {
  kind: 'CONCENTRATED_LIQUIDITY',

  getPoolState(pool) {
    return pool;
  },

  quoteBuy(pool, inputUsd) {
    return quote(pool, 'BUY', inputUsd);
  },

  quoteSell(pool, inputUsd) {
    return quote(pool, 'SELL', inputUsd);
  },

  estimateImpact(pool, side, inputUsd) {
    return quote(pool, side, inputUsd).priceImpactPct;
  },

  usableLiquidityUsd(pool) {
    return round(activeUsable(pool), 2);
  },
};

/** Liquidity realistically usable for an exit — active band(s) around price. */
function activeUsable(pool: PoolState): number {
  if (pool.activeLiquidityUsd != null) return Math.max(0, pool.activeLiquidityUsd);
  if (pool.bands && pool.bands.length > 0) {
    return sumBandsCovering(pool.bands, 1.0);
  }
  // No CLMM detail available → conservatively assume a fraction of TVL is active.
  return Math.max(0, pool.tvlUsd * 0.35);
}

function sumBandsCovering(bands: LiquidityBand[], priceRatio: number): number {
  return bands
    .filter((band) => band.lowerPriceRatio <= priceRatio && band.upperPriceRatio >= priceRatio)
    .reduce((total, band) => total + band.liquidityUsd, 0);
}

function quote(pool: PoolState, side: TradeSide, inputUsd: number): PoolQuote {
  const feeUsd = inputUsd * (pool.feeTierPct / 100);
  const netInput = Math.max(0, inputUsd - feeUsd);

  // Bands sorted for the traversal direction. A SELL pushes price down, so we
  // consume bands from the current price downward; a BUY pushes it up.
  const bands = normalizedBands(pool);
  const ordered = side === 'SELL'
    ? [...bands].sort((a, b) => b.lowerPriceRatio - a.lowerPriceRatio) // high→low
    : [...bands].sort((a, b) => a.upperPriceRatio - b.upperPriceRatio); // low→high

  let remaining = netInput;
  let output = 0;
  let deepestRatioReached = 1.0;
  let consumedLiquidity = 0;

  for (const band of ordered) {
    if (remaining <= 0) break;
    const bandDepth = band.liquidityUsd;
    if (bandDepth <= 0) continue;
    const filled = Math.min(remaining, bandDepth);
    // Effective execution price is the far edge the price must reach to fill the
    // band: the lower bound for a SELL (price falls), the upper bound for a BUY.
    // This correctly makes out-of-range bands (e.g. 0.4–0.6) fill at a steep
    // discount rather than near par.
    const effectiveRatio = side === 'SELL' ? band.lowerPriceRatio : band.upperPriceRatio;
    output += filled * effectiveRatio;
    remaining -= filled;
    consumedLiquidity += filled;
    deepestRatioReached = side === 'SELL'
      ? Math.min(deepestRatioReached, band.lowerPriceRatio)
      : Math.max(deepestRatioReached, band.upperPriceRatio);
  }

  // Any portion that could not be filled from active bands falls off a cliff —
  // model it as near-total loss to reflect a market with no depth there.
  if (remaining > 0) {
    output += remaining * 0.1; // severe impact for unbacked size
    consumedLiquidity += remaining;
  }

  const execPrice = output / Math.max(netInput, 1e-9);
  const priceImpactPct = clampPct((1 - execPrice) * 100);
  const usable = activeUsable(pool);
  const liquidityConsumedPct = clampFrac(consumedLiquidity / Math.max(usable, 1));

  return {
    poolId: pool.poolId,
    dex: pool.dex,
    kind: 'CONCENTRATED_LIQUIDITY',
    side,
    inputUsd: round(inputUsd, 2),
    grossOutputUsd: round(output, 2),
    outputUsd: round(Math.max(0, output), 2),
    priceImpactPct: round(priceImpactPct, 4),
    feeUsd: round(feeUsd, 2),
    liquidityConsumedPct: round(liquidityConsumedPct, 4),
    confidence: pool.bands && pool.bands.length > 0 ? 0.85 : 0.6,
  };
}

/** Produce a synthetic band layout when explicit bands are absent. */
function normalizedBands(pool: PoolState): LiquidityBand[] {
  if (pool.bands && pool.bands.length > 0) return pool.bands;
  const active = activeUsable(pool);
  // Concentrate most active liquidity tight around price, thinning outward.
  return [
    { lowerPriceRatio: 0.98, upperPriceRatio: 1.02, liquidityUsd: active * 0.55 },
    { lowerPriceRatio: 0.9, upperPriceRatio: 1.1, liquidityUsd: active * 0.3 },
    { lowerPriceRatio: 0.8, upperPriceRatio: 1.2, liquidityUsd: active * 0.15 },
  ];
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(99.99, value));
}

function clampFrac(value: number): number {
  return Math.max(0, Math.min(1, value));
}
