import 'server-only';

import { logger } from '@/lib/server/logger';
import { fetchHolderProfileResult, type HolderProfile } from './holder-profile';
import { getTokenCardPatch, updateTokenCard } from '@/lib/market/live/card-cache';
import { calculateRugRisk, RUG_RISK_VERSION } from './rug-risk';
import { saveTokenCardEvidence } from '@/lib/server/db/token-card-evidence-repository';
import { redis } from '@/lib/server/redis';
import { currentEvidence } from '@/lib/discovery/audit-freshness';
import { resolveOwnershipFallback, backfillMissingProfileFields, hasOwnershipFallback } from './ownership-fallback';

/**
 * Fills the ownership audit behind the feed, off the fast path.
 *
 * ## Why a worker and not an inline fetch
 *
 * `/token/v1/holder-profile` takes one mint per request. Resolving a 50-row
 * column inline would cost 50 requests per 4-second cycle, and this key
 * sustains roughly **0.49/sec** — see `REQUEST_GAP_MS`. So rows render
 * immediately from cache and the misses are queued.
 *
 * The price and bonding fields never wait on this, which is the point: the
 * fast path stays fast and the audit fills in behind it.
 *
 * ## The three states a caller must distinguish
 *
 * - **cached profile** — measured, render the number
 * - **queued, no profile yet** — `auditPending`, render the pending pip
 * - **not queued and not cached** — unknown, render `n/a`
 *
 * A failed request caches nothing, so a token whose lookup errored is retried
 * rather than remembered as a clean 0%.
 */

const HIT_TTL_MS = 10 * 60 * 1000;
const FALLBACK_TTL_MS = 30_000;
const VISIBLE_OWNERSHIP_TTL_MS = 60_000;
const MIGRATED_OWNERSHIP_TTL_MS = 3 * 60_000;

/**
 * Gap between requests, measured against sustained load rather than a burst.
 *
 * Three measurements, each correcting the one before:
 *
 *  - 600ms  — 6/6 in isolation, but under real load (worker draining while
 *             feed sections queue) it drew 429s and lost 11 of 15 lookups.
 *  - 1100ms — 8/8 over a nine-second burst, then only 2 of 15 resolved in
 *             three minutes of actual running. A burst that fits inside one
 *             rate window says nothing about the sustained ceiling.
 *  - 2000ms — 25/25 over 70 seconds, zero 429s, **21 successes per minute**.
 *
 * The lesson is in the second line: measure long enough to cross a rate
 * window, or the number is about the window, not the limit.
 */
const REQUEST_GAP_MS = 2_000;

/** Extra wait after a 429, on top of the normal gap. */
const RATE_LIMIT_BACKOFF_MS = 5_000;
const MAX_RATE_LIMIT_BACKOFF_MS = 60_000;

const MAX_QUEUE = 300;
/** Give up on a mint after this many rate-limited attempts. */
const MAX_ATTEMPTS = 3;

/**
 * How long to stay paused after the compute-unit budget is spent.
 *
 * Quota is an account-level fact, not a per-request one: retrying sooner only
 * produces the same 400 for every mint in the queue.
 */
const QUOTA_RETRY_MS = 15 * 60 * 1000;
const AUDIT_LEASE_SECONDS = 30;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 60_000;

const globalForAudit = globalThis as unknown as {
  sentinelAuditCache?: Map<string, HolderProfile>;
  sentinelAuditQueued?: Set<string>;
  sentinelAuditCoordinator?: AuditCoordinator;
};

interface AuditCoordinator {
  pending: string[];
  targetsBySection: Map<string, string[]>;
  detailTargets: Map<string, number>;
  attempts: Map<string, number>;
  draining: boolean;
  activeMint: string | null;
  consecutiveFailures: number;
  quotaExhaustedAt: number;
  rateLimitBackoffMs: number;
  circuitOpenUntil: number;
}

const cache: Map<string, HolderProfile> = (globalForAudit.sentinelAuditCache ??= new Map());
const queued: Set<string> = (globalForAudit.sentinelAuditQueued ??= new Set());
// Next compiles each API route in its own module graph. The queue *and* its
// drain flag must be shared with the Set above; sharing only `queued` left
// mints marked pending while the route inspecting them had no work to drain.
const state: AuditCoordinator = (globalForAudit.sentinelAuditCoordinator ??= {
  pending: [], targetsBySection: new Map(), detailTargets: new Map(), attempts: new Map(),
  draining: false, activeMint: null, consecutiveFailures: 0, quotaExhaustedAt: 0,
  rateLimitBackoffMs: RATE_LIMIT_BACKOFF_MS, circuitOpenUntil: 0,
});
const pending = state.pending;
/** Mints each rendered section currently wants audited, in display order. */
const targetsBySection = state.targetsBySection;
/** Short leases renewed by open Audit tabs; don't pin abandoned detail pages. */
const detailTargets = state.detailTargets;
/** Rate-limited attempts per mint, so a requeue cannot loop forever. */
const attempts = state.attempts;

function circuitOpen(): boolean {
  return Date.now() < state.circuitOpenUntil;
}

/** A measured profile, or null when none is fresh. */
export function getAudit(mint: string): HolderProfile | null {
  const hit = cache.get(mint);
  if (!hit) return null;
  const ttl = hit.source && hit.source !== 'birdeye-holder-profile' ? FALLBACK_TTL_MS : HIT_TTL_MS;
  if (Date.now() - hit.fetchedAt > ttl) {
    cache.delete(mint);
    return null;
  }
  return hit;
}

/** Whether a lookup is in flight, so the card can show a pending state. */
export function isAuditPending(mint: string): boolean {
  return queued.has(mint);
}

/**
 * Declares the mints a section is currently rendering.
 *
 * **Replaces that section's targets rather than appending to a growing queue.**
 * Appending was why the audit never resolved for New Pairs: rows there are
 * seconds old and rotate out every few polls, so a FIFO draining at one lookup
 * per 2.4s spent its entire budget on tokens that had already left the screen.
 * Measured before this change: 0 of 22 rows populated, `auditPending: true` on
 * 17, and never once `false`.
 *
 * Targets are keyed by section so the five sections do not overwrite each
 * other, and the queue is rebuilt from their union in section order, so the
 * top of a column resolves first.
 *
 * A mint dropped because it rotated off screen is *not* a failure — it keeps
 * no attempt count and is retried immediately if it returns.
 */
export function setAuditTargets(section: string, mints: string[]): void {
  targetsBySection.set(section, mints.filter(Boolean));
  if ((quotaPaused() || circuitOpen()) && !hasOwnershipFallback()) {
    const observedAt = new Date().toISOString();
    for (const mint of mints) {
      if (getAudit(mint)) continue;
      updateTokenCard(mint, {
        auditPending: false,
        ownershipEvidence: {
          status: 'unavailable',
          source: 'birdeye-holder-profile',
          observedAt,
          reason: quotaPaused()
            ? 'Provider compute-unit quota is exhausted.'
            : 'Ownership provider circuit breaker is cooling down after repeated failures.',
        },
      }, 'birdeye-holder-profile', 'stale', observedAt);
    }
    return;
  }
  const previouslyQueued = new Set(queued);
  rebuildQueue();
  for (const mint of mints) {
    if (!getAudit(mint) && queued.has(mint) && !previouslyQueued.has(mint)) {
      updateTokenCard(mint, {
        auditPending: true,
        ownershipEvidence: {
          status: 'loading',
          source: 'birdeye-holder-profile',
          observedAt: new Date().toISOString(),
        },
      }, 'audit-coordinator');
    }
  }
  if (!state.draining) void drain();
}

/** True while the provider's compute-unit budget is known to be spent. */
export function quotaPaused(): boolean {
  return state.quotaExhaustedAt > 0 && Date.now() - state.quotaExhaustedAt < QUOTA_RETRY_MS;
}

/**
 * Rebuilds the pending queue from the current on-screen targets.
 *
 * Anything queued but no longer targeted is dropped, so the budget always
 * follows what a reader can actually see.
 */
function rebuildQueue(): void {
  const wanted: string[] = [];
  const seen = new Set<string>();
  for (const [mint, until] of detailTargets) if (until <= Date.now()) detailTargets.delete(mint);
  // The actual viewport is the hard priority. REST section fallbacks are kept
  // only for clients that cannot establish a WebSocket connection; they must
  // never spend quota ahead of cards the reader can currently see.
  const sections: Array<{ visible: boolean; mints: string[] }> = [
    { visible: true, mints: targetsBySection.get('visible') ?? [] },
    { visible: true, mints: [...detailTargets.keys()] },
    ...[...targetsBySection.entries()]
      .filter(([section]) => section !== 'visible')
      .map(([, mints]) => ({ visible: false, mints })),
  ];
  for (const { visible, mints } of sections) {
    for (const mint of mints) {
      if (seen.has(mint)) continue;
      seen.add(mint);
      if (mint === state.activeMint) continue;
      const hit = getAudit(mint);
      if (hit) {
        if (!visible) continue;
        const lifecycle = getTokenCardPatch(mint)?.changedFields.lifecycleState;
        const refreshAfter = hit.source && hit.source !== 'birdeye-holder-profile'
          ? FALLBACK_TTL_MS : lifecycle === 'migrated' ? MIGRATED_OWNERSHIP_TTL_MS : VISIBLE_OWNERSHIP_TTL_MS;
        if (Date.now() - hit.fetchedAt < refreshAfter) continue;
      }
      wanted.push(mint);
    }
  }

  pending.length = 0;
  for (const mint of wanted) {
    if (pending.length >= MAX_QUEUE) break;
    pending.push(mint);
  }

  // `queued` drives the card's pending pip, so it must match what is really
  // outstanding — otherwise a rotated-out token shows a pip forever.
  const outstanding = new Set(pending);
  for (const mint of [...queued]) {
    if (!seen.has(mint) || (mint !== state.activeMint && !outstanding.has(mint))) {
      queued.delete(mint);
      attempts.delete(mint);
    }
  }
  for (const mint of pending) queued.add(mint);
}

/**
 * Adds mints without displacing existing targets.
 *
 * For callers that are not a rendered section — a token detail view, say.
 */
export function queueAudit(mints: string[]): void {
  for (const [mint, until] of detailTargets) if (until <= Date.now()) detailTargets.delete(mint);
  if ((quotaPaused() || circuitOpen()) && !hasOwnershipFallback()) {
    for (const mint of mints.filter(Boolean)) updateTokenCard(mint, {
      auditPending: false,
      ownershipEvidence: {
        status: 'unavailable', source: 'birdeye-holder-profile', observedAt: new Date().toISOString(),
        reason: quotaPaused() ? 'Provider compute-unit quota is exhausted.' : 'Ownership provider circuit breaker is cooling down after repeated failures.',
      },
    }, 'audit-coordinator', 'stale');
    return;
  }
  for (const mint of mints) {
    if (!mint) continue;
    if (detailTargets.has(mint) || detailTargets.size < MAX_QUEUE) detailTargets.set(mint, Date.now() + 45_000);
    if (mint === state.activeMint || queued.has(mint)) continue;
    const hit = getAudit(mint);
    const ttl = hit?.source && hit.source !== 'birdeye-holder-profile' ? FALLBACK_TTL_MS
      : getTokenCardPatch(mint)?.changedFields.lifecycleState === 'migrated' ? MIGRATED_OWNERSHIP_TTL_MS : VISIBLE_OWNERSHIP_TTL_MS;
    if (hit && Date.now() - hit.fetchedAt < ttl) continue;
    if (pending.length >= MAX_QUEUE) break;
    queued.add(mint);
    pending.push(mint);
    if (!hit) updateTokenCard(mint, {
      auditPending: true,
      ownershipEvidence: { status: 'loading', source: 'birdeye-holder-profile', observedAt: new Date().toISOString() },
    }, 'audit-coordinator');
  }
  if (!state.draining) void drain();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function drain(): Promise<void> {
  if (state.draining) return;
  state.draining = true;

  try {
    while (pending.length > 0) {
      const mint = pending.shift();
      if (!mint) continue;
      state.activeMint = mint;

      // A Redis lease makes the visible-card queue one logical coordinator
      // across server instances. Without it every instance spends one paid
      // holder-profile request on the same card. When Redis is unavailable,
      // its in-process fallback preserves the existing single-instance path.
      const claimed = await redis.claim(`sentinel:audit-lease:${mint}`, AUDIT_LEASE_SECONDS);
      if (!claimed) {
        const remoteEvidence = getTokenCardPatch(mint)?.changedFields.ownershipEvidence;
        if (currentEvidence(remoteEvidence).status === 'measured') {
          queued.delete(mint);
          attempts.delete(mint);
        } else if ((detailTargets.get(mint) ?? 0) > Date.now() || [...targetsBySection.values()].some((mints) => mints.includes(mint))) {
          pending.push(mint);
        } else {
          queued.delete(mint);
        }
        await sleep(REQUEST_GAP_MS);
        continue;
      }

      const primaryResult = quotaPaused()
        ? { kind: 'quota-exhausted' as const }
        : circuitOpen()
          ? { kind: 'failed' as const }
          : await fetchHolderProfileResult(mint);
      // A 429 is not evidence that this mint lacks classifications. Retry the
      // authoritative profile before accepting a partial on-chain fallback;
      // otherwise one busy provider window pins n/a pills for minutes.
      if (primaryResult.kind === 'rate-limited') {
        const tries = (attempts.get(mint) ?? 0) + 1;
        attempts.set(mint, tries);
        if (tries < MAX_ATTEMPTS) {
          pending.push(mint);
          await sleep(Math.max(state.rateLimitBackoffMs, primaryResult.retryAfterMs ?? 0));
          state.rateLimitBackoffMs = Math.min(MAX_RATE_LIMIT_BACKOFF_MS, state.rateLimitBackoffMs * 2);
          continue;
        }
      }
      const devAddress = getTokenCardPatch(mint)?.changedFields.devAddress;
      let alternate: HolderProfile | null = null;
      if (primaryResult.kind === 'ok') {
        alternate = await backfillMissingProfileFields(primaryResult.profile, devAddress);
      } else {
        alternate = await resolveOwnershipFallback(mint, devAddress);
      }
      if (primaryResult.kind === 'quota-exhausted') state.quotaExhaustedAt = Date.now();
      if (alternate && primaryResult.kind === 'failed' && (primaryResult.status === 401 || primaryResult.status === 403)) {
        state.circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      }
      const result = alternate ? { kind: 'ok' as const, profile: alternate } : primaryResult;

      if (result.kind === 'ok') {
        cache.set(mint, result.profile);
        queued.delete(mint);
        attempts.delete(mint);
        const observedAt = new Date(result.profile.fetchedAt).toISOString();
        const ownershipSource = result.profile.source ?? 'birdeye-holder-profile';
        const security = getTokenCardPatch(mint)?.changedFields;
        const ownershipTtl = result.profile.source && result.profile.source !== 'birdeye-holder-profile'
          ? FALLBACK_TTL_MS : security?.lifecycleState === 'migrated'
            ? MIGRATED_OWNERSHIP_TTL_MS : VISIBLE_OWNERSHIP_TTL_MS;
        const completeProfile = [result.profile.top10Pct, result.profile.totalHolders,
          result.profile.snipersPct, result.profile.insidersPct, result.profile.bundlersPct,
          result.profile.devPct, result.profile.proTraders, result.profile.kols].every((value) => value !== null);
        const rugRisk = calculateRugRisk({
          top10Pct: result.profile.top10Pct,
          devPct: result.profile.devPct,
          snipersPct: result.profile.snipersPct,
          insidersPct: result.profile.insidersPct,
          bundlersPct: result.profile.bundlersPct,
          mintAuthorityRevoked: currentEvidence(security?.securityEvidence).status === 'measured' ? security?.isMintRenounced : undefined,
          freezeAuthorityRevoked: currentEvidence(security?.securityEvidence).status === 'measured' ? security?.isFreezeDisabled : undefined,
          liquidityLocked: currentEvidence(security?.liquidityEvidence).status === 'measured' ? security?.isLiquidityLocked : undefined,
        });
        updateTokenCard(mint, {
          top10HoldingsPct: result.profile.top10Pct ?? undefined,
          holdersCount: result.profile.totalHolders ?? undefined,
          sniperPercentage: result.profile.snipersPct ?? undefined,
          insiderHoldingsPct: result.profile.insidersPct ?? undefined,
          bundlerPercentage: result.profile.bundlersPct ?? undefined,
          devHoldingsPct: result.profile.devPct ?? undefined,
          proTradersCount: result.profile.proTraders ?? undefined,
          kolsCount: result.profile.kols ?? undefined,
          auditPending: false,
          auditVersion: RUG_RISK_VERSION,
          rugRisk: rugRisk ?? undefined,
          ownershipEvidence: {
            status: 'measured',
            source: ownershipSource,
            observedAt,
            expiresAt: new Date(result.profile.fetchedAt + ownershipTtl).toISOString(),
            reason: completeProfile ? undefined : 'Some ownership classifications were not supplied by this provider; missing values remain unavailable.',
          },
        }, ownershipSource, 'fresh', observedAt);
        void saveTokenCardEvidence(mint, 'ownership', {
          source: ownershipSource,
          top10HoldingsPct: result.profile.top10Pct,
          holdersCount: result.profile.totalHolders,
          sniperPercentage: result.profile.snipersPct,
          insiderHoldingsPct: result.profile.insidersPct,
          bundlerPercentage: result.profile.bundlersPct,
          devHoldingsPct: result.profile.devPct,
          proTradersCount: result.profile.proTraders,
          kolsCount: result.profile.kols,
          rugRisk,
        }, observedAt, RUG_RISK_VERSION);
        state.consecutiveFailures = 0;
        state.rateLimitBackoffMs = RATE_LIMIT_BACKOFF_MS;
      } else if (result.kind === 'rate-limited') {
        // Requeue rather than discard: the token is fine, we asked too fast.
        // Discarding here is what left rows permanently unresolved while the
        // queue raced on to the next mint at the same rate.
        const tries = (attempts.get(mint) ?? 0) + 1;
        attempts.set(mint, tries);

        if (tries < MAX_ATTEMPTS) {
          pending.push(mint);
        } else {
          queued.delete(mint);
          attempts.delete(mint);
          updateTokenCard(mint, {
            auditPending: false,
            ownershipEvidence: {
              status: 'unavailable',
              source: 'birdeye-holder-profile',
              observedAt: new Date().toISOString(),
              reason: 'Provider rate limit did not recover after three attempts.',
            },
          }, 'birdeye-holder-profile', 'stale');
        }

        await sleep(Math.max(state.rateLimitBackoffMs, result.retryAfterMs ?? 0));
        state.rateLimitBackoffMs = Math.min(MAX_RATE_LIMIT_BACKOFF_MS, state.rateLimitBackoffMs * 2);
      } else if (result.kind === 'quota-exhausted') {
        // The provider is out of compute units, so every remaining mint will
        // fail identically. Stop the pass and clear the queue rather than
        // grinding through it re-failing — and say so once, plainly, because
        // this reads as a generic 400 and is easy to mistake for a bug in the
        // request.
        const affected = [...new Set([mint, ...pending, ...queued])];
        queued.delete(mint);
        attempts.delete(mint);
        state.quotaExhaustedAt = Date.now();
        pending.length = 0;
        queued.clear();
        const observedAt = new Date().toISOString();
        for (const affectedMint of affected) {
          updateTokenCard(affectedMint, {
            auditPending: false,
            ownershipEvidence: {
              status: 'unavailable',
              source: 'birdeye-holder-profile',
              observedAt,
              reason: 'Provider compute-unit quota is exhausted.',
            },
          }, 'birdeye-holder-profile', 'stale', observedAt);
        }
        logger.warn('[audit] Birdeye compute-unit quota exhausted — ownership audit paused', {
          retryAfterMs: QUOTA_RETRY_MS,
        });
        return;
      } else {
        // A hard failure will not improve by waiting. Nothing is cached, so the
        // card shows "not measured" rather than a reassuring zero.
        queued.delete(mint);
        attempts.delete(mint);
        state.consecutiveFailures += 1;
        updateTokenCard(mint, {
          auditPending: false,
          ownershipEvidence: {
            status: 'unavailable',
            source: 'birdeye-holder-profile',
            observedAt: new Date().toISOString(),
            reason: result.status ? `Provider returned HTTP ${result.status}.` : 'Provider request failed.',
          },
        }, 'birdeye-holder-profile', 'stale');
        if (state.consecutiveFailures === 10) {
          logger.warn('[audit] holder-profile lookups failing', {
            consecutiveFailures: state.consecutiveFailures,
            status: result.status,
            queueDepth: pending.length,
          });
        }
        if (state.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
          state.circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
          const affected = [...new Set([...pending, ...queued])];
          pending.length = 0;
          queued.clear();
          const observedAt = new Date().toISOString();
          for (const affectedMint of affected) {
            updateTokenCard(affectedMint, {
              auditPending: false,
              ownershipEvidence: {
                status: 'unavailable',
                source: 'birdeye-holder-profile',
                observedAt,
                reason: 'Ownership provider circuit breaker is cooling down after repeated failures.',
              },
            }, 'birdeye-holder-profile', 'stale', observedAt);
          }
          return;
        }
      }

      await sleep(REQUEST_GAP_MS);
    }
  } finally {
    state.activeMint = null;
    state.draining = false;
  }
}

export function auditStats() {
  return {
    cached: cache.size,
    sections: targetsBySection.size,
    queued: queued.size,
    pending: pending.length,
    draining: state.draining,
    consecutiveFailures: state.consecutiveFailures,
    quotaPaused: quotaPaused(),
    circuitOpen: circuitOpen(),
    circuitRetryAfterMs: circuitOpen() ? Math.max(0, state.circuitOpenUntil - Date.now()) : 0,
    rateLimitBackoffMs: state.rateLimitBackoffMs,
    requestGapMs: REQUEST_GAP_MS,
  };
}

/** Test seam. */
export function __resetAudit(): void {
  cache.clear();
  queued.clear();
  pending.length = 0;
  state.draining = false;
  state.activeMint = null;
  state.consecutiveFailures = 0;
  state.rateLimitBackoffMs = RATE_LIMIT_BACKOFF_MS;
  attempts.clear();
  targetsBySection.clear();
  detailTargets.clear();
  state.quotaExhaustedAt = 0;
  state.circuitOpenUntil = 0;
}
