import { describe, it, expect, beforeEach } from 'vitest';
import { priceEngine } from '../pricing/price-engine';

describe('Canonical Price Engine & Aggregation (Sprint 45 §17-22, §89)', () => {
  beforeEach(() => {
    priceEngine.reset();
  });

  it('aggregates multi-market prices using liquidity & volume weighting without tiny pool domination', () => {
    const sentMint = 'So11111111111111111111111111111111111111112';
    const canonical = priceEngine.getCanonicalTokenPrice(sentMint);

    expect(canonical.priceUsd).toBeGreaterThan(149.0);
    expect(canonical.priceUsd).toBeLessThan(151.0);
    expect(canonical.marketCount).toBeGreaterThanOrEqual(3);
    expect(canonical.confidence).toBeGreaterThan(0.9);
    expect(canonical.calculationVersion).toContain('weighted-quality');
  });

  it('detects cross-market price divergence and flags WARNING / ANOMALOUS states', () => {
    const normal = priceEngine.evaluateDivergence([100.0, 100.5, 101.0]);
    expect(normal.status).toBe('NORMAL');

    const warning = priceEngine.evaluateDivergence([100.0, 103.5]);
    expect(warning.status).toBe('WARNING');

    const anomalous = priceEngine.evaluateDivergence([100.0, 112.0]);
    expect(anomalous.status).toBe('ANOMALOUS');
    expect(anomalous.divergencePct).toBe(12.0);
  });

  it('marks prices as STALE when exceeding staleness threshold', () => {
    const staleMarketId = 'solana:test:stale_pool';
    priceEngine.setMarketPrice({
      marketId: staleMarketId,
      priceUsd: 42.0,
      status: 'FRESH',
      source: 'ONCHAIN',
      confidence: 0.9,
      liquidityUsd: 100000,
      volume24hUsd: 50000,
      timestamp: new Date(Date.now() - 600000).toISOString(), // 10m ago
    });

    const fetched = priceEngine.getMarketPrice(staleMarketId);
    expect(fetched?.status).toBe('STALE');
  });
});
