import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/server/env', () => ({ env: { BIRDEYE_API_KEY: 'test-server-secret' } }));
vi.mock('@/lib/market/enrichment/birdeye-limiter', () => ({ acquireBirdeyeSlot: vi.fn().mockResolvedValue(undefined) }));
import { getChartHistory, resetChartHistoryForTests } from '../chart-history';
import { chartPrecision, mergeChartCandles, parseProviderCandle, parseChartTarget } from '../chart-model';
const mint = 'So11111111111111111111111111111111111111112';
const time = 1790089560;
const row = (unix_time = time) => ({ address: mint, unix_time, o: 116.50, h: 117.17, l: 116.44, c: 117.14,
  v: 34232.52, v_usd: 4002689.17, type: '1m', currency: 'usd' });
const ok = (items: unknown[] = [row()]) => ({ ok: true, json: async () => ({ success: true, data: { items } }) });
beforeEach(() => { resetChartHistoryForTests(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-22T16:00:00Z')); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('requests real unpadded USD history with a server-only key, deduplicates inflight requests and caches', async () => {
  const fetcher = vi.fn().mockResolvedValue(ok()); vi.stubGlobal('fetch', fetcher);
  const [a, b] = await Promise.all([getChartHistory(mint, '1m'), getChartHistory(mint, '1m')]);
  expect(a).toEqual(b); expect(a.candles[0]).toMatchObject({ close: 117.14, volume: 34232.52, volumeUsd: 4002689.17 });
  await getChartHistory(mint, '1m'); expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toContain('padding=false'); expect(url).not.toContain('test-server-secret');
  expect(options.headers['X-API-KEY']).toBe('test-server-secret');
});
it('returns strictly older, sorted, deduplicated history with lookahead', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([row(time), row(time - 60), row(time - 120), row(time - 120)])));
  const s = await getChartHistory(mint, '1m', 1, time);
  expect(s.candles.map(c => c.time)).toEqual([time - 60]); expect(s.hasMore).toBe(true);
});
it('keeps missing volume unknown and successful zero intact', () => {
  expect(parseProviderCandle({ ...row(), v: undefined }, '1m')?.volume).toBeNull();
  expect(parseProviderCandle({ ...row(), v: 0 }, '1m')?.volume).toBe(0);
  expect(parseProviderCandle({ ...row(), h: 1 }, '1m')).toBeNull();
  expect(parseProviderCandle({ ...row(), unix_time: time + 1 }, '1m')).toBeNull();
});
it('never fabricates candles for an empty successful response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])));
  expect(await getChartHistory(mint, '1m')).toMatchObject({ candles: [], hasMore: false, status: 'measured' });
});
it('rejects malformed provider payloads rather than pretending the market is empty', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([{ ...row(), address: 'wrong' }])));
  await expect(getChartHistory(mint, '1m')).rejects.toThrow('malformed');
});
it('retains stale real history on 429 and respects retry-after across requests', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValue({ ok: false, status: 429, headers: new Headers({ 'retry-after': '60' }) });
  vi.stubGlobal('fetch', fetcher); const original = await getChartHistory(mint, '1m');
  await vi.advanceTimersByTimeAsync(6000);
  const stale = await getChartHistory(mint, '1m');
  expect(stale).toMatchObject({ status: 'stale', candles: original.candles, observedAt: original.observedAt });
  await getChartHistory(mint, '1m'); expect(fetcher).toHaveBeenCalledTimes(2);
  await expect(getChartHistory(mint, '5m')).rejects.toThrow('rate limit');
});
it('aborts stalled provider requests instead of loading forever', async () => {
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('abort'))))));
  const work = expect(getChartHistory(mint, '1m')).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(12_001); await work;
});
it('replaces cumulative volume instead of double counting and preserves older pages', () => {
  const candle = parseProviderCandle(row(), '1m')!;
  const older = { ...candle, time: time - 60 };
  const merged = mergeChartCandles([older, candle], [{ ...candle, volume: 9 }]);
  expect(merged).toHaveLength(2); expect(merged[1].volume).toBe(9);
  expect(chartPrecision(0.000000023).precision).toBeGreaterThanOrEqual(10);
  expect(parseChartTarget(`${mint}:1m:garbage`)).toBeNull();
  expect(parseChartTarget(`${mint}:1m:`)).toBeNull();
});
