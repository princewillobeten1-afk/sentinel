'use client';

import { fetchOnce } from '@/lib/api/fetch-once';
import {
  computeReconnectDelayMs,
  initialReconnectState,
  reconnectReducer,
  type ReconnectState,
} from '@/lib/hooks/discovery-ws-reconnect';
import { encodeClientMessage, subscribeMessage } from '@/lib/ws/client-messages';
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

/**
 * The socket this file's header always claimed to have.
 *
 * It did not: this was a 4-second poll and nothing anywhere subscribed to the
 * `feed.discovery:*` topics the server has been publishing all along.
 *
 * It is a **refresh trigger, not a data path**. An event marks its section
 * dirty and brings the next fetch forward; the rows themselves still come from
 * the REST endpoint. That is deliberate — the server coalesces per topic with
 * last-value-wins under backpressure, which is only safe because each payload
 * is self-contained. Treating these frames as authoritative row data would
 * silently drop updates the moment a client fell behind.
 *
 * The poll stays as the reconciliation floor, so a dropped frame or a refused
 * subscription costs freshness rather than correctness.
 */
let socket: WebSocket | null = null;
let socketWelcomed = false;
let reconnectState: ReconnectState = initialReconnectState();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
/** Coalesces a burst of events into one early fetch. */
let nudgeTimer: ReturnType<typeof setTimeout> | null = null;

/** Shortest gap between an event arriving and the fetch it triggers. */
const NUDGE_DEBOUNCE_MS = 400;

const DISCOVERY_TOPICS = DISCOVERY_SECTIONS.map((section) => `feed.discovery:${section}`);

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

/**
 * Brings the next fetch forward after a live event.
 *
 * Debounced because launches arrive in bursts — ten `TOKEN_CREATED` events in
 * a second must cost one fetch, not ten. Without this the socket would be
 * strictly worse than the timer it is meant to improve on.
 */
function nudge(): void {
  if (nudgeTimer) return;
  nudgeTimer = setTimeout(() => {
    nudgeTimer = null;
    void tick();
  }, NUDGE_DEBOUNCE_MS);
}

function wsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function connectSocket(): void {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
  if (socket || reconnectState.status === 'given_up') return;

  reconnectState = reconnectReducer(reconnectState, { type: 'CONNECT_REQUESTED' });

  let next: WebSocket;
  try {
    next = new WebSocket(wsUrl());
  } catch {
    scheduleReconnect();
    return;
  }
  socket = next;
  socketWelcomed = false;

  next.onopen = () => {
    reconnectState = reconnectReducer(reconnectState, { type: 'OPENED' });
    // No subscribe here. The server attaches its message listener as it sends
    // `welcome`, so anything written before that is discarded silently — the
    // same trap `use-sentinel-ws` was falling into.
  };

  next.onmessage = (event) => {
    let payload: { type?: string; topic?: string };
    try {
      payload = JSON.parse(String(event.data));
    } catch {
      return;
    }

    if (payload.type === 'welcome') {
      socketWelcomed = true;
      try {
        next.send(encodeClientMessage(subscribeMessage(DISCOVERY_TOPICS)));
      } catch {
        // The reconnect path covers it.
      }
      return;
    }

    // Any event on a discovery topic means that section changed. Which section
    // is not read: the fetch refreshes all three anyway, and acting on the
    // topic name would make a dropped frame look like a section with no news.
    if (payload.type === 'event' && payload.topic?.startsWith('feed.discovery:')) {
      nudge();
    }
  };

  next.onerror = () => {
    // Surfaced through onclose, which always follows.
  };

  next.onclose = () => {
    socket = null;
    socketWelcomed = false;
    reconnectState = reconnectReducer(reconnectState, { type: 'CLOSED' });
    if (reconnectState.status === 'reconnecting') scheduleReconnect();
    // `given_up` is not fatal: the 4s poll is still running, so the feed
    // degrades to its previous behaviour rather than going dark.
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectSocket, computeReconnectDelayMs(reconnectState.attempt));
}

function disconnectSocket(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (nudgeTimer) clearTimeout(nudgeTimer);
  nudgeTimer = null;

  const open = socket;
  socket = null;
  socketWelcomed = false;
  reconnectState = initialReconnectState();

  if (open) {
    // Null the handlers first so this close cannot schedule a reconnect.
    open.onopen = null;
    open.onmessage = null;
    open.onerror = null;
    open.onclose = null;
    try {
      open.close();
    } catch {
      // Already gone.
    }
  }
}

function start(): void {
  if (timer) return;
  void tick();
  timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  connectSocket();
}

function stop(): void {
  if (timer) clearInterval(timer);
  timer = null;
  disconnectSocket();
}

/** Whether the live socket is currently subscribed. For status display. */
export function isDiscoverySocketLive(): boolean {
  return socket !== null && socketWelcomed;
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
  const known = snapshot.sections[section];
  if (known) return known;

  // A section this store never polls must not sit at `loading`, which reads as
  // "any moment now" and never resolves. Say what is actually true.
  return {
    state: 'stale',
    tokens: [],
    at: 0,
    error: `No live feed for "${section}" — the store polls ${DISCOVERY_SECTIONS.join(', ')}.`,
  };
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
