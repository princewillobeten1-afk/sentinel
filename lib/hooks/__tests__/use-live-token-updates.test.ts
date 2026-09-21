// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveTokenUpdates } from '../use-live-token-updates';

/**
 * A stand-in for the browser WebSocket.
 *
 * Real sockets can't be driven deterministically, and the bug this suite exists
 * to pin is a *timing* one: the hook must subscribe when the server's `welcome`
 * arrives, not when the socket opens. Against the running server, subscribing
 * on `open` produced zero events — silently, with no error and no `subscribed`
 * reply — because the server attaches its message listener immediately after
 * sending `welcome`. Only a fake socket lets that ordering be asserted.
 */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;

  readyState = FakeSocket.OPEN;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = 3;
  }

  /** Everything the client received, parsed. */
  sentMessages() {
    return this.sent.map((s) => JSON.parse(s));
  }

  emitOpen() {
    this.onopen?.();
  }

  emitServer(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  emitClose(code = 1006) {
    this.onclose?.({ code });
  }
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const socket = () => FakeSocket.instances[0];

describe('useLiveTokenUpdates', () => {
  it('subscribes the latest visible set when reconnecting after a scroll', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ mints }) => useLiveTokenUpdates(mints), { initialProps: { mints: ['mintA'] } });
    try {
      act(() => { socket().emitOpen(); socket().emitServer({ type: 'welcome' }); });
      rerender({ mints: ['mintB'] });
      act(() => socket().emitClose(1001));
      act(() => vi.advanceTimersByTime(1_000));
      const reconnected = FakeSocket.instances[1];
      act(() => { reconnected.emitOpen(); reconnected.emitServer({ type: 'welcome' }); });
      expect(reconnected.sentMessages()).toEqual([{ type: 'subscribe', topics: ['token.card:mintB'] }]);
    } finally { unmount(); vi.useRealTimers(); }
  });
  it('does not subscribe on open — only once the server sends welcome', async () => {
    // The exact regression: a subscribe sent in the `open` handler lands
    // before the server attaches its message listener and is discarded.
    renderHook(() => useLiveTokenUpdates(['mintA']));

    act(() => socket().emitOpen());
    expect(socket().sentMessages()).toHaveLength(0);

    act(() => socket().emitServer({ type: 'welcome', connectionId: 'c1' }));

    await waitFor(() => expect(socket().sentMessages()).toHaveLength(1));
    expect(socket().sentMessages()[0]).toEqual({
      type: 'subscribe',
      topics: ['token.card:mintA'],
    });
  });

  it('merges an aggregated card patch and rejects an older sequence', async () => {
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));
    act(() => {
      socket().emitOpen();
      socket().emitServer({ type: 'welcome', connectionId: 'c1' });
      socket().emitServer({
        type: 'event', topic: 'token.card:mintA', sequence: 4,
        data: { observedAt: '2026-09-11T10:00:00.000Z', changedFields: { top10HoldingsPct: 42, priceUsd: '1.5' } },
      });
      socket().emitServer({
        type: 'event', topic: 'token.card:mintA', sequence: 3,
        data: { observedAt: '2026-09-11T09:59:00.000Z', changedFields: { top10HoldingsPct: 1 } },
      });
    });
    await waitFor(() => expect(result.current.updates.get('mintA')?.top10HoldingsPct).toBe(42));
    expect(result.current.updates.get('mintA')?.priceUsd).toBe(1.5);
  });

  it('reports live status only after welcome', async () => {
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));
    expect(result.current.status).toBe('connecting');

    act(() => socket().emitOpen());
    expect(result.current.status).toBe('connecting');

    act(() => socket().emitServer({ type: 'welcome', connectionId: 'c1' }));
    await waitFor(() => expect(result.current.status).toBe('live'));
  });

  it('applies a live price event', async () => {
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));
    act(() => {
      socket().emitOpen();
      socket().emitServer({ type: 'welcome', connectionId: 'c1' });
    });

    act(() =>
      socket().emitServer({
        type: 'event',
        topic: 'token.price:mintA',
        data: { priceUsd: 0.25, change24h: 12.5 },
      }),
    );

    await waitFor(() => {
      const update = result.current.updates.get('mintA');
      expect(update?.priceUsd).toBe(0.25);
      expect(update?.priceChange24h).toBe(12.5);
    });
  });

  it('reads the snapshot payload the server replays on subscribe', async () => {
    // The snapshot uses `lastPriceUsd` where live events use `priceUsd`.
    // Reading only the live field left every card blank until its first trade.
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));
    act(() => {
      socket().emitOpen();
      socket().emitServer({ type: 'welcome', connectionId: 'c1' });
    });

    act(() =>
      socket().emitServer({
        type: 'event',
        topic: 'token.price:mintA',
        data: { snapshot: true, mint: 'mintA', lastPriceUsd: '1.75' },
      }),
    );

    await waitFor(() => expect(result.current.updates.get('mintA')?.priceUsd).toBe(1.75));
  });

  it('keeps a known price when a trade event carries none', async () => {
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));
    act(() => {
      socket().emitOpen();
      socket().emitServer({ type: 'welcome', connectionId: 'c1' });
      socket().emitServer({ type: 'event', topic: 'token.price:mintA', data: { priceUsd: 3 } });
    });

    act(() =>
      socket().emitServer({
        type: 'event',
        topic: 'token.trade:mintA',
        data: { side: 'SELL', amount: 500 },
      }),
    );

    await waitFor(() => {
      const update = result.current.updates.get('mintA');
      expect(update?.lastTradeSide).toBe('SELL');
      // Not clobbered to undefined by the trade message.
      expect(update?.priceUsd).toBe(3);
    });
  });

  it('ignores a zero or unparseable price rather than showing $0', async () => {
    // The live cache legitimately holds "0.00" for an unpriced token; rendering
    // that as a real price is exactly the kind of confident wrong number this
    // codebase keeps removing.
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));
    act(() => {
      socket().emitOpen();
      socket().emitServer({ type: 'welcome', connectionId: 'c1' });
      socket().emitServer({
        type: 'event',
        topic: 'token.price:mintA',
        data: { snapshot: true, lastPriceUsd: '0.00' },
      });
    });

    await waitFor(() => expect(result.current.updates.get('mintA')?.priceUsd).toBeUndefined());
  });

  it('ignores events for topics it does not handle', async () => {
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));
    act(() => {
      socket().emitOpen();
      socket().emitServer({ type: 'welcome', connectionId: 'c1' });
      socket().emitServer({ type: 'event', topic: 'feed.discovery:all', data: { priceUsd: 9 } });
    });

    await waitFor(() => expect(result.current.updates.size).toBe(0));
  });

  it('survives a malformed frame', async () => {
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));
    act(() => {
      socket().emitOpen();
      socket().emitServer({ type: 'welcome', connectionId: 'c1' });
      socket().onmessage?.({ data: 'not json{' });
      socket().emitServer({ type: 'event', topic: 'token.price:mintA', data: { priceUsd: 5 } });
    });

    await waitFor(() => expect(result.current.updates.get('mintA')?.priceUsd).toBe(5));
  });

  it('stops retrying after repeated refusals and reports unavailable', async () => {
    // A signed-out visitor cannot upgrade at all. Retrying forever would
    // reconnect-loop on every logged-out page load.
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveTokenUpdates(['mintA']));

    for (let attempt = 0; attempt < 4; attempt++) {
      const current = FakeSocket.instances[FakeSocket.instances.length - 1];
      act(() => current.emitClose(4401));
      act(() => { vi.advanceTimersByTime(60_000); });
    }

    expect(result.current.status).toBe('unavailable');
    vi.useRealTimers();
  });
});
