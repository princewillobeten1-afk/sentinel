/**
 * What the live market stream is actually being asked for.
 *
 * ## Why this exists
 *
 * The Helius stream used to `logsSubscribe` to three whole DEX programs —
 * pump.fun, Raydium AMM v4 and Orca Whirlpool — from the moment the server
 * booted. Measured over 30s:
 *
 *     13,880 frames, 18.37 MB  ->  36.7 MB/min, 2.2 GB/hour, 51.7 GB/day
 *
 *     pump.fun         12,352 frames   76%
 *     raydium_amm_v4      763 frames   12%
 *     orca_whirlpool      762 frames   12%
 *
 * Almost none of it was used. A browser only ever receives events for the
 * tokens it subscribed to (`token.price:<mint>`, `token.trade:<mint>`), and
 * a session is capped at 30 topics — so of ~460 frames a second, the handful
 * touching on-screen tokens were kept and the rest decoded and discarded.
 *
 * The stream now subscribes per mint, to exactly the mints connected clients
 * are watching. Measured against the 21 mints on the Discover page at the time:
 * **1.33 MB/min, against 36.7** for the program sweep.
 *
 * This module is the ledger of that demand: which mints are wanted, by how
 * many topic subscriptions, across every connection.
 *
 * ## Why a separate module
 *
 * `stream-manager.ts` cannot import `lib/ws/server.ts` to read connection
 * state. That graph reaches `lib/server/api-keys.ts`, which reaches
 * `node:crypto`, and `stream-manager` is pulled into Next's **edge** bundle
 * through `instrumentation.ts` — the exact `UnhandledSchemeError` that file's
 * header comment documents. So the dependency is inverted: the WebSocket server
 * pushes demand here, and the stream manager reads it. This module imports
 * nothing.
 *
 * State is `globalThis`-guarded for the same reason the rest of the singletons
 * are: HMR and separate webpack graphs would otherwise each get their own copy,
 * and the stream manager would read demand the WebSocket server never wrote.
 */

type CountListener = (count: number) => void;
type MintsListener = (mints: string[]) => void;

interface DemandState {
  count: number;
  listeners: Set<CountListener>;
  /** mint -> number of live topic subscriptions naming it, across connections. */
  mintRefs: Map<string, number>;
  mintListeners: Set<MintsListener>;
}

const globalForDemand = globalThis as typeof globalThis & {
  __streamDemand?: Partial<DemandState>;
};

// Built field by field so an HMR reload that finds an older, smaller state
// object on `globalThis` extends it rather than reading `undefined`.
const stored = (globalForDemand.__streamDemand ??= {});
stored.count ??= 0;
stored.listeners ??= new Set();
stored.mintRefs ??= new Map();
stored.mintListeners ??= new Set();
const state = stored as DemandState;

function notify<T>(listeners: Set<(value: T) => void>, value: T): void {
  for (const listener of listeners) {
    try {
      listener(value);
    } catch {
      // A broken listener must not take down the connection lifecycle.
    }
  }
}

// ── Connections ──

/** Called when a WebSocket client connects. */
export function noteClientConnected(): void {
  state.count += 1;
  notify(state.listeners, state.count);
}

/**
 * Called when a WebSocket client goes away.
 *
 * Clamped at zero: a connection can be dropped from several places, and a
 * surplus decrement must not leave the count in debt.
 */
export function noteClientDisconnected(): void {
  const next = Math.max(0, state.count - 1);
  if (next === state.count) return;
  state.count = next;
  notify(state.listeners, state.count);
}

/** Current number of connected live-stream clients. */
export function getLiveClientCount(): number {
  return state.count;
}

/** Subscribes to connection-count changes. Returns an unsubscribe function. */
export function onDemandChange(listener: CountListener): () => void {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

// ── Watched mints ──

/**
 * Records topic subscriptions naming these mints.
 *
 * Reference-counted, one reference per topic: a client holding both
 * `token.price:X` and `token.trade:X` counts X twice, and X stays watched
 * until both are released — by it or by every other client holding them.
 */
export function noteMintsWanted(mints: Iterable<string>): void {
  let changed = false;
  for (const mint of mints) {
    if (!mint) continue;
    const refs = state.mintRefs.get(mint) ?? 0;
    state.mintRefs.set(mint, refs + 1);
    if (refs === 0) changed = true;
  }
  if (changed) notify(state.mintListeners, getWatchedMints());
}

/** Releases topic subscriptions naming these mints. Clamped at zero. */
export function noteMintsReleased(mints: Iterable<string>): void {
  let changed = false;
  for (const mint of mints) {
    const refs = state.mintRefs.get(mint);
    if (!refs) continue;
    if (refs <= 1) {
      state.mintRefs.delete(mint);
      changed = true;
    } else {
      state.mintRefs.set(mint, refs - 1);
    }
  }
  if (changed) notify(state.mintListeners, getWatchedMints());
}

/** Every mint at least one connected client is watching, in first-wanted order. */
export function getWatchedMints(): string[] {
  return [...state.mintRefs.keys()];
}

/**
 * Subscribes to changes in the watched-mint *set* — fired when a mint gains
 * its first reference or loses its last, not on every reference change.
 */
export function onWatchedMintsChange(listener: MintsListener): () => void {
  state.mintListeners.add(listener);
  return () => state.mintListeners.delete(listener);
}

/** Test seam — resets all demand state and listeners. */
export function __resetDemand(): void {
  state.count = 0;
  state.listeners.clear();
  state.mintRefs.clear();
  state.mintListeners.clear();
}
