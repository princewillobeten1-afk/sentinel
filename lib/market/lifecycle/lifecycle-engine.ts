import {
  type BondingCurveState,
  type LifecycleState,
  type MigrationRecord,
  type TokenLifecycle,
  canTransition,
  finalStretchThreshold,
  stateFromCurve,
} from './types';
import { curveProgress } from './bonding-curve';
import { isSolanaMint } from '@/lib/market/chart-model';

/**
 * The single owner of every token's lifecycle state.
 *
 * ## Why one engine
 *
 * The Discover columns previously derived their contents independently, each
 * filtering an API response its own way. The same mint could satisfy two
 * filters at once — measured at 17 of 18 tokens appearing in both New and
 * Bonding — because nothing held a canonical answer to "what stage is this
 * token in". This does.
 *
 * ## What drives a transition
 *
 * Only observed facts:
 *
 *  - a **curve reading** from the bonding-curve account (`bonding-curve.ts`)
 *  - a **migration event** carrying a signature and destination pool
 *
 * Never market cap, price, age, a timer, or a random assignment. A curve
 * reaching 100% moves a token to MIGRATING, not MIGRATED: the migration is a
 * separate on-chain action, and reporting it before it happens would put tokens
 * in the Migrated column that never moved.
 *
 * ## Forward only
 *
 * `canTransition` refuses regressions. Curve reads and migration events arrive
 * from different transports at different latencies, so a stale read routinely
 * lands after a migration — allowing it to win is precisely how a token ends up
 * listed as both bonding and migrated.
 */

type Listener = (mint: string, record: TokenLifecycle) => void;

/**
 * How far back the RPC migration catch-up scans after a restart.
 *
 * Display retention is count-based (the last 20 proved migrations), not this
 * duration. Override with `LIFECYCLE_MIGRATED_WINDOW_MIN` (minutes).
 */
export const MIGRATED_WINDOW_MS = (() => {
  const raw = Number(process.env.LIFECYCLE_MIGRATED_WINDOW_MIN);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 120;
  return minutes * 60 * 1000;
})();

/** A stalled RPC feed must not keep advertising an old curve as active. */
export const CURVE_FRESHNESS_MS = Number(process.env.LIFECYCLE_CURVE_FRESHNESS_MS ?? 120_000);
export const FINAL_STRETCH_LIMIT = 20;
export const MIGRATED_LIMIT = 20;

/**
 * State lives on `globalThis`.
 *
 * Without this the engine is a per-module singleton, and Next builds more than
 * one graph — the worker populates its copy while an API route imports a second,
 * empty one. Observed exactly that: `stats()` reported 2 in Final Stretch and 1
 * migrating while the route's own `finalStretch()` returned an empty array, from
 * the same process.
 *
 * The same guard is on `eventBus`, `dbPool` and `wsBroadcaster` for the same
 * reason. It also survives dev HMR, so a hot reload does not silently reset
 * every token to unknown.
 */
const globalForLifecycle = globalThis as unknown as {
  sentinelLifecycleRecords?: Map<string, TokenLifecycle>;
  sentinelLifecycleListeners?: Set<Listener>;
  sentinelFinalStretchQueue?: Map<string, number>;
};

const records: Map<string, TokenLifecycle> =
  globalForLifecycle.sentinelLifecycleRecords ?? new Map<string, TokenLifecycle>();
const listeners: Set<Listener> = globalForLifecycle.sentinelLifecycleListeners ?? new Set<Listener>();
const finalStretchQueue: Map<string, number> = globalForLifecycle.sentinelFinalStretchQueue ?? new Map<string, number>();

globalForLifecycle.sentinelLifecycleRecords = records;
globalForLifecycle.sentinelLifecycleListeners = listeners;
globalForLifecycle.sentinelFinalStretchQueue = finalStretchQueue;

// A hot-reloaded server may already hold verified records from an older module
// graph. Adopt them once; a process restart uses the Redis checkpoint below.
if (finalStretchQueue.size === 0 && records.size > 0) {
  const existing = [...records.values()].filter((record) => record.state === 'FINAL_STRETCH'
    && record.curve && !record.curve.complete).sort((a, b) => a.stateChangedAt - b.stateChangedAt);
  for (const record of existing.slice(-FINAL_STRETCH_LIMIT))
    finalStretchQueue.set(record.mint, record.stateChangedAt);
}

function trimFinalStretchQueue(): void {
  while (finalStretchQueue.size > FINAL_STRETCH_LIMIT) {
    const oldest = [...finalStretchQueue].sort((a, b) => a[1] - b[1])[0];
    if (!oldest) break;
    finalStretchQueue.delete(oldest[0]);
  }
}

function maxBigInt(...values: bigint[]): bigint {
  return values.reduce((largest, value) => (value > largest ? value : largest), 0n);
}

function emit(mint: string, record: TokenLifecycle): void {
  for (const listener of listeners) {
    try {
      listener(mint, record);
    } catch {
      // A bad subscriber must not stop the others from being told.
    }
  }
}

/** Subscribe to state changes. Returns an unsubscribe function. */
export function onLifecycleChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLifecycle(mint: string): TokenLifecycle | null {
  return records.get(mint) ?? null;
}

export function getAllByState(state: LifecycleState): TokenLifecycle[] {
  return [...records.values()].filter((record) => record.state === state);
}

export function lifecycleSize(): number {
  return records.size;
}

import { resolveLaunchpad } from './launchpads';

/**
 * Registers a newly detected pair.
 *
 * Idempotent: re-observing a pair does not reset its state, so a reconciliation
 * pass that re-reports an existing token cannot walk it back to NEW_PAIR.
 */
export function recordPairCreated(
  mint: string,
  launchpad: TokenLifecycle['launchpad'] = 'pump.fun',
  firstSeenAt = Date.now(),
): TokenLifecycle {
  const existing = records.get(mint);
  if (existing) return existing;

  const launchpadInfo = resolveLaunchpad(launchpad);
  const record: TokenLifecycle = {
    mint,
    state: 'NEW_PAIR',
    launchpad,
    launchpadInfo,
    curve: null,
    migration: null,
    firstSeenAt,
    stateChangedAt: firstSeenAt,
    source: 'pair-created',
  };
  records.set(mint, record);
  emit(mint, record);
  return record;
}

/**
 * Applies a curve reading.
 *
 * The reading is always stored — it is the freshest truth about the curve even
 * when it implies no state change — but the *state* only moves forward.
 */
export function applyCurveReading(
  mint: string,
  curve: BondingCurveState,
  launchpad: TokenLifecycle['launchpad'] = 'pump.fun',
  threshold = finalStretchThreshold(),
): TokenLifecycle {
  const existing = records.get(mint) ?? recordPairCreated(mint, launchpad, curve.readAt);
  if (existing.state === 'MIGRATED' || (existing.curve && curve.readAt < existing.curve.readAt)) {
    return existing;
  }

  /**
   * The mint's initial token allocation.
   *
   * Taken from **this** reading, which derives it from the account's own
   * constant-product invariant (see `deriveBaselineRealTokenReserves`), raised
   * only if the account currently holds more tokens than that.
   *
   * Deliberately *not* carried forward from earlier readings. Doing that —
   * `max(derived, previousBaseline)` — meant a token first seen when the
   * derivation was unavailable kept the fallback constant as its denominator
   * for good, and no later reading could correct it. Measured: three of thirty
   * live curves still reported multiple percent sold on under 0.04 SOL raised,
   * because the constant kept winning the max. Max is the wrong operator when
   * the true baseline is *lower* than the assumption.
   */
  const baseline = maxBigInt(curve.baselineRealTokenReserves, curve.realTokenReserves);

  const corrected: BondingCurveState =
    baseline === curve.baselineRealTokenReserves
      ? curve
      : {
          ...curve,
          baselineRealTokenReserves: baseline,
          progress: curveProgress(curve.realTokenReserves, curve.complete, baseline),
        };

  const implied = stateFromCurve(corrected, threshold);

  const nextState = canTransition(existing.state, implied) ? implied : existing.state;
  const changed = nextState !== existing.state;

  const launchpadInfo = existing.launchpadInfo ?? resolveLaunchpad(launchpad || existing.launchpad);
  const record: TokenLifecycle = {
    ...existing,
    launchpad: launchpad || existing.launchpad,
    launchpadInfo,
    curve: corrected,
    state: nextState,
    stateChangedAt: changed ? corrected.readAt : existing.stateChangedAt,
    source: changed ? 'curve-read' : existing.source,
  };

  records.set(mint, record);
  if (nextState === 'FINAL_STRETCH' && changed) {
    // Different mints can share one batched RPC timestamp. Preserve arrival
    // order so the newest entrant goes on top even within the same millisecond.
    finalStretchQueue.set(mint, Math.max(corrected.readAt,
      Math.max(0, ...finalStretchQueue.values()) + 1));
    trimFinalStretchQueue();
  } else if (nextState !== 'FINAL_STRETCH') {
    finalStretchQueue.delete(mint);
  }
  // A progress change is emitted even when membership stays the same.
  emit(mint, record);
  return record;
}

/**
 * Confirms a migration.
 *
 * Terminal, and it always wins: a migration event is a settled on-chain fact,
 * so it overrides whatever the curve last said. Re-confirming an already
 * migrated token keeps the original record rather than restamping its time,
 * which would reshuffle "newest migration first" on every reconciliation.
 */
export function recordMigration(
  mint: string,
  migration: MigrationRecord,
  launchpad: TokenLifecycle['launchpad'] = 'pump.fun',
): TokenLifecycle {
  const existing = records.get(mint) ?? recordPairCreated(mint, launchpad, migration.migratedAt);

  if (existing.state === 'MIGRATED' && existing.migration) return existing;

  const resolvedLaunchpad = migration.originLaunchpad || launchpad || existing.launchpad;
  const launchpadInfo = existing.launchpadInfo ?? resolveLaunchpad(resolvedLaunchpad);

  const record: TokenLifecycle = {
    ...existing,
    launchpad: resolvedLaunchpad,
    launchpadInfo,
    state: 'MIGRATED',
    migration: {
      ...migration,
      ...(migration.originLaunchpad ? { originLaunchpad: migration.originLaunchpad } : {}),
      ...(migration.lpHandling ? { lpHandling: migration.lpHandling } : {}),
    },
    stateChangedAt: migration.migratedAt,
    source: 'migration-event',
  };
  records.set(mint, record);
  finalStretchQueue.delete(mint);
  emit(mint, record);
  return record;
}

/**
 * Marks a token as migrating when the curve has completed but no destination
 * pool is confirmed yet.
 *
 * Kept separate from `recordMigration` so a completed curve is never reported
 * as a finished migration.
 */
export function markMigrating(mint: string, at = Date.now()): TokenLifecycle | null {
  const existing = records.get(mint);
  if (!existing || !canTransition(existing.state, 'MIGRATING')) return existing ?? null;

  const record: TokenLifecycle = {
    ...existing,
    state: 'MIGRATING',
    stateChangedAt: at,
    source: 'curve-read',
  };
  records.set(mint, record);
  finalStretchQueue.delete(mint);
  emit(mint, record);
  return record;
}

/** New pairs, newest first. */
export function newPairs(): TokenLifecycle[] {
  return getAllByState('NEW_PAIR').sort((a, b) => b.firstSeenAt - a.firstSeenAt);
}

/**
 * Last 20 verified Final Stretch entries, newest entry first. A delayed RPC
 * read makes the card stale; it does not silently remove it from the column.
 */
export function finalStretch(now = Date.now()): TokenLifecycle[] {
  return [...finalStretchQueue]
    .sort((a, b) => b[1] - a[1])
    .map(([mint]) => records.get(mint))
    .filter((record): record is TokenLifecycle => Boolean(record && record.state === 'FINAL_STRETCH'
      && record.curve && !record.curve.complete && record.curve.readAt <= now))
    .slice(0, FINAL_STRETCH_LIMIT);
}

/**
 * Fresh, incomplete curves at or above the configured threshold, nearest first.
 *
 * Curve progress must meet or exceed minProgress (default 80%). Brand-new tokens
 * with low progress remain in New Pairs.
 */
export function closestToMigrating(minProgress = finalStretchThreshold(), now = Date.now()): TokenLifecycle[] {
  return [...records.values()]
    .filter(
      (record) =>
        (record.state === 'NEW_PAIR' || record.state === 'FINAL_STRETCH') &&
        record.curve !== null && !record.curve.complete &&
        Number.isFinite(record.curve.progress) && record.curve.progress >= minProgress &&
        record.curve.progress < 1 &&
        now >= record.curve.readAt && now - record.curve.readAt <= CURVE_FRESHNESS_MS,
    )
    .sort((a, b) => (b.curve?.progress ?? 0) - (a.curve?.progress ?? 0));
}

/** Tokens whose curve completed but whose destination is unconfirmed. */
export function migrating(): TokenLifecycle[] {
  return getAllByState('MIGRATING').sort((a, b) => b.stateChangedAt - a.stateChangedAt);
}

/**
 * Last 20 confirmed migrations, newest first. A caller may explicitly request
 * a narrower time window, but Discover keeps rows until newer proof replaces them.
 */
export function migrated(withinMs = Number.POSITIVE_INFINITY, now = Date.now()): TokenLifecycle[] {
  return getAllByState('MIGRATED').filter((record) => {
    const proof = record.migration;
    return proof !== null && Boolean(proof.signature && proof.poolAddress && proof.dex) &&
      Number.isFinite(proof.migratedAt) && proof.migratedAt > 0 &&
      now >= proof.migratedAt && now - proof.migratedAt <= withinMs;
  }).sort(
    (a, b) =>
      (b.migration?.migratedAt ?? b.stateChangedAt) - (a.migration?.migratedAt ?? a.stateChangedAt),
  ).slice(0, MIGRATED_LIMIT);
}

/**
 * Drops tokens that have sat in a pre-migration state without progressing.
 *
 * Most launches never migrate; without eviction the map grows without bound.
 * Displayed migration history is bounded by count. Older records remain as
 * short-lived deduplication tombstones so a recent Jupiter pair cannot reappear
 * under New Pairs immediately after leaving the visible 20.
 */
export function evictStale(maxAgeMs = 6 * 60 * 60 * 1000, now = Date.now()): number {
  let removed = 0;
  const retainedMigrations = new Set(migrated(Number.POSITIVE_INFINITY, now).map((record) => record.mint));

  for (const [mint, record] of records) {
    if (record.state === 'MIGRATED') {
      const migratedAt = record.migration?.migratedAt ?? record.stateChangedAt;
      if (!retainedMigrations.has(mint) && now - migratedAt > maxAgeMs) {
        records.delete(mint);
        removed += 1;
      }
      continue;
    }
    if (finalStretchQueue.has(mint)) continue;
    if (now - record.stateChangedAt > maxAgeMs) {
      records.delete(mint);
      removed += 1;
    }
  }
  return removed;
}

/** A bounded Redis checkpoint, never a substitute for an on-chain observation. */
export function serializeRollingLifecycle(): string {
  const entries = [
    ...finalStretch().map((record) => ({ record, enteredAt: finalStretchQueue.get(record.mint) })),
    ...migrated().map((record) => ({ record })),
  ];
  return JSON.stringify({ version: 1, entries }, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
}

/** Restores only validated curve reads and confirmed migration proofs after restart. */
export function restoreRollingLifecycle(raw: string): number {
  let parsed: { version?: number; entries?: Array<{ record?: Partial<TokenLifecycle>; enteredAt?: number }> };
  try { parsed = JSON.parse(raw); } catch { return 0; }
  if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) return 0;
  let restored = 0;
  const integer = (value: unknown): bigint | null => typeof value === 'string' && /^\d+$/.test(value)
    ? BigInt(value) : null;
  for (const entry of parsed.entries.slice(0, FINAL_STRETCH_LIMIT + MIGRATED_LIMIT)) {
    const saved = entry?.record;
    if (!saved || typeof saved.mint !== 'string' || !isSolanaMint(saved.mint)
      || !Number.isFinite(saved.firstSeenAt) || !Number.isFinite(saved.stateChangedAt)) continue;
    const existing = records.get(saved.mint);
    if (existing?.state === 'MIGRATED' || (existing && existing.stateChangedAt >= saved.stateChangedAt!)) continue;
    const launchpad = resolveLaunchpad(saved.launchpad).id;
    if (saved.state === 'FINAL_STRETCH') {
      const c = saved.curve as BondingCurveState | null | undefined;
      if (!c || c.complete || !Number.isFinite(c.readAt) || !Number.isFinite(c.progress)
        || c.progress < finalStretchThreshold() || c.progress >= 1
        || !Number.isFinite(entry.enteredAt)) continue;
      const reserves = [c.virtualTokenReserves, c.virtualSolReserves, c.realTokenReserves,
        c.realSolReserves, c.tokenTotalSupply, c.baselineRealTokenReserves].map(integer);
      if (reserves.some((reserve) => reserve === null)) continue;
      records.set(saved.mint, {
        mint: saved.mint, state: 'FINAL_STRETCH', launchpad, launchpadInfo: resolveLaunchpad(launchpad),
        curve: { ...c, virtualTokenReserves: reserves[0]!, virtualSolReserves: reserves[1]!,
          realTokenReserves: reserves[2]!, realSolReserves: reserves[3]!,
          tokenTotalSupply: reserves[4]!, baselineRealTokenReserves: reserves[5]! },
        migration: null, firstSeenAt: saved.firstSeenAt!, stateChangedAt: saved.stateChangedAt!,
        source: 'reconciliation',
      });
      finalStretchQueue.set(saved.mint, entry.enteredAt!);
      restored += 1;
    } else if (saved.state === 'MIGRATED') {
      const proof = saved.migration;
      if (!proof || !proof.signature || !isSolanaMint(proof.poolAddress)
        || !proof.dex || !Number.isFinite(proof.migratedAt) || proof.migratedAt <= 0) continue;
      records.set(saved.mint, {
        mint: saved.mint, state: 'MIGRATED', launchpad, launchpadInfo: resolveLaunchpad(launchpad),
        curve: null, migration: proof, firstSeenAt: saved.firstSeenAt!,
        stateChangedAt: proof.migratedAt, source: 'reconciliation',
      });
      restored += 1;
    }
  }
  trimFinalStretchQueue();
  return restored;
}

/** Test seam. */
export function __resetLifecycle(): void {
  records.clear();
  finalStretchQueue.clear();
  listeners.clear();
}
