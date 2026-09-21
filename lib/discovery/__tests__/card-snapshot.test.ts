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
});
