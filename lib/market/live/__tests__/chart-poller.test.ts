import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/server/env', () => ({ env: { BIRDEYE_API_KEY: 'test-key' } }));
vi.mock('@/lib/server/logger', () => ({ logger: { warn: vi.fn() } }));
vi.mock('@/lib/market/chart-history', () => ({ getChartHistory: vi.fn() }));
vi.mock('../chart-stream', () => ({ publishPolledCandle: vi.fn().mockReturnValue({ source: 'birdeye-ohlcv-rest' }) }));
import { getChartHistory } from '@/lib/market/chart-history';
import { publishPolledCandle } from '../chart-stream';
import { ChartPoller } from '../chart-poller';

const mints = [
  'So11111111111111111111111111111111111111112',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
];
const targets = mints.map(mint => ({ mint, timeframe: '1m' as const }));
const snapshot = (address: string) => ({ address, timeframe: '1m', status: 'measured', observedAt: Date.now(),
  candles: [{ time: 60, open: 1, high: 2, low: 1, close: 2, volume: 3, volumeUsd: 6 }] });
afterEach(() => { vi.clearAllMocks(); });

it('polls at most two demanded charts per tick and rotates the remaining chart', async () => {
  vi.mocked(getChartHistory).mockImplementation(async mint => snapshot(mint) as any);
  const poller = new ChartPoller();
  poller.setTargets(targets);
  poller.start();
  await vi.waitFor(() => expect(getChartHistory).toHaveBeenCalledTimes(2));
  expect(getChartHistory).toHaveBeenNthCalledWith(1, mints[0], '1m', 2);
  expect(getChartHistory).toHaveBeenNthCalledWith(2, mints[1], '1m', 2);
  await poller.tick();
  expect(getChartHistory).toHaveBeenNthCalledWith(3, mints[2], '1m', 2);
  expect(publishPolledCandle).toHaveBeenCalledTimes(4);
  expect(poller.getHealth()).toMatchObject({ active: true, targetCount: 3, published: 4 });
  poller.stop();
});

it('does not broadcast stale provider responses or poll after stop', async () => {
  vi.mocked(getChartHistory).mockResolvedValue({ ...snapshot(mints[0]), status: 'stale', reason: 'rate limited' } as any);
  const poller = new ChartPoller();
  poller.setTargets([targets[0]]); poller.start();
  await vi.waitFor(() => expect(getChartHistory).toHaveBeenCalledOnce());
  expect(publishPolledCandle).not.toHaveBeenCalled();
  expect(poller.getHealth().lastError).toBe('rate limited');
  poller.stop(); await poller.tick();
  expect(getChartHistory).toHaveBeenCalledOnce();
});
