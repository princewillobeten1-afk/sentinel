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
 * How far back the Migrated column looks.
 *
 * Configurable because "recently" is a product judgement, not a chain fact.
 * Override with `LIFECYCLE_MIGRATED_WINDOW_MIN` (minutes).
 */
export const MIGRATED_WINDOW_MS = (() => {
  const raw = Number(process.env.LIFECYCLE_MIGRATED_WINDOW_MIN);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 120;
  return minutes * 60 * 1000;
})();

/** A stalled RPC feed must not keep advertising an old curve as active. */
export const CURVE_FRESHNESS_MS = 120_000;
export const FINAL_STRETCH_LIMIT = 20;

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
};

const records: Map<string, TokenLifecycle> =
  globalForLifecycle.sentinelLifecycleRecords ?? new Map<string, TokenLifecycle>();
const listeners: Set<Listener> = globalForLifecycle.sentinelLifecycleListeners ?? new Set<Listener>();

globalForLifecycle.sentinelLifecycleRecords = records;
globalForLifecycle.sentinelLifecycleListeners = listeners;

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

/**
 * Registers a newly detected pair.
 *
 * Idempotent: re-observing a pair does not reset its state, so a reconciliation
 * pass that re-reports an existing token cannot walk it back to NEW_PAIR.
 */
export function recordPairCreated(
  mint: string,
  launchpad: TokenLifecycle['launchpad'],
  firstSeenAt = Date.now(),
): TokenLifecycle {
  const existing = records.get(mint);
  if (existing) return existing;

  const record: TokenLifecycle = {
    mint,
    state: 'NEW_PAIR',
    launchpad,
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

  const record: TokenLifecycle = {
    ...existing,
    curve: corrected,
    state: nextState,
    stateChangedAt: changed ? corrected.readAt : existing.stateChangedAt,
    source: changed ? 'curve-read' : existing.source,
  };

  records.set(mint, record);
  // Emitted even without a state change: Final Stretch is ordered by curve
  // completion, so a progress move matters to the UI on its own.
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

  const record: TokenLifecycle = {
    ...existing,
    state: 'MIGRATED',
    migration,
    stateChangedAt: migration.migratedAt,
    source: 'migration-event',
  };
  records.set(mint, record);
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
  emit(mint, record);
  return record;
}

/** New pairs, newest first. */
export function newPairs(): TokenLifecycle[] {
  return getAllByState('NEW_PAIR').sort((a, b) => b.firstSeenAt - a.firstSeenAt);
}

/** Final Stretch is a rolling newest-first window of active bonding curves. */
export function finalStretch(now = Date.now()): TokenLifecycle[] {
  return [...records.values()]
    .filter(
      (record) =>
        (record.state === 'NEW_PAIR' || record.state === 'FINAL_STRETCH') &&
        record.curve !== null && !record.curve.complete &&
        Number.isFinite(record.curve.progress) && record.curve.progress >= 0 &&
        record.curve.progress < 1 &&
        now >= record.curve.readAt && now - record.curve.readAt <= CURVE_FRESHNESS_MS,
    )
    .sort((a, b) => b.firstSeenAt - a.firstSeenAt)
    .slice(0, FINAL_STRETCH_LIMIT);
}

/**
 * Legacy threshold-based selector retained for callers and diagnostics that
 * need the narrower near-migration view. Discover's Final Stretch uses the
 * rolling newest-first `finalStretch` window above.
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
 * Recently migrated tokens, newest migration first.
 *
 * Never backfills the recent window with older events to pad the column.
 */
export function migrated(withinMs = MIGRATED_WINDOW_MS, now = Date.now()): TokenLifecycle[] {
  return getAllByState('MIGRATED').filter((record) => {
    const proof = record.migration;
    return proof !== null && Boolean(proof.signature && proof.poolAddress && proof.dex) &&
      Number.isFinite(proof.migratedAt) && proof.migratedAt > 0 &&
      now >= proof.migratedAt && now - proof.migratedAt <= withinMs;
  }).sort(
    (a, b) =>
      (b.migration?.migratedAt ?? b.stateChangedAt) - (a.migration?.migratedAt ?? a.stateChangedAt),
  );
}

/**
 * Drops tokens that have sat in a pre-migration state without progressing.
 *
 * Most launches never migrate; without eviction the map grows without bound.
 * Migration history is retained for four recent windows, independently of count.
 */
export function evictStale(maxAgeMs = 6 * 60 * 60 * 1000, now = Date.now()): number {
  let removed = 0;

  for (const [mint, record] of records) {
    if (record.state === 'MIGRATED') {
      const migratedAt = record.migration?.migratedAt ?? record.stateChangedAt;
      if (now - migratedAt > MIGRATED_WINDOW_MS * 4) {
        records.delete(mint);
        removed += 1;
      }
      continue;
    }
    if (now - record.stateChangedAt > maxAgeMs) {
      records.delete(mint);
      removed += 1;
    }
  }
  return removed;
}

/** Test seam. */
export function __resetLifecycle(): void {
  records.clear();
  listeners.clear();
}
