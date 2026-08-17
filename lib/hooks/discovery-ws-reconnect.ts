/**
 * Pure reconnect/backoff state machine for `use-discovery-ws.ts` (Sprint 31
 * — Item 7). No `WebSocket`/DOM dependency, so it's directly unit-testable —
 * the hook itself just drives real socket events through this reducer.
 */

export type ReconnectStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'given_up';

export interface ReconnectState {
  status: ReconnectStatus;
  /** Consecutive failures since the last successful `open` (or since start). */
  attempt: number;
}

export type ReconnectEvent =
  | { type: 'CONNECT_REQUESTED' }
  | { type: 'OPENED' }
  | { type: 'CLOSED' }
  | { type: 'MANUAL_RECONNECT' };

/** Give up after this many consecutive failures — the WS feed is an enhancement, never load-bearing. */
export const MAX_CONSECUTIVE_FAILURES = 3;

export function initialReconnectState(): ReconnectState {
  return { status: 'idle', attempt: 0 };
}

export function reconnectReducer(state: ReconnectState, event: ReconnectEvent): ReconnectState {
  switch (event.type) {
    case 'CONNECT_REQUESTED':
      return { status: 'connecting', attempt: state.attempt };

    case 'OPENED':
      return { status: 'open', attempt: 0 };

    case 'CLOSED': {
      const attempt = state.attempt + 1;
      return attempt >= MAX_CONSECUTIVE_FAILURES
        ? { status: 'given_up', attempt }
        : { status: 'reconnecting', attempt };
    }

    case 'MANUAL_RECONNECT':
      return { status: 'connecting', attempt: 0 };

    default:
      return state;
  }
}

/**
 * Exponential backoff with full jitter — same qualitative shape as
 * `lib/market/birdeye-rest-client.ts`'s existing retry delay, so reconnect
 * storms from many tabs/clients desynchronize instead of retrying in lockstep.
 */
export function computeReconnectDelayMs(attempt: number, baseMs = 1000, capMs = 30_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.random() * exp;
}
