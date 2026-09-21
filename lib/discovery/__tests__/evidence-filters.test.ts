import { describe, expect, it } from 'vitest';
import { filterDiscoveryTokens } from '../service';
import type { DiscoveryToken } from '../types';

const token = (overrides: Partial<DiscoveryToken>): DiscoveryToken => ({
  mint: 'mint', marketCapUsd: '100', liquidityUsd: '100', volume24hUsd: '100', ageMinutes: 1,
  ...overrides,
} as DiscoveryToken);

describe('evidence-aware discovery filters', () => {
  it('does not let stale or failed evidence pass a safety threshold', () => {
    for (const status of ['stale', 'loading', 'unavailable'] as const) {
      const old = token({ top10HoldingsPct: 0, ownershipEvidence: { status, source: 'birdeye', observedAt: new Date().toISOString() } });
      expect(filterDiscoveryTokens([old], { top10HoldingsMax: 10 })).toHaveLength(0);
    }
  });
  it.each([null, NaN, Infinity])('excludes non-measured ownership %j', (value) => {
    const unknown = token({ sniperPercentage: value as number });
    expect(filterDiscoveryTokens([unknown], { snipersMax: 10 })).toHaveLength(0);
  });
  it('excludes an incomplete rug score from a minimum safety filter', () => {
    const partial = token({ riskScore: 100, rugRisk: { score: 0, level: 'low', completeness: 'partial', factors: [], version: 'ownership-v2' } });
    expect(filterDiscoveryTokens([partial], { minRiskScore: 50 })).toHaveLength(0);
  });
  it('does not silently pass unknown ownership through a maximum-risk filter', () => {
    const unknown = token({ mint: 'unknown', top10HoldingsPct: undefined });
    const measured = token({ mint: 'measured', top10HoldingsPct: 20 });
    expect(filterDiscoveryTokens([unknown, measured], { top10HoldingsMax: 30 }).map((token) => token.mint)).toEqual(['measured']);
  });

  it('preserves a measured zero as a filterable value', () => {
    const zero = token({ mint: 'zero', sniperPercentage: 0 });
    expect(filterDiscoveryTokens([zero], { snipersMax: 0 })).toHaveLength(1);
  });
});
