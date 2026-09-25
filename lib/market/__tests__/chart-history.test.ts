import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/server/env', () => ({ env: { BIRDEYE_API_KEY: 'test-server-secret' } }));
vi.mock('@/lib/market/enrichment/birdeye-limiter', () => ({ acquireBirdeyeSlot: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../geckoterminal-chart', () => ({ getGeckoChartHistory: vi.fn() }));
vi.mock('../bitquery-chart', () => ({ getBitqueryChartHistory: vi.fn() }));
vi.mock('../bitquery-dex-chart', () => ({ getBitqueryDexChartHistory: vi.fn() }));
import { getChartHistory, resetChartHistoryForTests } from '../chart-history';
import { getGeckoChartHistory } from '../geckoterminal-chart';
import { getBitqueryChartHistory } from '../bitquery-chart';
import { getBitqueryDexChartHistory } from '../bitquery-dex-chart';
import { chartPrecision, mergeChartCandles, parseProviderCandle, parseChartTarget } from '../chart-model';
const mint = 'So11111111111111111111111111111111111111112';
const time = 1790089560;
const row = (unix_time = time) => ({ address: mint, unix_time, o: 116.50, h: 117.17, l: 116.44, c: 117.14,
  v: 34232.52, v_usd: 4002689.17, type: '1m', currency: 'usd' });
const ok = (items: unknown[] = [row()]) => ({ ok: true, json: async () => ({ success: true, data: { items } }) });
beforeEach(() => { resetChartHistoryForTests(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-22T16:00:00Z')); vi.stubEnv('BIRDEYE_API_KEY', 'test-server-secret'); vi.mocked(getGeckoChartHistory).mockReset().mockResolvedValue(null); vi.mocked(getBitqueryChartHistory).mockReset().mockResolvedValue(null); vi.mocked(getBitqueryDexChartHistory).mockReset().mockResolvedValue(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

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
it.each([['1h', '1H', 3600], ['4h', '4H', 14400], ['1d', '1D', 86400]] as const)(
  'uses the Birdeye %s interval and accepts matching provider candles', async (timeframe, providerType, seconds) => {
    const aligned = Math.floor(time / seconds) * seconds;
    const fetcher = vi.fn().mockResolvedValue(ok([{ ...row(aligned), type: providerType }]));
    vi.stubGlobal('fetch', fetcher);
    expect((await getChartHistory(mint, timeframe)).candles).toHaveLength(1);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('type')).toBe(providerType);
  },
);
it('uses a credential loaded after the env module was imported', async () => {
  vi.stubEnv('BIRDEYE_API_KEY', 'late-loaded-key');
  const fetcher = vi.fn().mockResolvedValue(ok()); vi.stubGlobal('fetch', fetcher);
  await getChartHistory(mint, '1m');
  expect(fetcher.mock.calls[0][1].headers['X-API-KEY']).toBe('late-loaded-key');
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
it('uses measured Bitquery token-wide candles when Birdeye returns no bars', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])));
  vi.mocked(getBitqueryChartHistory).mockResolvedValue({ address: mint, chain: 'solana', timeframe: '1m', currency: 'usd',
    market: 'token-aggregate', source: 'bitquery-token-ohlcv', status: 'measured', observedAt: Date.now(),
    candles: [{ time, open: 2, high: 3, low: 1, close: 2.5, volume: null, volumeUsd: 10 }],
    oldestTime: time, hasMore: false });
  expect(await getChartHistory(mint, '1m')).toMatchObject({ source: 'bitquery-token-ohlcv', candles: [{ volumeUsd: 10 }] });
  expect(getGeckoChartHistory).not.toHaveBeenCalled();
});
it('uses Bitquery raw DEX candles when the token-wide price cube has no new-launch bars', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])));
  vi.mocked(getBitqueryDexChartHistory).mockResolvedValue({ address: mint, chain: 'solana', timeframe: '1m', currency: 'usd',
    market: 'token-aggregate', source: 'bitquery-dex-ohlcv', status: 'measured', observedAt: Date.now(),
    candles: [{ time, open: 2, high: 3, low: 1, close: 2.5, volume: 100, volumeUsd: 10 }],
    oldestTime: time, hasMore: false });
  expect(await getChartHistory(mint, '1m')).toMatchObject({ source: 'bitquery-dex-ohlcv', candles: [{ volume: 100 }] });
  expect(getGeckoChartHistory).not.toHaveBeenCalled();
});
it('uses Bitquery before switching to a pool fallback after Birdeye quota exhaustion', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, headers: new Headers() }));
  vi.mocked(getBitqueryChartHistory).mockResolvedValue({ address: mint, chain: 'solana', timeframe: '15m', currency: 'usd',
    market: 'token-aggregate', source: 'bitquery-token-ohlcv', status: 'measured', observedAt: Date.now(),
    candles: [{ time: Math.floor(time / 900) * 900, open: 2, high: 3, low: 1, close: 2.5, volume: null, volumeUsd: 10 }],
    oldestTime: Math.floor(time / 900) * 900, hasMore: false });
  expect(await getChartHistory(mint, '15m')).toMatchObject({ source: 'bitquery-token-ohlcv', market: 'token-aggregate' });
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
it('reports exhausted Birdeye compute units and does not retry every chart poll', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: false, status: 400, headers: new Headers(),
    text: async () => '{"success":false,"message":"Compute units usage limit exceeded"}',
  });
  vi.stubGlobal('fetch', fetcher);
  await expect(getChartHistory(mint, '1m')).rejects.toThrow('compute-unit quota is exhausted');
  await expect(getChartHistory(mint, '5m')).rejects.toThrow('compute-unit quota is exhausted');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('uses a labeled real pool fallback for a cold chart when Birdeye is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, headers: new Headers() }));
  vi.mocked(getGeckoChartHistory).mockResolvedValue({
    address: mint, chain: 'solana', timeframe: '15m', currency: 'usd', market: 'pool',
    poolAddress: '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq',
    source: 'geckoterminal-pool-ohlcv', status: 'measured', observedAt: Date.now(),
    candles: [{ time, open: 2, high: 3, low: 1, close: 2.5, volume: null, volumeUsd: 7 }], hasMore: false, oldestTime: time,
  });
  const fallback = await getChartHistory(mint, '15m');
  expect(fallback).toMatchObject({ market: 'pool', source: 'geckoterminal-pool-ohlcv', candles: [{ volume: null, volumeUsd: 7 }] });
  expect(getGeckoChartHistory).toHaveBeenCalledWith(mint, '15m', 150, undefined);
});
it('keeps Birdeye primary even when QuickNode pool streaming is configured', async () => {
  vi.stubEnv('QUICKNODE_SOLANA_WSS_URL', 'wss://quicknode.example/secret');
  const fetcher = vi.fn().mockResolvedValue(ok()); vi.stubGlobal('fetch', fetcher);
  vi.mocked(getGeckoChartHistory).mockResolvedValue({
    address: mint, chain: 'solana', timeframe: '15m', currency: 'usd', market: 'pool',
    poolAddress: '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq',
    source: 'geckoterminal-pool-ohlcv', status: 'measured', observedAt: Date.now(),
    candles: [{ time: Math.floor(time / 900) * 900, open: 2, high: 3, low: 1, close: 2.5, volume: null, volumeUsd: 7 }],
    hasMore: false, oldestTime: Math.floor(time / 900) * 900,
  });
  expect(await getChartHistory(mint, '1m')).toMatchObject({ market: 'token-aggregate', source: 'birdeye-ohlcv-v3' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(getGeckoChartHistory).not.toHaveBeenCalled();
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
