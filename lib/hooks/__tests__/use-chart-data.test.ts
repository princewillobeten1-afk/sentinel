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
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetcher).toHaveBeenCalledTimes(2); expect(result.current.candles[0].close).toBe(3);
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
