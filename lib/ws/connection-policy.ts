/**
 * Pure decision logic for WebSocket connection hygiene (Sprint 31 — Item 6):
 * per-connection message-rate limiting, per-topic sequence numbering, and
 * send-side backpressure coalescing. No `ws`/socket import here, so this is
 * directly unit-testable — `lib/ws/server.ts` (which holds the real sockets
 * and is `server-only`) is the only caller.
 */

export interface RateLimitState {
  windowStart: number;
  count: number;
}

export interface RateLimitResult {
  state: RateLimitState;
  /** False once the connection is over the limit for this window — the message should be dropped. */
  allowed: boolean;
  /** True once sustained abuse (3x the limit within one window) warrants closing the connection outright. */
  terminate: boolean;
}

export const DEFAULT_MESSAGE_RATE_LIMIT = 30;
export const DEFAULT_MESSAGE_RATE_WINDOW_MS = 10_000;

export function createRateLimitState(now: number): RateLimitState {
  return { windowStart: now, count: 0 };
}

/**
 * Fixed-window per-connection message counter. Pure: returns a new state
 * rather than mutating the one passed in, so callers decide when to commit it.
 */
export function checkMessageRate(
  state: RateLimitState,
  now: number,
  limit: number = DEFAULT_MESSAGE_RATE_LIMIT,
  windowMs: number = DEFAULT_MESSAGE_RATE_WINDOW_MS,
): RateLimitResult {
  const withinWindow = now - state.windowStart < windowMs;
  const nextState: RateLimitState = withinWindow
    ? { windowStart: state.windowStart, count: state.count + 1 }
    : { windowStart: now, count: 1 };

  return {
    state: nextState,
    allowed: nextState.count <= limit,
    terminate: nextState.count > limit * 3,
  };
}

/**
 * Per-topic sequence numbers (Sprint 31 — Item 6, protocol contract change
 * from Sprint 28's per-connection-global sequence). `sequence` in the wire
 * protocol now means "monotonic within this topic for this connection," not
 * "monotonic across everything this connection receives" — see
 * `docs/api/websocket.md`.
 */
export function nextTopicSequence(topicSequences: Map<string, number>, topic: string): number {
  const next = (topicSequences.get(topic) ?? 0) + 1;
  topicSequences.set(topic, next);
  return next;
}

export const DEFAULT_BACKPRESSURE_THRESHOLD_BYTES = 1_000_000;

/**
 * Whether an outbound `event` message should be coalesced (last-value-wins
 * per topic) instead of sent immediately, because the socket's outbound
 * buffer is already backed up. Never applied to control-plane messages
 * (welcome/subscribed/error/pong) — only to `event` payloads, where losing
 * an intermediate price/risk tick in favor of the latest one is correct.
 */
export function shouldCoalesce(bufferedAmount: number, thresholdBytes: number = DEFAULT_BACKPRESSURE_THRESHOLD_BYTES): boolean {
  return bufferedAmount > thresholdBytes;
}
