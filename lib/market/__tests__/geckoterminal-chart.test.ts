import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getGeckoChartHistory, resetGeckoChartForTests } from '../geckoterminal-chart';

const mint = 'CzhWkiwzxk6RxcfY5LgzsCvJzfwwP26xxkaU8ouNpump';
const pool = '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq';
const time = 1790263800;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
const poolResponse = (base = `solana_${mint}`) => ({ data: [{
  attributes: { address: pool }, relationships: {
    base_token: { data: { id: base } },
    quote_token: { data: { id: 'solana_So11111111111111111111111111111111111111112' } },
  },
}] });

beforeEach(() => { resetGeckoChartForTests(); vi.useFakeTimers(); vi.setSystemTime(time * 1000 + 1_000); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('resolves the real token pool and returns only measured pool candles', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json(poolResponse()))
    .mockResolvedValueOnce(json({ data: { attributes: { ohlcv_list: [
      [time, 0.001, 0.0012, 0.0009, 0.0011, 42],
    ] } } }));
  vi.stubGlobal('fetch', fetcher);
  const snapshot = await getGeckoChartHistory(mint, '15m', 10);
  expect(snapshot).toMatchObject({
    address: mint, poolAddress: pool, market: 'pool', source: 'geckoterminal-pool-ohlcv',
    candles: [{ time, open: 0.001, close: 0.0011, volume: null, volumeUsd: 42 }],
  });
  const url = new URL(fetcher.mock.calls[1][0]);
  expect(url.pathname).toContain(`/pools/${pool}/ohlcv/minute`);
  expect(url.searchParams.get('aggregate')).toBe('15');
  expect(url.searchParams.get('token')).toBe('base');
  expect(url.searchParams.get('currency')).toBe('usd');
});

it('rejects a pool whose base and quote tokens do not match the mint', async () => {
  const fetcher = vi.fn().mockResolvedValue(json(poolResponse('solana_unrelated')));
  vi.stubGlobal('fetch', fetcher);
  expect(await getGeckoChartHistory(mint, '15m', 10)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('never converts a public-provider rate limit into invented candles', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '30' } }));
  vi.stubGlobal('fetch', fetcher);
  expect(await getGeckoChartHistory(mint, '15m', 10)).toBeNull();
  expect(await getGeckoChartHistory(mint, '15m', 10)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('reuses a recent measured OHLCV response and marks it stale on a later rate limit', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(poolResponse()))
    .mockResolvedValueOnce(json({ data: { attributes: { ohlcv_list: [
      [time, 0.001, 0.0012, 0.0009, 0.0011, 42],
    ] } } }))
    .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '30' } }));
  vi.stubGlobal('fetch', fetcher);
  expect((await getGeckoChartHistory(mint, '15m', 10))?.status).toBe('measured');
  expect((await getGeckoChartHistory(mint, '15m', 2))?.status).toBe('measured');
  expect(fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(31_000);
  const stale = await getGeckoChartHistory(mint, '15m', 10);
  expect(stale?.status).toBe('stale');
  expect(stale?.candles[0].close).toBe(0.0011);
  expect(fetcher).toHaveBeenCalledTimes(3);
});
