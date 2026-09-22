import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/market/live/card-cache', () => ({ updateTokenCard: vi.fn() }));
vi.mock('@/lib/market/lifecycle/lifecycle-worker', () => ({ lifecycleWorker: {} }));
import { buildBirdeyeSubscriptions } from '../birdeye-client';
import { getChartDemand, getChartFrame, noteChartTopics, onChartFrame, publishBirdeyeCandle, resetChartStreamForTests } from '../chart-stream';
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
