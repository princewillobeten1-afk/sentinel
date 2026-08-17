import { describe, it, expect } from 'vitest';
import { ExitabilitySimulator } from '../exitability-simulator';

describe('Position-Specific Exitability & Impact Simulator (Sprint 38 §27-31)', () => {
  it('simulates progressive price impact and degrading exitability score across trade sizes', () => {
    const sim = ExitabilitySimulator.simulateExitability({
      tokenAddress: 'TokenLiquidityPoolX',
      poolLiquidityUsd: 100_000,
    });

    expect(sim.simulatedTradeSizesUsd.length).toBe(6);

    const smallTier = sim.simulatedTradeSizesUsd.find((t) => t.tradeSizeUsd === 100);
    const largeTier = sim.simulatedTradeSizesUsd.find((t) => t.tradeSizeUsd === 10000);
    const whaleTier = sim.simulatedTradeSizesUsd.find((t) => t.tradeSizeUsd === 50000);

    expect(smallTier).toBeDefined();
    expect(largeTier).toBeDefined();
    expect(whaleTier).toBeDefined();

    // Small position should have low impact and high score
    expect(smallTier!.estimatedPriceImpactPct).toBeLessThan(1.0);
    expect(smallTier!.exitabilityScore).toBeGreaterThanOrEqual(90);
    expect(smallTier!.isSafeExit).toBe(true);

    // Large position should have high impact and low score
    expect(largeTier!.estimatedPriceImpactPct).toBeGreaterThan(10.0);
    expect(largeTier!.exitabilityScore).toBeLessThan(smallTier!.exitabilityScore);

    // Whale position should be flagged as unsafe
    expect(whaleTier!.isSafeExit).toBe(false);
  });
});
