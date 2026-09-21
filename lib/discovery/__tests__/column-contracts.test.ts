import { describe, it, expect } from 'vitest';
import { mapJupiterToken, isOnBondingCurve, hasReadableCurve, type JupiterToken } from '../jupiter-feed';
import {
  closestToMigrating,
  recordPairCreated,
  applyCurveReading,
  __resetLifecycle,
} from '@/lib/market/lifecycle/lifecycle-engine';
import { INITIAL_REAL_TOKEN_RESERVES } from '@/lib/market/lifecycle/bonding-curve';
import type { BondingCurveState } from '@/lib/market/lifecycle/types';

/**
 * What each Discover column is allowed to claim.
 *
 * These pin three fixes that a live test caught, each of which was the UI
 * asserting something it had not measured.
 */

const token = (over: Partial<JupiterToken> = {}): JupiterToken => ({
  id: '7W3zhfDKKfQSJjzs8tqiN8EPyQf8YXP51pTkuGiXpump',
  name: 'Test Token',
  symbol: 'TEST',
  launchpad: 'pump.fun',
  ...over,
});

describe('a curve claim requires a curve that can be read', () => {
  it('accepts pump.fun, whose curve account this codebase reads', () => {
    expect(hasReadableCurve(token({ launchpad: 'pump.fun' }))).toBe(true);
    expect(hasReadableCurve(token({ launchpad: 'Pump.fun' }))).toBe(true);
  });

  it('rejects launchpads whose curve this codebase cannot read', () => {
    // Live `/recent` carried these alongside pump.fun. A non-empty launchpad
    // was previously enough to claim a bonding curve, so 2 of 26 New Pairs
    // rows asserted `bonding` for a Raydium-native pair with no curve at all.
    for (const launchpad of ['raydium-launchlab', 'stonkfun', 'met-dbc', 'Raydium']) {
      expect(hasReadableCurve(token({ launchpad }))).toBe(false);
    }
  });

  it('rejects a token with no launchpad at all', () => {
    expect(hasReadableCurve(token({ launchpad: undefined }))).toBe(false);
    expect(hasReadableCurve(token({ launchpad: '' }))).toBe(false);
  });

  it('leaves bondingStatus absent rather than guessing', () => {
    // Absent means "not asserted". `mapJupiterToken` must not fall back to a
    // value here — the card renders nothing for absent and a claim for a value.
    expect(mapJupiterToken(token({ launchpad: 'raydium-launchlab' })).bondingStatus).toBeUndefined();
    expect(mapJupiterToken(token({ launchpad: 'pump.fun' })).bondingStatus).toBe('bonding');
  });

  it('never calls a graduated token on-curve', () => {
    const graduated = token({ graduatedAt: new Date().toISOString() });
    expect(isOnBondingCurve(graduated)).toBe(false);
  });
});

describe('the Final Stretch floor is a real reading, not a default', () => {
  /**
   * A curve reading at a given completion fraction.
   *
   * Reserves must be coherent, not placeholders: `applyCurveReading` derives
   * progress from the account's own constant-product invariant and ignores any
   * `progress` handed to it, so a fixture that sets only that field produces
   * four identical rows and asserts nothing.
   */
  const curveAt = (progress: number): BondingCurveState => ({
    virtualTokenReserves: 1_000n,
    virtualSolReserves: 30_000_000_000n,
    realTokenReserves:
      INITIAL_REAL_TOKEN_RESERVES - BigInt(Math.floor(progress * Number(INITIAL_REAL_TOKEN_RESERVES))),
    realSolReserves: 0n,
    tokenTotalSupply: 1_000_000_000_000_000n,
    complete: false,
    progress,
    baselineRealTokenReserves: INITIAL_REAL_TOKEN_RESERVES,
    readAt: Date.now(),
  });

  it('never admits a token below the floor, whatever the ordering', () => {
    __resetLifecycle();

    const seeded: Record<string, number> = { a: 0.03, b: 0.42, c: 0.11, d: 0.97, e: 0.099 };
    for (const [mint, progress] of Object.entries(seeded)) {
      recordPairCreated(mint, 'pump.fun');
      applyCurveReading(mint, curveAt(progress));
    }

    const rows = closestToMigrating(0.1);
    const values = rows.map((r) => r.curve?.progress ?? 0);

    // The fixture must actually spread, or the assertions below are vacuous.
    expect(new Set(values).size).toBe(values.length);

    // 0.03 and 0.099 are below the floor; 0.11, 0.42, 0.97 are above it.
    expect(rows.map((r) => r.mint).sort()).toEqual(['b', 'c', 'd']);
    expect(values.every((v) => v >= 0.1)).toBe(true);

    // Inclusion is decided here, never by a sort: re-sorting the result cannot
    // admit a row the floor excluded.
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('excludes a token with no curve reading at all', () => {
    __resetLifecycle();
    recordPairCreated('nocurve', 'pump.fun');
    expect(closestToMigrating(0.1).map((r) => r.mint)).not.toContain('nocurve');
  });
});
