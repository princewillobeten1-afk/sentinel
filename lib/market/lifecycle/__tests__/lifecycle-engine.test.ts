import { describe, it, expect, beforeEach } from 'vitest';
import {
  closestToMigrating,
  __resetLifecycle,
  applyCurveReading,
  finalStretch,
  getLifecycle,
  markMigrating,
  migrated,
  newPairs,
  onLifecycleChange,
  recordMigration,
  recordPairCreated,
  evictStale,
} from '../lifecycle-engine';
import { decodeBondingCurve, INITIAL_REAL_TOKEN_RESERVES, bondingCurveAddress } from '../bonding-curve';
import { canTransition, stateFromCurve, type BondingCurveState } from '../types';

const MINT = 'EqMPoikNhiTpgR2Wmig396z8UgevLYVsXstwMHGzpump';
const OTHER = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

/** A curve reading at a given completion fraction. */
const curveAt = (progress: number, complete = false, readAt = Date.now()): BondingCurveState => ({
  virtualTokenReserves: 1_000n,
  virtualSolReserves: 30_000_000_000n,
  realTokenReserves:
    INITIAL_REAL_TOKEN_RESERVES - BigInt(Math.floor(progress * Number(INITIAL_REAL_TOKEN_RESERVES))),
  realSolReserves: 0n,
  tokenTotalSupply: 1_000_000_000_000_000n,
  complete,
  progress,
  baselineRealTokenReserves: INITIAL_REAL_TOKEN_RESERVES,
  readAt,
});

/** Builds a curve account buffer for the decoder. */
function curveBuffer(
  realTokenReserves: bigint,
  complete: boolean,
  options: { baseline?: bigint; realSolReserves?: bigint } = {},
): Buffer {
  // A coherent constant-product account, so the invariant derivation sees a
  // real curve rather than placeholder numbers. Standard pump.fun seed:
  // 30 virtual SOL against 1.073B virtual tokens, 793.1M of them real.
  const baseline = options.baseline ?? INITIAL_REAL_TOKEN_RESERVES;
  const initialVirtualSol = 30_000_000_000n;
  const initialVirtualToken = 1_073_000_000_000_000n - (INITIAL_REAL_TOKEN_RESERVES - baseline);

  const sold = realTokenReserves >= baseline ? 0n : baseline - realTokenReserves;
  const virtualTokenReserves = initialVirtualToken > sold ? initialVirtualToken - sold : 1n;
  // k is preserved, so virtual SOL rises exactly as tokens leave the curve.
  const k = initialVirtualSol * initialVirtualToken;
  const virtualSolReserves = k / virtualTokenReserves;
  const realSolReserves = options.realSolReserves ?? virtualSolReserves - initialVirtualSol;

  const buf = Buffer.alloc(64);
  buf.writeBigUInt64LE(virtualTokenReserves, 8);
  buf.writeBigUInt64LE(virtualSolReserves, 16);
  buf.writeBigUInt64LE(realTokenReserves, 24);
  buf.writeBigUInt64LE(realSolReserves, 32);
  buf.writeBigUInt64LE(1_000_000_000_000_000n, 40);
  buf.writeUInt8(complete ? 1 : 0, 48);
  return buf;
}

beforeEach(() => __resetLifecycle());

describe('decodeBondingCurve — progress comes from reserves', () => {
  it('reads a fresh curve as near zero', () => {
    // Matches a mainnet reading: 792,749,207,379,238 of 793,100,000,000,000.
    const curve = decodeBondingCurve(curveBuffer(792_749_207_379_238n, false));
    expect(curve).not.toBeNull();
    expect(curve!.progress).toBeCloseTo(0.00044, 5);
    expect(curve!.complete).toBe(false);
  });

  it('reads a half-sold curve as 50%', () => {
    const half = INITIAL_REAL_TOKEN_RESERVES / 2n;
    expect(decodeBondingCurve(curveBuffer(half, false))!.progress).toBeCloseTo(0.5, 6);
  });

  it('carries the program complete flag', () => {
    expect(decodeBondingCurve(curveBuffer(0n, true))!.complete).toBe(true);
  });

  it('clamps rather than reporting negative progress on a bad decode', () => {
    const curve = decodeBondingCurve(curveBuffer(INITIAL_REAL_TOKEN_RESERVES * 2n, false));
    expect(curve!.progress).toBe(0);
  });

  it('returns null for a short account instead of a zeroed struct', () => {
    // A zeroed struct would read as a real curve sitting at 0%.
    expect(decodeBondingCurve(Buffer.alloc(20))).toBeNull();
  });
});

describe('bondingCurveAddress', () => {
  it('derives the documented PDA', () => {
    // Verified against mainnet for this mint.
    expect(bondingCurveAddress(MINT)).toBe('8SsS1a2dhpHs4r4rc5Gy8jLmHnJXB4rfY8ju12rYYDmc');
  });
});

describe('stateFromCurve', () => {
  it('holds a barely-started curve in NEW_PAIR', () => {
    expect(stateFromCurve(curveAt(0.01), 0.8)).toBe('NEW_PAIR');
  });

  it('promotes past the configured threshold', () => {
    expect(stateFromCurve(curveAt(0.85), 0.8)).toBe('FINAL_STRETCH');
    // The threshold is configurable, so the same curve reads differently.
    expect(stateFromCurve(curveAt(0.85), 0.9)).toBe('NEW_PAIR');
  });

  it('treats the program complete flag as authoritative over progress', () => {
    // A complete curve just short of the arithmetic threshold is still done.
    expect(stateFromCurve(curveAt(0.79, true), 0.8)).toBe('MIGRATING');
  });

  it('never reports MIGRATED from a curve alone', () => {
    // Migration is a separate on-chain action, not 100% completion.
    expect(stateFromCurve(curveAt(1, true), 0.8)).toBe('MIGRATING');
  });
});

describe('canTransition — forward only', () => {
  it('allows advancing', () => {
    expect(canTransition('NEW_PAIR', 'FINAL_STRETCH')).toBe(true);
    expect(canTransition('MIGRATING', 'MIGRATED')).toBe(true);
  });

  it('refuses going backwards or standing still', () => {
    expect(canTransition('MIGRATED', 'FINAL_STRETCH')).toBe(false);
    expect(canTransition('FINAL_STRETCH', 'FINAL_STRETCH')).toBe(false);
  });
});

describe('lifecycle engine', () => {
  it('holds one canonical state, so a token cannot be in two columns', () => {
    recordPairCreated(MINT, 'pump.fun');
    applyCurveReading(MINT, curveAt(0.9));
    expect(finalStretch().map((r) => r.mint)).toEqual([MINT]);
    expect(newPairs()).toHaveLength(0);

    recordMigration(MINT, {
      signature: 'sig1',
      migratedAt: Date.now(),
      dex: 'PumpSwap',
      poolAddress: 'pool1',
    });
    expect(migrated().map((r) => r.mint)).toEqual([MINT]);
    expect(finalStretch()).toHaveLength(0);
  });

  it('ignores a stale curve read that arrives after migration', () => {
    // Curve reads and migration events come from different transports; letting
    // a late read win is exactly how a token appears as both.
    recordPairCreated(MINT, 'pump.fun');
    recordMigration(MINT, { signature: 's', migratedAt: 1_000, dex: 'PumpSwap', poolAddress: 'p' });
    applyCurveReading(MINT, curveAt(0.85));

    expect(getLifecycle(MINT)!.state).toBe('MIGRATED');
    expect(finalStretch()).toHaveLength(0);
  });

  it('does not reset an existing token when its pair is re-reported', () => {
    recordPairCreated(MINT, 'pump.fun');
    applyCurveReading(MINT, curveAt(0.9));
    recordPairCreated(MINT, 'pump.fun');
    expect(getLifecycle(MINT)!.state).toBe('FINAL_STRETCH');
  });

  it('records the migration signature, pool, dex and time', () => {
    recordPairCreated(MINT, 'pump.fun');
    recordMigration(MINT, {
      signature: '5xSig',
      migratedAt: 42,
      dex: 'PumpSwap',
      poolAddress: 'PoolAddr',
    });
    const record = getLifecycle(MINT)!;
    expect(record.migration).toEqual({
      signature: '5xSig',
      migratedAt: 42,
      dex: 'PumpSwap',
      poolAddress: 'PoolAddr',
    });
  });

  it('keeps the first migration record on re-confirmation', () => {
    // Reconciliation re-reporting a migration must not reshuffle the column.
    recordMigration(MINT, { signature: 'a', migratedAt: 100, dex: 'PumpSwap', poolAddress: 'p1' });
    recordMigration(MINT, { signature: 'b', migratedAt: 999, dex: 'Raydium', poolAddress: 'p2' });
    expect(getLifecycle(MINT)!.migration!.signature).toBe('a');
  });

  it('orders Final Stretch by curve completion, not recency', () => {
    recordPairCreated(MINT, 'pump.fun');
    recordPairCreated(OTHER, 'pump.fun');
    applyCurveReading(MINT, curveAt(0.82));
    applyCurveReading(OTHER, curveAt(0.95));
    expect(finalStretch().map((r) => r.mint)).toEqual([OTHER, MINT]);
  });

  it('orders Migrated newest migration first', () => {
    // Real timestamps, because the column is windowed to recent migrations —
    // the original literals (100 and 900) are epoch values from 1970 and now
    // fall outside it, which is correct behaviour rather than a broken test.
    const now = Date.now();
    recordMigration(MINT, {
      signature: 'a',
      migratedAt: now - 10 * 60 * 1000,
      dex: 'PumpSwap',
      poolAddress: 'p',
    });
    recordMigration(OTHER, {
      signature: 'b',
      migratedAt: now - 2 * 60 * 1000,
      dex: 'PumpSwap',
      poolAddress: 'q',
    });
    expect(migrated().map((r) => r.mint)).toEqual([OTHER, MINT]);
  });

  it('notifies subscribers so a column updates without a refresh', () => {
    const seen: string[] = [];
    onLifecycleChange((mint, record) => seen.push(`${mint}:${record.state}`));

    recordPairCreated(MINT, 'pump.fun');
    applyCurveReading(MINT, curveAt(0.9));
    recordMigration(MINT, { signature: 's', migratedAt: 1, dex: 'PumpSwap', poolAddress: 'p' });

    expect(seen).toEqual([
      `${MINT}:NEW_PAIR`,
      `${MINT}:FINAL_STRETCH`,
      `${MINT}:MIGRATED`,
    ]);
  });

  it('emits on progress even when the state is unchanged', () => {
    // Final Stretch is ordered by completion, so movement matters on its own.
    recordPairCreated(MINT, 'pump.fun');
    let calls = 0;
    onLifecycleChange(() => calls++);
    applyCurveReading(MINT, curveAt(0.2));
    applyCurveReading(MINT, curveAt(0.3));
    expect(calls).toBe(2);
  });

  it('marks a completed curve as MIGRATING, never MIGRATED', () => {
    recordPairCreated(MINT, 'pump.fun');
    applyCurveReading(MINT, curveAt(1, true));
    expect(getLifecycle(MINT)!.state).toBe('MIGRATING');
    expect(migrated()).toHaveLength(0);
  });

  it('evicts stalled pre-migration tokens but keeps migrated ones', () => {
    recordPairCreated(MINT, 'pump.fun', 0);
    recordMigration(OTHER, { signature: 's', migratedAt: 0, dex: 'PumpSwap', poolAddress: 'p' });
    const removed = evictStale(1_000, 10_000);
    expect(removed).toBe(1);
    expect(getLifecycle(MINT)).toBeNull();
    expect(getLifecycle(OTHER)).not.toBeNull();
  });

  it('markMigrating will not pull a migrated token back', () => {
    recordMigration(MINT, { signature: 's', migratedAt: 5, dex: 'PumpSwap', poolAddress: 'p' });
    markMigrating(MINT, 9);
    expect(getLifecycle(MINT)!.state).toBe('MIGRATED');
  });
});

describe('curve progress is reversible — regression', () => {
  beforeEach(() => __resetLifecycle());

  it('moves a token back out of Final Stretch when the curve sells down', () => {
    // Measured live: Final Stretch held tokens at 84.9%, 31.0% and 0.04%
    // against an 80% threshold. Forward-only transitions pinned a token there
    // permanently once it had touched the line, so the column advertised
    // tokens that were nowhere near migrating.
    applyCurveReading(MINT, curveAt(0.85));
    expect(getLifecycle(MINT)?.state).toBe('FINAL_STRETCH');

    applyCurveReading(MINT, curveAt(0.31));
    expect(getLifecycle(MINT)?.state).toBe('NEW_PAIR');
    expect(finalStretch()).toHaveLength(0);
  });

  it('still refuses to walk a migrated token back to the curve', () => {
    // The one-way door that matters: a stale curve read must never undo a
    // confirmed migration, or the token appears in two columns.
    recordMigration(MINT, {
      signature: 'sig',
      migratedAt: Date.now(),
      dex: 'PumpSwap',
      poolAddress: 'PooL1111111111111111111111111111111111111111',
    });
    applyCurveReading(MINT, curveAt(0.42));

    expect(getLifecycle(MINT)?.state).toBe('MIGRATED');
    expect(newPairs()).toHaveLength(0);
    expect(finalStretch()).toHaveLength(0);
  });

  it('allows both curve-derived directions but no backward exit from migration', () => {
    expect(canTransition('FINAL_STRETCH', 'NEW_PAIR')).toBe(true);
    expect(canTransition('NEW_PAIR', 'FINAL_STRETCH')).toBe(true);
    expect(canTransition('MIGRATING', 'FINAL_STRETCH')).toBe(false);
    expect(canTransition('MIGRATED', 'NEW_PAIR')).toBe(false);
  });
});

describe('column semantics — underway, and recently migrated', () => {
  beforeEach(() => __resetLifecycle());

  it('keeps barely-started launches out of Final Stretch', () => {
    // 42 of 51 tracked tokens sat below 5% on the live feed. Ordering with no
    // floor filled the column with launches that had not moved, under a
    // heading saying they were about to migrate.
    applyCurveReading(MINT, curveAt(0.02));
    applyCurveReading(OTHER, curveAt(0.35));

    const rows = closestToMigrating(0.1);
    expect(rows.map((r) => r.mint)).toEqual([OTHER]);
  });

  it('orders Final Stretch by real completion, nearest first', () => {
    const a = 'AaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA';
    const b = 'BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB';
    applyCurveReading(a, curveAt(0.42));
    applyCurveReading(b, curveAt(0.88));

    expect(closestToMigrating(0.1).map((r) => r.mint)).toEqual([b, a]);
  });

  it('drops migrations older than the window', () => {
    const now = Date.now();
    const recent = 'RecentMigration1111111111111111111111111111';
    const old = 'OldMigration22222222222222222222222222222222';

    recordMigration(recent, {
      signature: 'sig-recent',
      migratedAt: now - 60_000,
      dex: 'PumpSwap',
      poolAddress: 'PooL111111111111111111111111111111111111111',
    });
    recordMigration(old, {
      signature: 'sig-old',
      migratedAt: now - 5 * 60 * 60 * 1000,
      dex: 'PumpSwap',
      poolAddress: 'PooL222222222222222222222222222222222222222',
    });

    // "What just migrated" — a token that graduated five hours ago is not it.
    const rows = migrated(2 * 60 * 60 * 1000, now);
    expect(rows.map((r) => r.mint)).toEqual([recent]);
  });

  it('windows on migration time, not on when it was noticed', () => {
    const now = Date.now();
    const late = 'LateObservation111111111111111111111111111';

    // Observed now, but the migration itself happened long ago.
    recordMigration(late, {
      signature: 'sig-late',
      migratedAt: now - 4 * 60 * 60 * 1000,
      dex: 'PumpSwap',
      poolAddress: 'PooL333333333333333333333333333333333333333',
    });

    expect(migrated(60 * 60 * 1000, now)).toHaveLength(0);
  });

  it('evicts migrated records well past the window so the map stays bounded', () => {
    const now = Date.now();
    recordMigration('Ancient1111111111111111111111111111111111', {
      signature: 'sig-ancient',
      migratedAt: now - 30 * 60 * 60 * 1000,
      dex: 'PumpSwap',
      poolAddress: 'PooL444444444444444444444444444444444444444',
    });

    // Migrated was exempt from eviction entirely, so the map grew for the life
    // of the process at one entry per migration.
    expect(evictStale(6 * 60 * 60 * 1000, now)).toBeGreaterThan(0);
  });
});

describe('progress uses an observed baseline, not one hardcoded seed', () => {
  beforeEach(() => __resetLifecycle());

  /** Curves seeded below the standard allocation, sampled from mainnet. */
  const NON_STANDARD_SEED = 751_574_386_747_195n;

  it('does not report sales for tokens that were never on the curve', () => {
    // The bug, exactly as measured: a curve *seeded* at 751,574,386,747,195
    // having raised almost nothing. Against the hardcoded 793.1M that reads as
    // 5.2% of the supply sold, which no buying at this price explains — the
    // shortfall is the curve's own seeding.
    const record = applyCurveReading(
      MINT,
      decodeBondingCurve(curveBuffer(NON_STANDARD_SEED, false, { baseline: NON_STANDARD_SEED }))!,
    );

    expect(record.curve!.progress).toBeCloseTo(0, 4);
    // Derived from the account's own invariant, so integer division leaves it
    // a few parts in 10^12 off the exact seed.
    expect(Number(record.curve!.baselineRealTokenReserves)).toBeCloseTo(
      Number(NON_STANDARD_SEED),
      -8,
    );
  });

  it('recomputes an inflated reading once a higher baseline is observed', () => {
    // A mint first seen mid-curve gets the constant as its baseline. When a
    // later read shows more tokens than that, the earlier percentage was wrong
    // and must be corrected, not merely clamped going forward.
    const higher = INITIAL_REAL_TOKEN_RESERVES + 1_000_000_000_000n;

    applyCurveReading(MINT, decodeBondingCurve(curveBuffer(INITIAL_REAL_TOKEN_RESERVES / 2n, false))!);
    const first = getLifecycle(MINT)!.curve!.progress;
    expect(first).toBeCloseTo(0.5, 3);

    applyCurveReading(MINT, decodeBondingCurve(curveBuffer(higher, false))!);
    const after = getLifecycle(MINT)!;

    expect(after.curve!.baselineRealTokenReserves).toBe(higher);
    expect(after.curve!.progress).toBe(0);
  });

  it('holds the baseline steady as the curve sells down', () => {
    // Each reading derives the baseline from its own invariant, so a selling
    // curve keeps reporting the same denominator and progress climbs — without
    // carrying a stale value forward from the first sighting.
    applyCurveReading(MINT, decodeBondingCurve(curveBuffer(INITIAL_REAL_TOKEN_RESERVES, false))!);
    applyCurveReading(MINT, decodeBondingCurve(curveBuffer(INITIAL_REAL_TOKEN_RESERVES / 4n, false))!);

    const record = getLifecycle(MINT)!;
    expect(Number(record.curve!.baselineRealTokenReserves)).toBeCloseTo(
      Number(INITIAL_REAL_TOKEN_RESERVES),
      -8,
    );
    expect(record.curve!.progress).toBeCloseTo(0.75, 3);
  });

  it('reads a drained, completed curve as 100% rather than dividing to nonsense', () => {
    // Both reserves are zeroed at migration — verified across twelve graduated
    // mints. This is the case that ruled out `realSol / graduationThreshold`,
    // which would report 0% at the moment of graduation.
    const curve = decodeBondingCurve(curveBuffer(0n, true))!;
    expect(curve.progress).toBe(1);
    expect(curve.complete).toBe(true);
  });

  it('reproduces the standard seed for an ordinary curve', () => {
    // The common case is unchanged: most curves really are seeded at 793.1M,
    // verified against untouched mainnet accounts, and the derivation lands on
    // that figure without being told it. Checked across 24 live curves, the
    // derived and constant baselines agree to within a percentage point.
    const curve = decodeBondingCurve(curveBuffer(INITIAL_REAL_TOKEN_RESERVES / 2n, false))!;
    expect(Number(curve.baselineRealTokenReserves)).toBeCloseTo(
      Number(INITIAL_REAL_TOKEN_RESERVES),
      -8,
    );
    expect(curve.progress).toBeCloseTo(0.5, 3);
  });
});

describe('Final Stretch inclusion cannot be violated by sort', () => {
  beforeEach(() => __resetLifecycle());

  it('excludes everything below the floor regardless of ordering', () => {
    // The reported worry: the column's sort dropdown letting low-progress
    // tokens in. Inclusion happens here, in the engine; the column only
    // reorders what it is handed, so no sort option can widen the set.
    const mints = ['A', 'B', 'C', 'D'];
    const progress = [0.12, 0.45, 0.82, 0.95];
    mints.forEach((m, i) => applyCurveReading(m, curveAt(progress[i])));

    const rows = closestToMigrating(0.8);
    expect(rows.map((r) => r.mint)).toEqual(['D', 'C']);
    expect(rows.every((r) => (r.curve?.progress ?? 0) >= 0.8)).toBe(true);
  });

  it('defaults to the configured near-completion threshold without padding', () => {
    applyCurveReading('A', curveAt(0.74));
    applyCurveReading('B', curveAt(0.85));
    applyCurveReading('C', curveAt(0.92));

    const rows = closestToMigrating();
    expect(rows.map((r) => r.mint)).toEqual(['C', 'B']);
  });

  it('ignores out-of-order curve readings and expires an unrefreshed curve', () => {
    const now = Date.now();
    applyCurveReading(MINT, curveAt(0.84, false, now));
    applyCurveReading(MINT, curveAt(0.21, false, now - 1_000));
    expect(getLifecycle(MINT)?.curve?.progress).toBe(0.84);
    expect(finalStretch(now)).toHaveLength(1);
    expect(finalStretch(now + 121_000)).toHaveLength(0);
  });

  it('safely handles dumped curves with tiny virtualSol without generating fake progress', () => {
    // A rugged coin with 0.05 SOL virtual reserves and 694.8M tokens remaining (~12.38% real progress)
    const buf = Buffer.alloc(49);
    buf.writeBigUInt64LE(974784331429913n, 8); // virtualToken
    buf.writeBigUInt64LE(53320555n, 16);        // virtualSol: 0.053 SOL
    buf.writeBigUInt64LE(694884331429913n, 24); // realToken: 694.8M tokens remaining
    buf.writeBigUInt64LE(28247698n, 32);        // realSol: 0.028 SOL
    buf.writeBigUInt64LE(1000000000000000n, 40); // 1B total supply
    buf.writeUInt8(0, 48);                      // complete = false

    const curve = decodeBondingCurve(buf)!;
    // Must not generate fake 61% progress — should be ~12.38% against 793.1M
    expect(curve.progress).toBeCloseTo(0.1238, 3);
    expect(curve.progress).toBeLessThan(0.75);
  });
});
