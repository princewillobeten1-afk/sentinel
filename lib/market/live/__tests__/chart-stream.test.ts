import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/market/live/card-cache', () => ({ updateTokenCard: vi.fn() }));
vi.mock('@/lib/market/lifecycle/lifecycle-worker', () => ({ lifecycleWorker: {} }));
import { buildBirdeyeSubscriptions } from '../birdeye-client';
import { getChartDemand, getChartFrame, noteChartTopics, onChartFrame, publishBirdeyeCandle,
  publishPolledCandle, publishQuickNodeTrade, resetChartStreamForTests } from '../chart-stream';
const mint = 'So11111111111111111111111111111111111111112';
const topic = `token.ohlcv:${mint}:15m`;
const time = Math.floor(Date.now() / 900000) * 900;
const wire = (unixTime = time) => ({ type: 'PRICE_DATA', data: { address: mint, type: '15m', currency: 'usd', eventType: 'ohlcv', unixTime, o: 2, h: 4, l: 1, c: 3, v: 100 } });
beforeEach(() => resetChartStreamForTests());
it('retains visible mints and requested chart intervals in one atomic query', () => {
  const messages = buildBirdeyeSubscriptions(['OtherMint', mint], [{ mint, timeframe: '15m' }]);
  const query = (messages[0].data as any).query;
  expect(query).toContain(`address = ${mint} AND chartType = 15m`);
  expect(query).toContain('address = OtherMint AND chartType = 1m');
  expect(query).toContain(`address = ${mint} AND chartType = 1m`);
  expect(messages.filter(m => m.type === 'SUBSCRIBE_PRICE')).toHaveLength(1);
});
it('reference-counts chart demand and retains the cached frame for replay', () => {
  noteChartTopics([topic], 1); noteChartTopics([topic], 1);
  expect(getChartDemand()).toEqual([{ mint, timeframe: '15m' }]);
  noteChartTopics([topic], -1); expect(getChartDemand()).toHaveLength(1);
  const listener = vi.fn(); onChartFrame(listener);
  const frame = publishBirdeyeCandle(wire(), mint);
  expect(frame?.candle).toMatchObject({ open: 2, high: 4, low: 1, close: 3, volume: 100, volumeUsd: null });
  expect(getChartFrame(`${mint}:15m`)).toEqual(frame); expect(listener).toHaveBeenCalledOnce();
  noteChartTopics([topic], -1); expect(getChartDemand()).toEqual([]);
  expect(publishBirdeyeCandle(wire(), mint)).toBeNull();
});
it('rejects wrong interval, older bars, bad OHLC, future bars, and scaled prices', () => {
  noteChartTopics([topic], 1); publishBirdeyeCandle(wire(), mint);
  expect(publishBirdeyeCandle(wire(time - 900), mint)).toBeNull();
  expect(publishBirdeyeCandle(wire(time + 900), mint)).toBeNull();
  for (const change of [{ type: '1m' }, { h: 0 }, { currency: 'sol' }, { isScaled: true }]) {
    const message = wire(); Object.assign(message.data, change); expect(publishBirdeyeCandle(message, mint)).toBeNull();
  }
});
it('fans out only measured REST candles and does not overwrite a fresh WebSocket bar', () => {
  noteChartTopics([topic], 1);
  const observedAt = Date.now();
  const snapshot = { address: mint, timeframe: '15m' as const, chain: 'solana' as const, currency: 'usd' as const,
    market: 'token-aggregate' as const, source: 'birdeye-ohlcv-v3' as const,
    observedAt, status: 'measured' as const, hasMore: false, oldestTime: time,
    candles: [{ time, open: 2, high: 4, low: 1, close: 3, volume: 100, volumeUsd: 300 }] };
  const listener = vi.fn(); onChartFrame(listener);
  expect(publishPolledCandle(snapshot)?.source).toBe('birdeye-ohlcv-rest');
  expect(publishQuickNodeTrade(mint, '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq', 5, observedAt + 1)).toBe(0);
  expect(getChartFrame(`${mint}:15m`)?.market).toBe('token-aggregate');
  expect(listener).toHaveBeenCalledOnce();
  expect(publishPolledCandle({ ...snapshot, status: 'stale' })).toBeNull();
  expect(publishPolledCandle({ ...snapshot, currency: 'sol' } as any)).toBeNull();
  expect(publishPolledCandle({ ...snapshot, market: 'pool-specific' } as any)).toBeNull();
  expect(publishPolledCandle({ ...snapshot, market: 'pool',
    poolAddress: '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq', source: 'geckoterminal-pool-ohlcv' })).toBeNull();
  const wsFrame = publishBirdeyeCandle(wire(), mint);
  expect(wsFrame?.source).toBe('birdeye-price-ws');
  expect(publishPolledCandle({ ...snapshot, observedAt: observedAt + 1000 })).toBeNull();
  expect(getChartFrame(`${mint}:15m`)?.source).toBe('birdeye-price-ws');
});
it('labels Bitquery REST reconciliation without treating it as a live socket', () => {
  noteChartTopics([topic], 1);
  const snapshot = { address: mint, timeframe: '15m' as const, chain: 'solana' as const, currency: 'usd' as const,
    market: 'token-aggregate' as const, source: 'bitquery-token-ohlcv' as const,
    observedAt: Date.now(), status: 'measured' as const, hasMore: false, oldestTime: time,
    candles: [{ time, open: 2, high: 4, low: 1, close: 3, volume: null, volumeUsd: 30 }] };
  expect(publishPolledCandle(snapshot)).toMatchObject({ source: 'bitquery-ohlcv-rest', candle: { volume: null, volumeUsd: 30 } });
});
it('streams provisional pool prices without inventing volume and reconciles through the same pool', () => {
  const poolAddress = '844a7Qqt5h8La7w3ZBqxUMbC6Hzoan4JWijeLqXJd6tq';
  const observedAt = Date.now();
  noteChartTopics([topic], 1);
  expect(publishQuickNodeTrade(mint, poolAddress, 2, observedAt)).toBe(1);
  expect(publishQuickNodeTrade(mint, poolAddress, 3, observedAt + 1)).toBe(1);
  expect(getChartFrame(`${mint}:15m`)).toMatchObject({ market: 'pool', poolAddress,
    source: 'quicknode-pool-ws', provisional: true,
    candle: { open: 2, high: 3, low: 2, close: 3, volume: null, volumeUsd: null } });
  const snapshot = { address: mint, timeframe: '15m' as const, chain: 'solana' as const, currency: 'usd' as const,
    market: 'pool' as const, poolAddress, source: 'geckoterminal-pool-ohlcv' as const,
    observedAt: observedAt + 2, status: 'measured' as const, hasMore: false, oldestTime: time,
    candles: [{ time, open: 1, high: 4, low: 1, close: 3, volume: null, volumeUsd: 12 }] };
  expect(publishPolledCandle(snapshot)).toBeNull();
  resetChartStreamForTests();
  noteChartTopics([topic], 1);
  expect(publishPolledCandle(snapshot)).toMatchObject({ market: 'pool', poolAddress,
    source: 'geckoterminal-pool-rest', candle: { volumeUsd: 12 } });
});
