// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const ws = vi.hoisted(() => ({ connected: true, handler: null as any }));
vi.mock('../use-sentinel-ws', () => ({ useSentinelWS: (_topic: unknown, handler: unknown) => {
  ws.handler = handler; return { isConnected: ws.connected };
} }));
import { useChartData } from '../use-chart-data';
const mint = 'So11111111111111111111111111111111111111112';
const time = 1790089200;
const candle = (t = time, close = 3) => ({ time: t, open: 2, high: 9, low: 1, close, volume: 100, volumeUsd: 300 });
const snapshot = (candles = [candle()], extra = {}) => ({ address: mint, timeframe: '15m', chain: 'solana', currency: 'usd', market: 'token-aggregate',
  candles, hasMore: true, observedAt: Date.now(), source: 'birdeye-ohlcv-v3', status: 'measured', ...extra });
const response = (data = snapshot()) => ({ ok: true, json: async () => ({ success: true, data }) });
const frame = (close = 4, observedAt = Date.now()) => ({ address: mint, timeframe: '15m', candle: candle(time, close), observedAt, source: 'birdeye-price-ws' });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-22T16:00:00Z')); ws.connected = true; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('labels real REST fallback Polling, never Live just because the socket connects', async () => {
  const fetcher = vi.fn().mockResolvedValue(response()); vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {}); expect(result.current.status).toBe('Polling');
  await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
  expect(fetcher).toHaveBeenCalledTimes(2); expect(result.current.candles[0].close).toBe(3);
  expect(String(fetcher.mock.calls[0][0])).toContain('limit=150');
  expect(String(fetcher.mock.calls[1][0])).toContain('limit=150');
});
it('backfills a sparse fallback with full pool history instead of polling two bars forever', async () => {
  const poolAddress = '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq';
  const history = Array.from({ length: 75 }, (_, index) => candle(time - (74 - index) * 900, 3 + index / 100));
  const fetcher = vi.fn().mockResolvedValueOnce(response(snapshot([candle()], { source: 'bitquery-token-ohlcv' })))
    .mockResolvedValue(response(snapshot(history, { market: 'pool', poolAddress,
      source: 'geckoterminal-pool-ohlcv' })));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {});
  expect(result.current.candles).toHaveLength(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
  expect(String(fetcher.mock.calls[1][0])).toContain('limit=150');
  expect(result.current.candles).toHaveLength(75);
  expect(result.current.market).toBe('pool');
});
it('uses measured server-poll frames without labeling them provider WebSocket Live', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {});
  await act(async () => { ws.handler({ ...frame(4), source: 'birdeye-ohlcv-rest' }, { sequence: 1 }); });
  expect(result.current.candles[0].close).toBe(4);
  expect(result.current.status).toBe('Polling');
  expect(result.current.streamAt).toBe(0);
});
it('exposes Bitquery as the measured aggregate source without claiming a live stream', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(snapshot([candle()], { source: 'bitquery-token-ohlcv' }))));
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {});
  expect(result.current.source).toBe('bitquery-token-ohlcv');
  expect(result.current.status).toBe('Polling');
});
it('recovers from a failed history request when a measured server-poll candle arrives', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('History temporarily unavailable')));
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {});
  expect(result.current.status).toBe('Unavailable');
  await act(async () => { ws.handler({ ...frame(4), source: 'birdeye-ohlcv-rest' }, { sequence: 1 }); });
  expect(result.current.status).toBe('Polling');
  expect(result.current.error).toBeNull();
  expect(result.current.candles[0].close).toBe(4);
});
it('uses full WS candles, rejects out-of-order revisions and delayed REST overwrites', async () => {
  let finish: any;
  const old = snapshot();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })));
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); ws.handler(frame(5), { sequence: 2 }); });
  expect(result.current.status).toBe('Live');
  await act(async () => { ws.handler(frame(4), { sequence: 1 }); finish(response(old)); });
  expect(result.current.candles[0].close).toBe(5); expect(result.current.candles[0].volume).toBe(100);
});
it('preserves paginated history during refresh and deduplicates overlapping rows', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response(snapshot([candle(time - 900), candle()], { hasMore: false })))
    .mockResolvedValue(response(snapshot([candle(time, 4)])));
  vi.stubGlobal('fetch', fetcher); const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {}); await act(async () => { result.current.loadOlder(); });
  expect(result.current.candles).toHaveLength(2); expect(result.current.hasMore).toBe(false);
  await act(async () => { result.current.refresh(); });
  expect(result.current.candles.map(c => c.close)).toEqual([3, 4]); expect(result.current.hasMore).toBe(false);
});
it('retains real candles on failure and recovers on retry', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response()).mockRejectedValue(new Error('Provider offline'));
  vi.stubGlobal('fetch', fetcher); const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {}); await act(async () => { result.current.refresh(); });
  expect(result.current.status).toBe('Delayed'); expect(result.current.candles).toHaveLength(1);
  fetcher.mockResolvedValue(response()); await act(async () => { result.current.refresh(); });
  expect(result.current.error).toBeNull(); expect(result.current.status).toBe('Polling');
});
it('switches from a pool fallback to primary Birdeye without mixing histories', async () => {
  const poolAddress = '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq';
  const pool = { ...snapshot([candle(time, 7)]), market: 'pool', poolAddress,
    source: 'geckoterminal-pool-ohlcv' };
  const fetcher = vi.fn().mockResolvedValueOnce(response()).mockResolvedValue(response(pool as any));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {});
  expect(result.current.market).toBe('token-aggregate');
  await act(async () => { result.current.refresh(); });
  expect(result.current.market).toBe('pool');
  expect(result.current.poolAddress).toBe(poolAddress);
  expect(result.current.candles.map(c => c.close)).toEqual([7]);
  await act(async () => { ws.handler({ ...frame(4), source: 'birdeye-ohlcv-rest' }, { sequence: 1 }); });
  expect(result.current.market).toBe('pool');
  expect(result.current.candles.map(c => c.close)).toEqual([7]);
  await act(async () => { ws.handler({ ...frame(4), source: 'birdeye-price-ws' }, { sequence: 2 }); });
  expect(result.current.candles.map(c => c.close)).not.toContain(7);
});
it('accepts confirmed QuickNode pool ticks as provisional live bars without inventing volume', async () => {
  const poolAddress = '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq';
  const pool = { ...snapshot([candle(time, 7)]), market: 'pool', poolAddress,
    source: 'geckoterminal-pool-ohlcv' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(pool as any)));
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {});
  await act(async () => { ws.handler({ address: mint, timeframe: '15m', market: 'pool', poolAddress,
    source: 'quicknode-pool-ws', observedAt: Date.now(), provisional: true,
    candle: { time, open: 8, high: 8, low: 8, close: 8, volume: null, volumeUsd: null } }, { sequence: 1 }); });
  expect(result.current.status).toBe('Live');
  expect(result.current.liveSource).toBe('quicknode');
  expect(result.current.candles[0]).toMatchObject({ open: 2, high: 9, low: 1, close: 8, volume: null, volumeUsd: null });
  await act(async () => { ws.handler({ address: mint, timeframe: '15m', market: 'pool',
    poolAddress: '31p1hptjhFo6ZD8oBqkfutNXQKGGPyi7YcEAfsyKW777', source: 'quicknode-pool-ws',
    observedAt: Date.now() + 1, candle: { time, open: 10, high: 10, low: 10, close: 10, volume: null, volumeUsd: null } }, { sequence: 2 }); });
  expect(result.current.candles[0].close).toBe(8);
});
it('does not let a QuickNode pool trade replace measured aggregate history', async () => {
  const poolAddress = '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq';
  const fetcher = vi.fn().mockResolvedValue(response());
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {});
  expect(result.current.candles[0].close).toBe(3);
  await act(async () => { ws.handler({ address: mint, timeframe: '15m', market: 'pool', poolAddress,
    source: 'quicknode-pool-ws', observedAt: Date.now(), provisional: true,
    candle: { time, open: 8, high: 8, low: 8, close: 8, volume: null, volumeUsd: null } }, { sequence: 1 }); });
  expect(result.current.market).toBe('token-aggregate');
  expect(result.current.candles).toMatchObject([{ close: 3, volume: 100 }]);
  await act(async () => { result.current.refresh(); });
  expect(result.current.market).toBe('token-aggregate');
  expect(result.current.candles).toMatchObject([{ close: 3, volume: 100 }]);
});
it('reconciles on reconnect and accepts sequence numbers restarting from one', async () => {
  const fetcher = vi.fn().mockImplementation(async () => response()); vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {}); await act(async () => { ws.handler(frame(4), { sequence: 100 }); });
  ws.connected = false; rerender(); ws.connected = true; rerender(); await act(async () => {});
  await act(async () => { ws.handler(frame(5), { sequence: 1 }); });
  expect(result.current.candles[0].close).toBe(5); expect(fetcher).toHaveBeenCalledTimes(2);
});
it('cancels outstanding history on unmount and does not poll hidden pages', async () => {
  const fetcher = vi.fn().mockResolvedValue(response()); vi.stubGlobal('fetch', fetcher);
  const { unmount } = renderHook(() => useChartData(mint, 'solana', '15m')); await act(async () => {});
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); }); expect(fetcher).toHaveBeenCalledTimes(1);
  hidden.mockReturnValue(false); await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(fetcher).toHaveBeenCalledTimes(2); unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); }); expect(fetcher).toHaveBeenCalledTimes(2);
});
it('shows empty/malformed responses honestly and never fills them with dummy bars', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(snapshot([], { hasMore: false }))).mockResolvedValue(response({ wrong: true } as any));
  vi.stubGlobal('fetch', fetcher); const { result } = renderHook(() => useChartData(mint, 'solana', '15m'));
  await act(async () => {}); expect(result.current.candles).toEqual([]); expect(result.current.error).toBeNull();
  await act(async () => { result.current.refresh(); }); expect(result.current.error).toContain('invalid'); expect(result.current.candles).toEqual([]);
});
