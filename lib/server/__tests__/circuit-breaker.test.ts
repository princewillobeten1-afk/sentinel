import { beforeEach, describe, expect, it } from 'vitest';
import { recordPriceImpactSample, resetCircuitBreakerState } from '../circuit-breaker';

describe('recordPriceImpactSample', () => {
  beforeEach(() => {
    resetCircuitBreakerState();
  });

  it('does not trip on a normal price impact', () => {
    const result = recordPriceImpactSample('SOL/USDC', 1.5, 1000);
    expect(result.tripped).toBe(false);
  });

  it('does not trip on fewer than 3 extreme samples', () => {
    recordPriceImpactSample('SOL/USDC', 20, 1000);
    const result = recordPriceImpactSample('SOL/USDC', 20, 2000);
    expect(result.tripped).toBe(false);
    expect(result.recentExtremeCount).toBe(2);
  });

  it('trips on the 3rd extreme sample within the window', () => {
    recordPriceImpactSample('SOL/USDC', 20, 1000);
    recordPriceImpactSample('SOL/USDC', 20, 2000);
    const result = recordPriceImpactSample('SOL/USDC', 20, 3000);
    expect(result.tripped).toBe(true);
    expect(result.recentExtremeCount).toBe(3);
  });

  it('does not count samples outside the 60s rolling window', () => {
    recordPriceImpactSample('SOL/USDC', 20, 0);
    recordPriceImpactSample('SOL/USDC', 20, 1000);
    // Well past 60s later — the first two samples should have aged out unambiguously.
    const result = recordPriceImpactSample('SOL/USDC', 20, 120_000);
    expect(result.tripped).toBe(false);
    expect(result.recentExtremeCount).toBe(1);
  });

  it('tracks each pair independently', () => {
    recordPriceImpactSample('SOL/USDC', 20, 1000);
    recordPriceImpactSample('SOL/USDC', 20, 2000);
    recordPriceImpactSample('SOL/USDC', 20, 3000); // trips SOL/USDC

    const other = recordPriceImpactSample('BONK/USDC', 20, 3500);
    expect(other.tripped).toBe(false);
    expect(other.recentExtremeCount).toBe(1);
  });

  it('a sample at exactly the threshold does not count as extreme', () => {
    const result = recordPriceImpactSample('SOL/USDC', 12, 1000);
    expect(result.recentExtremeCount).toBe(0);
  });
});
