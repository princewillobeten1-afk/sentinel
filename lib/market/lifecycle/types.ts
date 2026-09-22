/**
 * Canonical token lifecycle.
 *
 * One state per token, held in one place, so the same mint cannot appear as
 * both bonding and migrated. Every transition is driven by an observed fact —
 * a curve account read, or a migration event on chain — never by market cap,
 * price, age, or a timer.
 *
 * ## The states
 *
 * - `NEW_PAIR`       a genuine new pair was detected; its curve has barely moved
 * - `FINAL_STRETCH`  curve completion has passed the configured threshold
 * - `MIGRATING`      the curve reports complete, or a migration was seen, but
 *                    the destination pool is not yet confirmed
 * - `MIGRATED`       migration confirmed, with the pool and signature recorded
 *
 * `MIGRATING` exists as a distinct state on purpose. A curve reaching 100% is
 * not a migration — the migration is a separate on-chain action that can lag,
 * fail, or be retried. Collapsing the two would report tokens as migrated that
 * have not moved.
 */

export type LifecycleState = 'NEW_PAIR' | 'FINAL_STRETCH' | 'MIGRATING' | 'MIGRATED';

/** Ordered, so a regression can be detected and refused. */
export const LIFECYCLE_ORDER: Record<LifecycleState, number> = {
  NEW_PAIR: 0,
  FINAL_STRETCH: 1,
  MIGRATING: 2,
  MIGRATED: 3,
};

import type { LaunchpadId, LaunchpadConfig } from './launchpads';

/** Launchpads whose tokens run a bonding curve this engine can read. */
export type Launchpad = LaunchpadId;

export interface BondingCurveState {
  /** Raw reserves, as stored on the curve account. */
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  /** The program's own flag that the curve has finished. */
  complete: boolean;
  /**
   * Fraction of the curve's token allocation sold, 0–1.
   *
   * Computed from `realTokenReserves` against the curve's initial allocation —
   * the actual state of the curve. Market cap is deliberately not used: it
   * moves with price and supply and says nothing about curve position.
   */
  progress: number;
  /**
   * The denominator `progress` was computed against.
   *
   * Carried on the reading because not every curve is seeded alike. A single
   * hardcoded initial allocation reported **5.2% of the curve sold on 0.017 SOL
   * raised** for a mint that simply started with fewer tokens than the constant
   * assumed — the shortfall was being counted as sales. Stating the basis makes
   * that kind of error visible in the data instead of only in the percentage.
   */
  baselineRealTokenReserves: bigint;
  /** When this reading was taken. */
  readAt: number;
}

export interface MigrationRecord {
  /** Transaction that performed the migration. */
  signature: string;
  /** Block time of that transaction, epoch ms. */
  migratedAt: number;
  /** Destination AMM, e.g. 'PumpSwap' or 'Raydium'. */
  dex: string;
  /** Destination pool address. */
  poolAddress: string;
  /** Launchpad origin the token migrated from. */
  originLaunchpad?: Launchpad;
  /** How LP tokens were handled (e.g. 'Burned', 'Locked', 'Locked 10Y'). */
  lpHandling?: string;
}

export interface TokenLifecycle {
  mint: string;
  state: LifecycleState;
  launchpad: Launchpad;
  /** Detailed configuration and metadata for this launchpad. */
  launchpadInfo?: LaunchpadConfig;
  /** Last curve reading, when one has been taken. */
  curve: BondingCurveState | null;
  /** Populated only in MIGRATED. */
  migration: MigrationRecord | null;
  /** When the pair was first observed. */
  firstSeenAt: number;
  /** When the state last changed — drives "newest migration first". */
  stateChangedAt: number;
  /** Where the current state came from, for diagnosis. */
  source: 'curve-read' | 'migration-event' | 'reconciliation' | 'pair-created';
}

/**
 * Threshold at which a token enters FINAL_STRETCH, as a fraction of curve
 * completion.
 *
 * Configurable because no launchpad publishes the figure competitors use, and
 * any fixed number here would be a guess presented as a standard. Override with
 * `LIFECYCLE_FINAL_STRETCH_PCT` (a percentage, 0-100).
 */
export function finalStretchThreshold(): number {
  const raw = process.env.LIFECYCLE_FINAL_STRETCH_PCT;
  const parsed = raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 100) return 0.8;
  return parsed / 100;
}

/**
 * The state a curve reading implies, ignoring migration events.
 *
 * `complete` outranks progress: the program's own flag is authoritative, and a
 * curve can report complete while the arithmetic sits a hair under the
 * threshold.
 */
export function stateFromCurve(curve: BondingCurveState, threshold = finalStretchThreshold()): LifecycleState {
  if (curve.complete) return 'MIGRATING';
  return curve.progress >= threshold ? 'FINAL_STRETCH' : 'NEW_PAIR';
}

/**
 * The two states that are a reading of the curve rather than a record of an
 * event.
 *
 * Both are recomputed from `realTokenReserves` on every sweep, and that figure
 * moves in **both** directions: selling returns tokens to the curve and pushes
 * completion back down. So the boundary between them is crossable either way.
 */
const CURVE_DERIVED: ReadonlySet<LifecycleState> = new Set<LifecycleState>([
  'NEW_PAIR',
  'FINAL_STRETCH',
]);

/**
 * Whether a transition is allowed.
 *
 * Migration is a one-way door: a stale curve read arriving after a migration
 * event must not walk a token back into FINAL_STRETCH, which is exactly how a
 * token ends up in two columns at once.
 *
 * The curve-derived pair is **not** one-way, and treating it as such was a bug.
 * Forward-only meant a token that touched the threshold once was pinned to
 * FINAL_STRETCH permanently — measured live with three tokens in that column at
 * 84.9%, 31.0% and 0.04% against an 80% threshold. Two of them had sold back
 * down the curve and were nowhere near migrating, but the column still
 * advertised them as being in the final stretch.
 */
export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  if (CURVE_DERIVED.has(from) && CURVE_DERIVED.has(to)) return from !== to;
  return LIFECYCLE_ORDER[to] > LIFECYCLE_ORDER[from];
}
