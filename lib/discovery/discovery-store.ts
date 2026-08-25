'use client';

import { fetchOnce } from '@/lib/api/fetch-once';
import type { DiscoveryToken, DiscoverySection } from './types';

/**
 * One timer and one socket for the whole discovery feed.
 *
 * ## What this replaces
 *
 * `useRealtimeTokenFeed` held a **per-instance** `setInterval`, `socketRef` and
 * `/api/v1/events` catch-up, and Discover mounts it once per column. Measured
 * over 32 seconds on the five-column layout:
 *
 *     61 feed requests   (7.7 per 4s cycle)
 *     25 WebSocket opens
 *     discovery/new fetched 24x against 8x for every other section
 *
 * Five columns each polling independently is also why columns could show data
 * from different moments — there was no single instant the page agreed on.
 *
 * ## Deliberate behaviours
 *
 * **A failed section keeps its rows and says so.** It flips to `stale` with the
 * last-good timestamp rather than blanking or silently serving old data as
 * current. A frozen feed that looks live is the failure this codebase keeps
 * having to remove.
 *
 * **The round-trip time is measured, not asserted.** The footer and the column
 * headers both read it from here, so "live" means a request actually completed.
 */

export const DISCOVERY_SECTIONS: DiscoverySection[] = [
  'new',
  'migrating',
  'graduated',
  'trending',
  'hot',
];

export type SectionState = 'live' | 'stale' | 'loading';

export interface SectionSnapshot {
  state: SectionState;
  tokens: DiscoveryToken[];
  /** When these rows were last successfully fetched. 0 means never. */
  at: number;
  error?: string;
}

export interface DiscoverySnapshot {
  sections: Record<string, SectionSnapshot>;
  /** Round-trip of the last cycle, in ms. Null before the first completes. */
  rttMs: number | null;
  /** When the last cycle finished, successful or not. */
  at: number;
  /** True once a cycle has completed, so "empty" can be told from "not yet". */
  hasLoaded: boolean;
}

const POLL_INTERVAL_MS = 4_000;

function emptySnapshot(): DiscoverySnapshot {
  return {
    sections: Object.fromEntries(
      DISCOVERY_SECTIONS.map((s) => [s, { state: 'loading' as SectionState, tokens: [], at: 0 }]),
    ),
    rttMs: null,
    at: 0,
    hasLoaded: false,
  };
}

let snapshot: DiscoverySnapshot = emptySnapshot();
let timer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
const listeners = new Set<() => void>();

/** Query shape the columns share. Changing it restarts the cycle. */
let chain = 'solana';
let timeWindow = '15m';
/** Off by default: a token with no pool cannot be traded. */
let includeZeroLiquidity = false;

interface FeedResponse {
  data?: { tokens?: DiscoveryToken[] };
  tokens?: DiscoveryToken[];
}

function tokensFrom(body: FeedResponse): DiscoveryToken[] {
  const rows = body?.data?.tokens ?? body?.tokens;
  return Array.isArray(rows) ? rows : [];
}

async function tick(): Promise<void> {
  // Skipped while hidden: a background tab polling every four seconds is pure
  // cost, and the first tick on focus refreshes everything anyway.
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const results = await Promise.allSettled(
    DISCOVERY_SECTIONS.map((section) =>
      fetchOnce<FeedResponse>(
        `/api/v1/discovery/${section}?chain=${chain}&timeWindow=${timeWindow}&limit=50` +
          (includeZeroLiquidity ? '&includeZeroLiquidity=true' : ''),
        { credentials: 'include' },
      ),
    ),
  );

  const rttMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
  const now = Date.now();

  const sections: Record<string, SectionSnapshot> = {};
  DISCOVERY_SECTIONS.forEach((section, index) => {
    const result = results[index];
    const previous = snapshot.sections[section];

    if (result.status === 'fulfilled') {
      sections[section] = { state: 'live', tokens: tokensFrom(result.value), at: now };
      return;
    }

    // Keep the previous rows so a blip does not empty the column, but mark them
    // stale and carry the reason. Never silently.
    sections[section] = {
      state: 'stale',
      tokens: previous?.tokens ?? [],
      at: previous?.at ?? 0,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });

  snapshot = { sections, rttMs, at: now, hasLoaded: true };
  listeners.forEach((notify) => notify());
}

function start(): void {
  if (timer) return;
  void tick();
  timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
}

function stop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/**
 * Subscribes to the shared feed. The timer runs only while something is
 * listening, so leaving Discover stops the polling.
 */
export function subscribeToDiscovery(listener: () => void): () => void {
  listeners.add(listener);
  subscribers += 1;
  if (subscribers === 1) start();

  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (subscribers === 0) stop();
  };
}

export function getDiscoverySnapshot(): DiscoverySnapshot {
  return snapshot;
}

export function getSection(section: DiscoverySection): SectionSnapshot {
  return snapshot.sections[section] ?? { state: 'loading', tokens: [], at: 0 };
}

/**
 * Changes the shared query. Resets to loading rather than showing the previous
 * chain's rows under the new label.
 */
export function setDiscoveryQuery(next: {
  chain?: string;
  timeWindow?: string;
  includeZeroLiquidity?: boolean;
}): void {
  const changed =
    (next.chain !== undefined && next.chain !== chain) ||
    (next.timeWindow !== undefined && next.timeWindow !== timeWindow) ||
    (next.includeZeroLiquidity !== undefined && next.includeZeroLiquidity !== includeZeroLiquidity);
  if (!changed) return;

  chain = next.chain ?? chain;
  timeWindow = next.timeWindow ?? timeWindow;
  includeZeroLiquidity = next.includeZeroLiquidity ?? includeZeroLiquidity;
  snapshot = emptySnapshot();
  listeners.forEach((notify) => notify());
  if (timer) void tick();
}

/** Forces a cycle now, for a manual refresh control. */
export function refreshDiscovery(): void {
  void tick();
}

/** Test seam. */
export function __resetDiscoveryStore(): void {
  stop();
  snapshot = emptySnapshot();
  listeners.clear();
  subscribers = 0;
  chain = 'solana';
  timeWindow = '15m';
  includeZeroLiquidity = false;
}

/** Current zero-liquidity setting, for the toggle's checked state. */
export function getIncludeZeroLiquidity(): boolean {
  return includeZeroLiquidity;
}
