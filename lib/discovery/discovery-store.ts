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
  'trending',
  'top-gainers',
  'volume',
  'liquidity',
  'revived',
  'legacy',
  'similar',
  'smart-money',
  'ai-picks',
  'watchlist',
];

export type SectionState = 'live' | 'stale' | 'loading';
export type DiscoveryHealth = 'live' | 'degraded' | 'stale' | 'reconnecting' | 'unavailable';

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
  paused: boolean;
  pausedAt: number | null;
  pendingRefresh: boolean;
}

const POLL_INTERVAL_MS = 4_000;
const NEW_PAIRS_POLL_MS = 1_500;

function emptySnapshot(): DiscoverySnapshot {
  return {
    sections: Object.fromEntries(
      DISCOVERY_SECTIONS.map((s) => [s, { state: 'loading' as SectionState, tokens: [], at: 0 }]),
    ),
    rttMs: null,
    at: 0,
    hasLoaded: false,
    paused: false,
    pausedAt: null,
    pendingRefresh: false,
  };
}

let snapshot: DiscoverySnapshot = emptySnapshot();
let timer: ReturnType<typeof setInterval> | null = null;
let newPairsTimer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
const listeners = new Set<() => void>();
const sectionSubscribers = new Map<DiscoverySection, number>();
const sectionInFlight = new Set<DiscoverySection>();
const sectionRerunAfterFlight = new Set<DiscoverySection>();
const dirtySections = new Set<DiscoverySection>();
const snapshotsByQuery = new Map<string, DiscoverySnapshot>();
let queryRevision = 0;

function activeSections(): DiscoverySection[] {
  return DISCOVERY_SECTIONS.filter((section) => (sectionSubscribers.get(section) ?? 0) > 0);
}

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
let paused = false;
let pendingRefresh = false;

/** Shortest gap between an event arriving and the fetch it triggers. */
const NUDGE_DEBOUNCE_MS = 150;

const subscribedTopics = new Set<string>();

function reconcileTopics(): void {
  if (!socketWelcomed || !socket || socket.readyState !== WebSocket.OPEN) return;
  const wanted = new Set(activeSections().map((section) => `feed.discovery:${section}`));
  const add = [...wanted].filter((topic) => !subscribedTopics.has(topic));
  const remove = [...subscribedTopics].filter((topic) => !wanted.has(topic));
  if (remove.length) socket.send(encodeClientMessage({ type: 'unsubscribe', topics: remove }));
  if (add.length) socket.send(encodeClientMessage(subscribeMessage(add)));
  subscribedTopics.clear();
  for (const topic of wanted) subscribedTopics.add(topic);
}

const SECTION_ENDPOINTS: Partial<Record<DiscoverySection | 'bonding' | 'final-stretch', string>> = {
  'top-gainers': 'movers',
  'bonding': 'migrating',
  'final-stretch': 'migrating',
};

/** Query shape the columns share. Changing it restarts the cycle. */
let chain = 'solana';
let timeWindow = '15m';
/** Off by default: a token with no pool cannot be traded. */
let includeZeroLiquidity = false;

interface FeedResponse {
  data?: { tokens?: DiscoveryToken[] };
  tokens?: DiscoveryToken[];
}

function queryKey(c = chain, w = timeWindow, z = includeZeroLiquidity): string {
  return `${c}:${w}:${z}`;
}

function tokensFrom(body: FeedResponse): DiscoveryToken[] {
  const rows = body?.data?.tokens ?? body?.tokens;
  return Array.isArray(rows) ? rows : [];
}

async function tickSection(section: DiscoverySection, force = false): Promise<void> {
  if (paused) {
    pendingRefresh = true;
    snapshot = { ...snapshot, pendingRefresh: true };
    listeners.forEach((notify) => notify());
    return;
  }

  // Skipped while hidden: a background tab polling every few seconds is pure
  // cost, and the first tick on focus refreshes everything anyway.
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if ((sectionSubscribers.get(section) ?? 0) <= 0) return;

  if (sectionInFlight.has(section)) {
    if (force) sectionRerunAfterFlight.add(section);
    return;
  }

  sectionInFlight.add(section);
  const revision = queryRevision;
  const targetKey = queryKey();
  const endpoint = SECTION_ENDPOINTS[section] ?? section;

  try {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const result = await fetchOnce<FeedResponse>(
      `/api/v1/discovery/${endpoint}?chain=${chain}&timeWindow=${timeWindow}&limit=50` +
        (includeZeroLiquidity ? '&includeZeroLiquidity=true' : ''),
      { credentials: 'include' },
    );
    const rttMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
    const now = Date.now();

    if (revision !== queryRevision) return;
    if (paused) {
      pendingRefresh = true;
      snapshot = { ...snapshot, pendingRefresh: true };
      listeners.forEach((notify) => notify());
      return;
    }

    pendingRefresh = false;
    snapshot = {
      ...snapshot,
      sections: {
        ...snapshot.sections,
        [section]: { state: 'live', tokens: tokensFrom(result), at: now },
      },
      rttMs,
      at: now,
      hasLoaded: true,
      paused,
      pausedAt: snapshot.pausedAt,
      pendingRefresh,
    };
    snapshotsByQuery.set(targetKey, snapshot);
    listeners.forEach((notify) => notify());
  } catch (reason) {
    if (revision !== queryRevision) return;
    const now = Date.now();
    const previous = snapshot.sections[section];
    pendingRefresh = false;
    snapshot = {
      ...snapshot,
      sections: {
        ...snapshot.sections,
        [section]: {
          state: 'stale',
          tokens: previous?.tokens ?? [],
          at: previous?.at ?? 0,
          error: reason instanceof Error ? reason.message : String(reason),
        },
      },
      at: now,
      hasLoaded: true,
      paused,
      pausedAt: snapshot.pausedAt,
      pendingRefresh,
    };
    snapshotsByQuery.set(targetKey, snapshot);
    listeners.forEach((notify) => notify());
  } finally {
    if (revision === queryRevision) {
      sectionInFlight.delete(section);
      if (sectionRerunAfterFlight.delete(section) && timer && subscribers > 0) {
        void tickSection(section);
      }
    }
  }
}

async function tick(force = false): Promise<void> {
  if (paused) {
    pendingRefresh = true;
    snapshot = { ...snapshot, pendingRefresh: true };
    listeners.forEach((notify) => notify());
    return;
  }

  // Skipped while hidden: a background tab polling every four seconds is pure
  // cost, and the first tick on focus refreshes everything anyway.
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  const requestedSections = activeSections();
  if (requestedSections.length === 0) return;

  await Promise.allSettled(requestedSections.map((section) => tickSection(section, force)));
}

function applyPushedToken(targetSection: DiscoverySection, token: DiscoveryToken): void {
  if (paused || !token?.mint) return;
  if ((sectionSubscribers.get(targetSection) ?? 0) <= 0) return;

  const prevSection = snapshot.sections[targetSection];
  const prevTokens = prevSection?.tokens ?? [];
  const mintLower = token.mint.toLowerCase();
  const existingIdx = prevTokens.findIndex((t) => t.mint.toLowerCase() === mintLower);
  const nextTokens =
    existingIdx >= 0
      ? prevTokens.map((t, idx) => (idx === existingIdx ? { ...t, ...token } : t))
      : [token, ...prevTokens].slice(0, 50);

  const now = Date.now();
  snapshot = {
    ...snapshot,
    sections: {
      ...snapshot.sections,
      [targetSection]: {
        state: 'live',
        tokens: nextTokens,
        at: now,
      },
    },
    at: now,
    hasLoaded: true,
  };
  snapshotsByQuery.set(queryKey(), snapshot);
  listeners.forEach((notify) => notify());
}

/**
 * Brings the next fetch forward after a live event for the dirtied section(s).
 *
 * Debounced because launches arrive in bursts — ten `TOKEN_CREATED` events in
 * a second must cost one fetch, not ten. Without this the socket would be
 * strictly worse than the timer it is meant to improve on.
 */
function nudge(targetSection?: DiscoverySection): void {
  if (targetSection) dirtySections.add(targetSection);
  else activeSections().forEach((s) => dirtySections.add(s));

  if (nudgeTimer) return;
  nudgeTimer = setTimeout(() => {
    nudgeTimer = null;
    const toRefresh = dirtySections.size > 0 ? [...dirtySections] : activeSections();
    dirtySections.clear();
    void Promise.allSettled(toRefresh.map((s) => tickSection(s, true)));
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
    let payload: {
      type?: string;
      topic?: string;
      data?: { chain?: string; token?: DiscoveryToken };
    };
    try {
      payload = JSON.parse(String(event.data));
    } catch {
      return;
    }

    if (payload.type === 'welcome') {
      socketWelcomed = true;
      try {
        reconcileTopics();
      } catch {
        // The reconnect path covers it.
      }
      return;
    }

    if (payload.type === 'event' && payload.topic?.startsWith('feed.discovery:')) {
      const topicSection = payload.topic.slice('feed.discovery:'.length);
      const isValidSection =
        topicSection !== 'all' && DISCOVERY_SECTIONS.includes(topicSection as DiscoverySection);
      const targetSection = isValidSection ? (topicSection as DiscoverySection) : undefined;

      const pushed = payload.data;
      if (targetSection && pushed?.token?.mint) {
        const pushedChain = (pushed.chain ?? pushed.token.chain ?? 'solana').toLowerCase();
        if (pushedChain === chain.toLowerCase()) {
          applyPushedToken(targetSection, pushed.token);
        }
      }

      nudge(targetSection);
    }
  };

  next.onerror = () => {
    // Surfaced through onclose, which always follows.
  };

  next.onclose = () => {
    socket = null;
    socketWelcomed = false;
    subscribedTopics.clear();
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
  subscribedTopics.clear();
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
  newPairsTimer = setInterval(() => {
    if ((sectionSubscribers.get('new') ?? 0) > 0) void tickSection('new');
  }, NEW_PAIRS_POLL_MS);
  connectSocket();
}

function stop(): void {
  if (timer) clearInterval(timer);
  timer = null;
  if (newPairsTimer) clearInterval(newPairsTimer);
  newPairsTimer = null;
  dirtySections.clear();
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
export function subscribeToDiscovery(listener: () => void, section?: DiscoverySection): () => void {
  listeners.add(listener);
  subscribers += 1;
  if (section) sectionSubscribers.set(section, (sectionSubscribers.get(section) ?? 0) + 1);
  if (subscribers === 1) start();
  else if (section) {
    reconcileTopics();
    void tickSection(section, true);
  }

  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (section) {
      const remaining = (sectionSubscribers.get(section) ?? 1) - 1;
      if (remaining > 0) sectionSubscribers.set(section, remaining);
      else sectionSubscribers.delete(section);
      reconcileTopics();
    }
    if (subscribers === 0) stop();
  };
}

export function getDiscoverySnapshot(): DiscoverySnapshot {
  return snapshot;
}

export function getDiscoveryHealth(section?: DiscoverySection): DiscoveryHealth {
  if (snapshot.paused) return 'stale';
  const sections = section ? [getSection(section)] : activeSections().map(getSection);
  const hasLiveRest = snapshot.hasLoaded && sections.some((item) => item.state === 'live');
  if (!hasLiveRest && (reconnectState.status === 'connecting' || reconnectState.status === 'reconnecting')) return 'reconnecting';
  if (!snapshot.hasLoaded || sections.some((item) => item.state === 'loading')) return hasLiveRest ? 'degraded' : 'reconnecting';
  if (sections.every((item) => item.state === 'stale' || item.at === 0)) return 'unavailable';
  if (sections.some((item) => item.state === 'stale')) return 'degraded';
  if (!socketWelcomed) return 'degraded';
  return 'live';
}

export function pauseDiscovery(): void {
  if (paused) return;
  paused = true;
  pendingRefresh = false;
  snapshot = { ...snapshot, paused: true, pausedAt: Date.now(), pendingRefresh: false };
  if (nudgeTimer) clearTimeout(nudgeTimer);
  nudgeTimer = null;
  listeners.forEach((notify) => notify());
}

export function resumeDiscovery(): void {
  if (!paused) return;
  paused = false;
  const shouldRefresh = pendingRefresh || snapshot.hasLoaded;
  pendingRefresh = false;
  snapshot = { ...snapshot, paused: false, pausedAt: null, pendingRefresh: false };
  listeners.forEach((notify) => notify());
  if (shouldRefresh && timer) void tick();
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
 * Changes the shared query. Restores cached snapshot for the target query when
 * available so switching chains never flashes a blank screen, while refreshing
 * live in the background.
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

  if (snapshot.hasLoaded) {
    snapshotsByQuery.set(queryKey(), snapshot);
  }

  chain = next.chain ?? chain;
  timeWindow = next.timeWindow ?? timeWindow;
  includeZeroLiquidity = next.includeZeroLiquidity ?? includeZeroLiquidity;
  queryRevision += 1;
  sectionInFlight.clear();
  sectionRerunAfterFlight.clear();
  dirtySections.clear();

  const cached = snapshotsByQuery.get(queryKey());
  snapshot = cached && cached.hasLoaded ? cached : emptySnapshot();
  listeners.forEach((notify) => notify());
  if (timer) void tick(true);
}

/** Forces a cycle now, for a manual refresh control. */
export function refreshDiscovery(): void {
  pendingRefresh = true;
  if (paused) {
    snapshot = { ...snapshot, pendingRefresh: true };
    listeners.forEach((notify) => notify());
    return;
  }
  void tick(true);
}

/** Test seam. */
export function __resetDiscoveryStore(): void {
  stop();
  snapshot = emptySnapshot();
  snapshotsByQuery.clear();
  listeners.clear();
  subscribers = 0;
  sectionSubscribers.clear();
  sectionInFlight.clear();
  sectionRerunAfterFlight.clear();
  dirtySections.clear();
  queryRevision = 0;
  chain = 'solana';
  timeWindow = '15m';
  includeZeroLiquidity = false;
  paused = false;
  pendingRefresh = false;
}

/** Current zero-liquidity setting, for the toggle's checked state. */
export function getIncludeZeroLiquidity(): boolean {
  return includeZeroLiquidity;
}
