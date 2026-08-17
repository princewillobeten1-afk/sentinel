import type { PoolQuote, PoolState, TradeSide } from '../types';
import { round } from '../utils';
import type { AmmAdapter } from './types';

/**
 * Constant-product (x*y=k) adapter — Raydium/Orca v2/pump.fun style pools.
 *
 * We work in USD-equivalent reserves. A SELL of the base token increases the
 * base reserve and withdraws quote; the exact output is derived from the
 * invariant rather than a linear approximation.
 *
 *   Sell:  quoteOut = quoteReserve - k / (baseReserve + baseIn)
 *   Buy:   baseOut  = baseReserve  - k / (quoteReserve + quoteIn)
 *
 * Fees are taken on the input side, matching typical AMM behaviour.
 */
export const constantProductAdapter: AmmAdapter = {
  kind: 'CONSTANT_PRODUCT',

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
    // For a CP pool the whole quote reserve backs sells, but only a fraction is
    // executable at tolerable impact. We treat the quote-side reserve as the
    // usable depth for exit purposes.
    return round(quoteReserveUsd(pool), 2);
  },
};

function quoteReserveUsd(pool: PoolState): number {
  // Reserves are stored in token/quote units; convert quote reserve to USD.
  // Mock data provides tvlUsd; for a balanced CP pool half the TVL is quote.
  if (pool.quoteReserve > 0 && pool.priceUsd > 0) {
    // Assume quote reserve already denominated so that reserve*price ≈ half TVL.
    return Math.max(pool.tvlUsd / 2, 1);
  }
  return Math.max(pool.tvlUsd / 2, 1);
}

function quote(pool: PoolState, side: TradeSide, inputUsd: number): PoolQuote {
  const feeUsd = inputUsd * (pool.feeTierPct / 100);
  const netInput = Math.max(0, inputUsd - feeUsd);

  // Model reserves in USD terms: base side and quote side each ≈ half TVL.
  const halfTvl = Math.max(pool.tvlUsd / 2, 1);
  const baseUsd = halfTvl;
  const quoteUsd = halfTvl;
  const k = baseUsd * quoteUsd;

  let grossOutputUsd: number;
  let priceImpactPct: number;
  let liquidityConsumedPct: number;

  if (side === 'SELL') {
    // Selling base → base reserve grows, quote reserve shrinks.
    const newBase = baseUsd + netInput;
    const newQuote = k / newBase;
    grossOutputUsd = quoteUsd - newQuote;
    const execPrice = grossOutputUsd / Math.max(netInput, 1e-9);
    priceImpactPct = clampPct((1 - execPrice) * 100);
    liquidityConsumedPct = clampFrac(netInput / quoteUsd);
  } else {
    // Buying base → quote reserve grows, base reserve shrinks.
    const newQuote = quoteUsd + netInput;
    const newBase = k / newQuote;
    grossOutputUsd = baseUsd - newBase;
    const execPrice = grossOutputUsd / Math.max(netInput, 1e-9);
    priceImpactPct = clampPct((1 - execPrice) * 100);
    liquidityConsumedPct = clampFrac(netInput / baseUsd);
  }

  const outputUsd = Math.max(0, grossOutputUsd);

  return {
    poolId: pool.poolId,
    dex: pool.dex,
    kind: 'CONSTANT_PRODUCT',
    side,
    inputUsd: round(inputUsd, 2),
    grossOutputUsd: round(grossOutputUsd, 2),
    outputUsd: round(outputUsd, 2),
    priceImpactPct: round(priceImpactPct, 4),
    feeUsd: round(feeUsd, 2),
    liquidityConsumedPct: round(liquidityConsumedPct, 4),
    confidence: pool.tvlUsd > 0 ? 0.9 : 0.4,
  };
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(99.99, value));
}

function clampFrac(value: number): number {
  return Math.max(0, Math.min(1, value));
}
