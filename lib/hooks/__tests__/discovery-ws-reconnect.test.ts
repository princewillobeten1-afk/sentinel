import { describe, expect, it } from 'vitest';
import {
  computeReconnectDelayMs,
  initialReconnectState,
  reconnectReducer,
  MAX_CONSECUTIVE_FAILURES,
  type ReconnectState,
} from '../discovery-ws-reconnect';

describe('reconnectReducer', () => {
  it('starts idle', () => {
    expect(initialReconnectState()).toEqual({ status: 'idle', attempt: 0 });
  });

  it('moves to connecting on CONNECT_REQUESTED', () => {
    const state = reconnectReducer(initialReconnectState(), { type: 'CONNECT_REQUESTED' });
    expect(state.status).toBe('connecting');
  });

  it('moves to open and resets attempt on OPENED', () => {
    const state = reconnectReducer({ status: 'reconnecting', attempt: 2 }, { type: 'OPENED' });
    expect(state).toEqual({ status: 'open', attempt: 0 });
  });

  it('moves to reconnecting on CLOSED, incrementing attempt, while under the failure cap', () => {
    const state = reconnectReducer({ status: 'connecting', attempt: 0 }, { type: 'CLOSED' });
    expect(state).toEqual({ status: 'reconnecting', attempt: 1 });
  });

  it('gives up once CLOSED pushes attempt to the failure cap', () => {
    let state: ReconnectState = { status: 'connecting', attempt: 0 };
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES; i++) {
      state = reconnectReducer(state, { type: 'CLOSED' });
    }
    expect(state.status).toBe('given_up');
    expect(state.attempt).toBe(MAX_CONSECUTIVE_FAILURES);
  });

  it('a successful OPEN resets the failure streak so a later drop starts counting from zero again', () => {
    let state: ReconnectState = { status: 'connecting', attempt: 2 };
    state = reconnectReducer(state, { type: 'OPENED' });
    state = reconnectReducer(state, { type: 'CLOSED' });
    expect(state).toEqual({ status: 'reconnecting', attempt: 1 });
  });

  it('MANUAL_RECONNECT resets attempt and forces connecting, even from given_up', () => {
    const state = reconnectReducer({ status: 'given_up', attempt: 5 }, { type: 'MANUAL_RECONNECT' });
    expect(state).toEqual({ status: 'connecting', attempt: 0 });
  });
});

describe('computeReconnectDelayMs', () => {
  it('is within [0, base] for attempt 0', () => {
    for (let i = 0; i < 20; i++) {
      const delay = computeReconnectDelayMs(0, 1000, 30_000);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });

  it('grows exponentially with attempt, up to the cap', () => {
    for (let i = 0; i < 20; i++) {
      const delay = computeReconnectDelayMs(3, 1000, 30_000);
      expect(delay).toBeLessThanOrEqual(8000);
    }
  });

  it('never exceeds capMs regardless of how large attempt is', () => {
    for (let i = 0; i < 20; i++) {
      const delay = computeReconnectDelayMs(20, 1000, 30_000);
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });
});
