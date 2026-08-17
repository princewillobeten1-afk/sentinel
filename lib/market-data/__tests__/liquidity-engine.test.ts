import { describe, it, expect, beforeEach } from 'vitest';
import { liquidityEngine } from '../liquidity/liquidity-engine';

describe('Canonical Liquidity Engine (Sprint 45 §23-26, §63)', () => {
  beforeEach(() => {
    liquidityEngine.reset();
  });

  it('aggregates total USD liquidity across verified active markets', () => {
    const sentMint = 'So11111111111111111111111111111111111111112';
    const liq = liquidityEngine.getTokenLiquidity(sentMint);

    expect(liq.totalLiquidityUsd).toBeGreaterThan(6_000_000);
    expect(liq.marketCount).toBeGreaterThanOrEqual(3);
    expect(liq.largestMarketLiquidityUsd).toBeGreaterThan(4_000_000);
    expect(liq.concentrationPct).toBeGreaterThan(50);
  });

  it('computes exact base and quote reserve valuations in USD without negative precision bugs', () => {
    const liq = liquidityEngine.calculateMarketLiquidity(100, 15000, 150.0, 1.0);
    expect(liq).toBe(30000.0);

    const zero = liquidityEngine.calculateMarketLiquidity(-5, 100, 10, 1);
    expect(zero).toBe(0);
  });
});
