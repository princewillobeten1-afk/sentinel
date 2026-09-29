import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socket = vi.hoisted(() => ({
  options: null as null | { onMessage: (raw: string) => void },
  connects: 0,
  stops: 0,
  sends: 0,
}));

vi.mock('../ws-client', () => ({
  ReconnectingWebSocketClient: class {
    constructor(options: { onMessage: (raw: string) => void }) { socket.options = options; }
    connect() { socket.connects += 1; }
    stop() { socket.stops += 1; }
    send() { socket.sends += 1; }
    getHealth() { return { state: 'closed', lastMessageAt: null, consecutiveFailures: 0 }; }
  },
}));

import { BirdeyeClient } from '../birdeye-client';

describe('Birdeye subscription rejection backoff', () => {
  const previousKey = process.env.BIRDEYE_API_KEY;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env.BIRDEYE_API_KEY = 'test-key';
    socket.options = null;
    socket.connects = 0;
    socket.stops = 0;
    socket.sends = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (previousKey === undefined) delete process.env.BIRDEYE_API_KEY;
    else process.env.BIRDEYE_API_KEY = previousKey;
  });

  it('keeps visible mints while pausing a denied stream and retries once after cooldown', () => {
    const degraded = vi.fn();
    const client = new BirdeyeClient({ mints: ['MintA'], onRawEvent: vi.fn(), onDegraded: degraded });
    client.connect();
    socket.options?.onMessage(JSON.stringify({ type: 'ERROR', statusCode: 400,
      data: 'Origin or API key invalid: secret-value' }));

    expect(socket.stops).toBe(1);
    expect(degraded).toHaveBeenCalledTimes(1);
    expect(client.getHealth().providerError).not.toContain('secret-value');
    expect(client.getHealth().pausedUntil).toBeDefined();
    client.setMints(['MintB']);
    expect(socket.sends).toBe(0);

    vi.advanceTimersByTime(15 * 60_000);
    expect(socket.connects).toBe(2);
    expect(client.getHealth().pausedUntil).toBeUndefined();
    client.stop();
  });

  it('does not reconnect after shutdown', () => {
    const client = new BirdeyeClient({ mints: [], onRawEvent: vi.fn(), onDegraded: vi.fn() });
    client.connect();
    socket.options?.onMessage(JSON.stringify({ type: 'ERROR', data: 'API key invalid' }));
    client.stop();
    vi.advanceTimersByTime(15 * 60_000);
    expect(socket.connects).toBe(1);
  });
});
