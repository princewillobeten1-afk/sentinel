import 'server-only';

/**
 * One rate limiter for every Birdeye REST call in the process.
 *
 * ## The failure this fixes
 *
 * Two independent consumers were pacing themselves against the same key with
 * no knowledge of each other:
 *
 *  - `BirdeyeEnrichmentWorker`, at 250ms, enqueued from
 *    `events/processor.ts` on every `TOKEN_CREATED` / `POOL_CREATED` event —
 *    so its rate rose with launch activity and had no ceiling.
 *  - the ownership audit worker, at 2000ms, paced from a measurement taken
 *    while the server was stopped.
 *
 * Measured with both running: a single direct call returned 429. The audit
 * resolved **0 of 20 rows in two minutes**, having looked correct in isolation.
 * A per-worker delay cannot bound a per-account limit — only a shared gate can.
 *
 * ## Priorities
 *
 * Audit lookups are what a reader is waiting on: an unaudited row shows a
 * pending pip until one lands. Market enrichment is a background top-up whose
 * values are also available from Jupiter. So audit work is served first, and
 * background work fills the gaps.
 *
 * Starvation is bounded: background callers are promoted once they have waited
 * `MAX_BACKGROUND_WAIT_MS`, so a busy feed cannot silence enrichment entirely.
 */

/**
 * Minimum gap between any two Birdeye REST calls.
 *
 * Measured on this key with the server stopped: 25 consecutive requests at
 * 2000ms produced zero 429s (21 successes/minute). This is deliberately a
 * little slower, because that measurement had one caller and production has
 * several.
 */
export const BIRDEYE_MIN_INTERVAL_MS = 2_400;

/** After this long in the queue, a background call is treated as urgent. */
const MAX_BACKGROUND_WAIT_MS = 60_000;

export type BirdeyePriority = 'audit' | 'chart' | 'background';

interface Waiter {
  priority: BirdeyePriority;
  queuedAt: number;
  release: () => void;
}

const globalForLimiter = globalThis as unknown as {
  sentinelBirdeyeWaiters?: Waiter[];
  sentinelBirdeyeLastCall?: { at: number };
  sentinelBirdeyeDraining?: { value: boolean };
};

const waiters: Waiter[] = (globalForLimiter.sentinelBirdeyeWaiters ??= []);
const lastCall = (globalForLimiter.sentinelBirdeyeLastCall ??= { at: 0 });
const draining = (globalForLimiter.sentinelBirdeyeDraining ??= { value: false });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function nextWaiter(): Waiter | undefined {
  if (waiters.length === 0) return undefined;
  const now = Date.now();

  // A background caller that has waited too long counts as urgent, so a busy
  // audit queue cannot starve enrichment indefinitely.
  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < waiters.length; i += 1) {
    const waiter = waiters[i];
    const waited = now - waiter.queuedAt;
    const urgent = waiter.priority !== 'background' || waited >= MAX_BACKGROUND_WAIT_MS;
    // Rank by urgency first, then by how long it has waited (FIFO within a tier).
    const score = (urgent ? 1e12 : 0) + waited;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return waiters.splice(bestIndex, 1)[0];
}

async function drain(): Promise<void> {
  if (draining.value) return;
  draining.value = true;
  try {
    while (waiters.length > 0) {
      const elapsed = Date.now() - lastCall.at;
      if (elapsed < BIRDEYE_MIN_INTERVAL_MS) {
        await sleep(BIRDEYE_MIN_INTERVAL_MS - elapsed);
      }
      const waiter = nextWaiter();
      if (!waiter) break;
      lastCall.at = Date.now();
      waiter.release();
    }
  } finally {
    draining.value = false;
  }
}

/**
 * Waits until it is this caller's turn to make a Birdeye request.
 *
 * An aborted caller is removed from the queue and rejected; it must not make
 * a provider request after cancellation.
 */
export function acquireBirdeyeSlot(priority: BirdeyePriority = 'background', signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Provider queue request aborted')); return; }
    const onAbort = () => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
      reject(new Error('Provider queue request aborted'));
    };
    const waiter: Waiter = { priority, queuedAt: Date.now(), release: () => { signal?.removeEventListener('abort', onAbort); resolve(); } };
    signal?.addEventListener('abort', onAbort, { once: true });
    waiters.push(waiter);
    void drain();
  });
}

export function birdeyeLimiterStats() {
  return {
    queued: waiters.length,
    audit: waiters.filter((w) => w.priority === 'audit').length,
    chart: waiters.filter((w) => w.priority === 'chart').length,
    background: waiters.filter((w) => w.priority === 'background').length,
    minIntervalMs: BIRDEYE_MIN_INTERVAL_MS,
    msSinceLastCall: lastCall.at === 0 ? null : Date.now() - lastCall.at,
  };
}

/** Test seam. */
export function __resetBirdeyeLimiter(): void {
  waiters.length = 0;
  lastCall.at = 0;
  draining.value = false;
}
