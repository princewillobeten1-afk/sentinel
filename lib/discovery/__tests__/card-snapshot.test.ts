import { describe, expect, it } from 'vitest';
import type { DiscoveryToken } from '../types';
import { mergeTokenCardSnapshot } from '../card-snapshot';

describe('REST/card snapshot reconciliation', () => {
  it('cannot regress confirmed migration with an older curve replay', () => {
    const token = { lifecycleState: 'migrated', migratedAt: 123,
      lifecycleEvidence: { observedAt: '2026-09-21T10:00:00Z' } } as DiscoveryToken;
    const merged = mergeTokenCardSnapshot(token, { mint: 'mint', sequence: 99, source: 'cache', freshness: 'fresh',
      observedAt: '2026-09-21T10:01:00Z',
      changedFields: { lifecycleState: 'final_stretch', bondingCurveProgress: 90 } });
    expect(merged.lifecycleState).toBe('migrated');
    expect(merged.bondingCurveProgress).toBeUndefined();
  });

  it('uses per-field observation time for lifecycle progress too', () => {
    const token = { bondingCurveProgress: 82,
      lifecycleEvidence: { observedAt: '2026-09-21T10:00:00Z' } } as DiscoveryToken;
    const merged = mergeTokenCardSnapshot(token, { mint: 'mint', sequence: 99, source: 'cache', freshness: 'fresh',
      observedAt: '2026-09-21T10:01:00Z', fieldObservedAt: { bondingCurveProgress: '2026-09-21T09:59:00Z' },
      changedFields: { bondingCurveProgress: 21.9 } });
    expect(merged.bondingCurveProgress).toBe(82);
  });
  it('does not replace newer REST market values with an old cached price', () => {
    const token = { priceUsd: '2', marketEvidence: { observedAt: '2026-09-12T10:00:00Z' } } as DiscoveryToken;
    const merged = mergeTokenCardSnapshot(token, { mint: 'mint', sequence: 1, source: 'cache', freshness: 'fresh',
      observedAt: '2026-09-12T10:01:00Z', fieldObservedAt: { priceUsd: '2026-09-12T09:00:00Z' },
      changedFields: { priceUsd: '1', sniperPercentage: 0 } });
    expect(merged.priceUsd).toBe('2');
    expect(merged.sniperPercentage).toBe(0);
  });

  it('does not replace a newer five-minute REST window with an older stream snapshot', () => {
    const token = { volume5mUsd: '20', buysCount5m: 4, activityEvidence: { status: 'measured', source: 'rest', observedAt: '2026-09-12T10:00:00Z' } } as DiscoveryToken;
    const merged = mergeTokenCardSnapshot(token, { mint: 'mint', sequence: 1, source: 'cache', freshness: 'fresh', observedAt: '2026-09-12T09:00:00Z',
      changedFields: { volume5mUsd: '5', buysCount5m: 1, activityEvidence: { status: 'measured', source: 'ws', observedAt: '2026-09-12T09:00:00Z' } } });
    expect(merged.volume5mUsd).toBe('20');
    expect(merged.buysCount5m).toBe(4);
  });

  it('lets DexScreener fill only absent fields even when its patch arrived after primary REST', () => {
    const token = { volume1hUsd: '900', buysCount1h: undefined,
      marketEvidence: { status: 'measured', source: 'birdeye-token-stats', observedAt: '2026-09-25T10:00:00Z' } } as DiscoveryToken;
    const merged = mergeTokenCardSnapshot(token, { mint: 'mint', sequence: 2, source: 'dexscreener-batch-rest', freshness: 'fresh',
      observedAt: '2026-09-25T10:01:00Z',
      fieldSources: { volume1hUsd: 'dexscreener-batch-rest', buysCount1h: 'dexscreener-batch-rest' },
      changedFields: { volume1hUsd: '100', buysCount1h: 4 } });
    expect(merged.volume1hUsd).toBe('900');
    expect(merged.buysCount1h).toBe(4);
  });

  it('keeps Birdeye primary and upgrades fallback fields when Birdeye recovers', () => {
    const patch = { mint: 'mint', sequence: 3, source: 'dexscreener-batch-rest', freshness: 'fresh' as const,
      observedAt: '2026-09-25T10:01:00Z', fieldSources: { txCount5m: 'dexscreener-batch-rest' },
      changedFields: { txCount5m: 4 } };
    const primary = { txCount5m: 9, activityEvidence: { status: 'measured', source: 'birdeye-token-stats', observedAt: '2026-09-25T10:00:00Z' } } as DiscoveryToken;
    expect(mergeTokenCardSnapshot(primary, patch).txCount5m).toBe(9);
    const fallback = { ...primary, activityEvidence: { ...primary.activityEvidence!, source: 'dexscreener-batch-rest' } };
    const upgraded = { ...patch, source: 'birdeye-token-stats', fieldSources: { txCount5m: 'birdeye-token-stats' } };
    expect(mergeTokenCardSnapshot(fallback, upgraded).txCount5m).toBe(4);
  });
});
