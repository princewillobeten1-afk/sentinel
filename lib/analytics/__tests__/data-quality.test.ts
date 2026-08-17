import { describe, it, expect } from 'vitest';
import { DataQualityEngine } from '../data-quality';

describe('Data Quality Engine & Multi-Source Validation (Sprint 38 §52-54)', () => {
  it('flags a discrepancy incident when provider quotes diverge materially (> 2.5%)', () => {
    const now = Date.now();
    const report = DataQualityEngine.auditProviders({
      quotes: [
        {
          providerName: 'Helius Geyser WS',
          priceUsd: 100.0,
          poolLiquidityUsd: 1_000_000,
          timestampMs: now - 50,
        },
        {
          providerName: 'Birdeye Stream',
          priceUsd: 105.0, // 5% divergence
          poolLiquidityUsd: 1_000_000,
          timestampMs: now - 100,
        },
      ],
      indexerLagMs: 250,
    });

    expect(report.overallHealthStatus).toBe('DISCREPANCY_DETECTED');
    expect(report.eventDiscrepanciesCount).toBe(1);
    expect(report.dataConfidenceLevel).toBe('MEDIUM');
    expect(report.activeDiscrepancies[0].deltaPct).toBe(5.0);
  });

  it('marks data health as healthy when providers agree within tolerance', () => {
    const now = Date.now();
    const report = DataQualityEngine.auditProviders({
      quotes: [
        {
          providerName: 'ProviderA',
          priceUsd: 100.0,
          poolLiquidityUsd: 1_000_000,
          timestampMs: now - 50,
        },
        {
          providerName: 'ProviderB',
          priceUsd: 100.5, // 0.5% divergence
          poolLiquidityUsd: 1_000_000,
          timestampMs: now - 60,
        },
      ],
      indexerLagMs: 200,
    });

    expect(report.overallHealthStatus).toBe('HEALTHY');
    expect(report.eventDiscrepanciesCount).toBe(0);
    expect(report.dataConfidenceLevel).toBe('HIGH');
  });
});
