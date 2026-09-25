import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getBitqueryChartHistory, getBitqueryChartHealth, parseBitqueryCandle,
  resetBitqueryChartForTests, rollupBitqueryCandles } from '../bitquery-chart';

const mint = 'So11111111111111111111111111111111111111112';
const time = 1790089200;
const row = (seconds = time, duration = 900, volume: number | null = 11) => ({
  Token: { Address: mint, Network: 'Solana' },
  Interval: { Time: { Start: new Date(seconds * 1000).toISOString(), Duration: duration } },
  Price: { IsQuotedInUsd: true, Ohlc: { Open: 2, High: 4, Low: 1, Close: 3 } },
  Volume: { Base: volume, Usd: 33 },
});
const ok = (rows: unknown[]) => ({ ok: true, json: async () => ({ data: { Trading: { Tokens: rows } } }) });

beforeEach(() => { resetBitqueryChartForTests(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-22T16:00:00Z')); vi.stubEnv('BITQUERY_ACCESS_TOKEN', 'test-secret'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it('queries bounded, recent Solana USD candles server-side and preserves missing volume', async () => {
  const fetcher = vi.fn().mockResolvedValue(ok([row(time, 900, null)]));
  vi.stubGlobal('fetch', fetcher);
  const [first, second] = await Promise.all([getBitqueryChartHistory(mint, '15m', 150), getBitqueryChartHistory(mint, '15m', 150)]);
  expect(first).toEqual(second);
  expect(first).toMatchObject({ source: 'bitquery-token-ohlcv', market: 'token-aggregate',
    candles: [{ time, volume: null, volumeUsd: 33 }] });
  await getBitqueryChartHistory(mint, '15m', 150);
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('https://streaming.bitquery.io/graphql');
  expect(options.headers.Authorization).toBe('Bearer test-secret');
  const query = JSON.parse(options.body).query;
  expect(query).toContain('Duration: { eq: 900 }');
  expect(query).toContain('IsQuotedInUsd: true');
  expect(query).toContain(mint);
  expect(query).not.toContain('test-secret');
  expect(getBitqueryChartHealth().configured).toBe(true);
});

it('rejects mismatched and invalid OHLC rather than fabricating zeroes', async () => {
  expect(parseBitqueryCandle({ ...row(), Token: { Address: mint.toLowerCase(), Network: 'Solana' } }, mint, 900)).toBeNull();
  expect(parseBitqueryCandle({ ...row(), Price: { IsQuotedInUsd: false, Ohlc: row().Price.Ohlc } }, mint, 900)).toBeNull();
  expect(parseBitqueryCandle({ ...row(), Price: { IsQuotedInUsd: true, Ohlc: { ...row().Price.Ohlc, High: 0 } } }, mint, 900)).toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([{ ...row(), Token: { Address: 'wrong', Network: 'Solana' } }])));
  expect(await getBitqueryChartHistory(mint, '15m', 150)).toBeNull();
  expect(getBitqueryChartHealth().lastError).toContain('malformed');
});

it('rolls hourly bars to larger timeframes without inventing missing volume', () => {
  const first = { time: 1790085600, open: 2, high: 3, low: 1, close: 2.5, volume: 4, volumeUsd: 12 };
  const second = { time: first.time + 3600, open: 2.5, high: 5, low: 2, close: 4, volume: null, volumeUsd: 20 };
  expect(rollupBitqueryCandles([second, first], '4h')).toMatchObject([{ open: 2, high: 5, low: 1, close: 4,
    volume: null, volumeUsd: 32 }]);
});

it('uses native 1h rows for 4h charts and filters strictly older pages', async () => {
  const aligned = Math.floor(time / 3600) * 3600;
  const fetcher = vi.fn().mockResolvedValue(ok([row(aligned - 3600, 3600), row(aligned, 3600)]));
  vi.stubGlobal('fetch', fetcher);
  const result = await getBitqueryChartHistory(mint, '4h', 2, aligned);
  expect(result?.candles.every(c => c.time < aligned)).toBe(true);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).query).toContain('Duration: { eq: 3600 }');
});

it('pauses on entitlement or quota errors without retrying every request', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 429, headers: new Headers({ 'retry-after': '60' }) });
  vi.stubGlobal('fetch', fetcher);
  expect(await getBitqueryChartHistory(mint, '1m', 2)).toBeNull();
  expect(await getBitqueryChartHistory(mint, '5m', 2)).toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
  expect(getBitqueryChartHealth().pausedUntil).toBeGreaterThan(Date.now());
});
