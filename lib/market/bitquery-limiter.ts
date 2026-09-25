import 'server-only';

// One account-level gate for chart, launch, activity, and holder fallbacks.
// The default is below Bitquery's published 30 req/min Personal ceiling;
// deployments with another entitlement may tune it server-side.
const DEFAULT_GAP_MS = 2_500;
const MAX_QUEUED = 60;
const PRIORITY = { chart: 0, launch: 1, activity: 2, ownership: 3 } as const;
export type BitqueryPriority = keyof typeof PRIORITY;

type Waiter = { priority: BitqueryPriority; queuedAt: number; release: () => void; reject: (reason: Error) => void };
type State = { waiters: Waiter[]; lastAt: number; draining: boolean };
const globalState = globalThis as typeof globalThis & { __sentinelBitqueryLimiter?: State };
const state = globalState.__sentinelBitqueryLimiter ??= { waiters: [], lastAt: 0, draining: false };

function gapMs(): number {
  if (process.env.NODE_ENV === 'test') return 0;
  const configured = Number(process.env.BITQUERY_REQUEST_GAP_MS);
  return Number.isFinite(configured) && configured >= 1_000 && configured <= 60_000
    ? configured : DEFAULT_GAP_MS;
}

async function drain(): Promise<void> {
  if (state.draining) return;
  state.draining = true;
  try {
    while (state.waiters.length) {
      const delay = Math.max(0, state.lastAt + gapMs() - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      state.waiters.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || a.queuedAt - b.queuedAt);
      const waiter = state.waiters.shift();
      if (!waiter) break;
      state.lastAt = Date.now();
      waiter.release();
    }
  } finally { state.draining = false; }
}

export function acquireBitquerySlot(priority: BitqueryPriority, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Bitquery request cancelled.')); return; }
    if (state.waiters.length >= MAX_QUEUED) { reject(new Error('Bitquery request queue is full.')); return; }
    const onAbort = () => {
      const index = state.waiters.indexOf(waiter);
      if (index >= 0) state.waiters.splice(index, 1);
      reject(new Error('Bitquery request cancelled.'));
    };
    const waiter: Waiter = { priority, queuedAt: Date.now(),
      release: () => { signal?.removeEventListener('abort', onAbort); resolve(); },
      reject: (reason) => { signal?.removeEventListener('abort', onAbort); reject(reason); } };
    signal?.addEventListener('abort', onAbort, { once: true });
    state.waiters.push(waiter);
    void drain();
  });
}

export function bitqueryLimiterStats() {
  return { queued: state.waiters.length, gapMs: gapMs(), msSinceLastRequest: state.lastAt ? Date.now() - state.lastAt : null };
}

export function resetBitqueryLimiterForTests(): void {
  for (const waiter of state.waiters.splice(0)) waiter.reject(new Error('Bitquery test reset.'));
  state.lastAt = 0;
  state.draining = false;
}
