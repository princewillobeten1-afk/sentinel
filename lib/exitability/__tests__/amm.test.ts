import { describe, it, expect } from 'vitest';
import { constantProductAdapter, concentratedAdapter } from '../amm';
import type { PoolState } from '../types';

const NOW = new Date().toISOString();

function cpPool(tvlUsd: number): PoolState {
  return {
    poolId: 'cp', dex: 'Raydium', kind: 'CONSTANT_PRODUCT',
    baseReserve: tvlUsd / 2, quoteReserve: tvlUsd / 2, priceUsd: 1,
    tvlUsd, feeTierPct: 0.25, observedAt: NOW,
  };
}

describe('Sprint 8 — AMM adapters', () => {
  it('constant-product: larger orders incur monotonically higher price impact', () => {
    const pool = cpPool(1_000_000);
    const small = constantProductAdapter.quoteSell(pool, 1_000);
    const medium = constantProductAdapter.quoteSell(pool, 10_000);
    const large = constantProductAdapter.quoteSell(pool, 100_000);

    expect(small.priceImpactPct).toBeLessThan(medium.priceImpactPct);
    expect(medium.priceImpactPct).toBeLessThan(large.priceImpactPct);
    expect(small.outputUsd).toBeGreaterThan(0);
  });

  it('constant-product: deeper pools produce lower impact for the same order', () => {
    const shallow = constantProductAdapter.estimateImpact(cpPool(100_000), 'SELL', 5_000);
    const deep = constantProductAdapter.estimateImpact(cpPool(5_000_000), 'SELL', 5_000);
    expect(deep).toBeLessThan(shallow);
  });

  it('constant-product: fees reduce net output', () => {
    const pool = cpPool(1_000_000);
    const quote = constantProductAdapter.quoteSell(pool, 10_000);
    expect(quote.feeUsd).toBeCloseTo(10_000 * 0.0025, 2);
    expect(quote.outputUsd).toBeLessThan(10_000);
  });

  it('concentrated liquidity: out-of-range liquidity does not back the fill', () => {
    // $1M TVL but only $45K active around price → usable is tiny.
    const pool: PoolState = {
      poolId: 'clmm', dex: 'Orca', kind: 'CONCENTRATED_LIQUIDITY',
      baseReserve: 0, quoteReserve: 0, priceUsd: 0.05, tvlUsd: 1_000_000,
      feeTierPct: 0.3, activeLiquidityUsd: 45_000, observedAt: NOW,
      bands: [
        { lowerPriceRatio: 0.98, upperPriceRatio: 1.02, liquidityUsd: 30_000 },
        { lowerPriceRatio: 0.9, upperPriceRatio: 1.1, liquidityUsd: 15_000 },
        { lowerPriceRatio: 0.4, upperPriceRatio: 0.6, liquidityUsd: 955_000 },
      ],
    };
    const usable = concentratedAdapter.usableLiquidityUsd(pool);
    expect(usable).toBeLessThan(100_000); // nowhere near displayed $1M

    // A $60K sell exceeds active bands → severe impact once it reaches
    // out-of-range liquidity that only fills at a steep discount.
    const quote = concentratedAdapter.quoteSell(pool, 60_000);
    expect(quote.priceImpactPct).toBeGreaterThan(15);
    // And a small in-range sell should be cheap by comparison.
    const small = concentratedAdapter.quoteSell(pool, 5_000);
    expect(small.priceImpactPct).toBeLessThan(quote.priceImpactPct);
  });
});
