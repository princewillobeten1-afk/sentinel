import { describe, expect, it } from 'vitest';
import type { ChartCandle } from '../chart-model';
import { barsAfterLoaded, toKLineData, toKLineDataList } from '../kline-adapter';

const candle = (time: number, overrides: Partial<ChartCandle> = {}): ChartCandle => ({
  time, open: 1, high: 3, low: 0.5, close: 2, volume: 12, volumeUsd: 24, ...overrides,
});

describe('KLineChart v10 data adapter', () => {
  it('converts Unix seconds to milliseconds and supplies measured OHLCV and turnover', () => {
    expect(toKLineData(candle(1_790_089_560))).toEqual({
      timestamp: 1_790_089_560_000, open: 1, high: 3, low: 0.5,
      close: 2, volume: 12, turnover: 24,
    });
  });

  it('does not turn unknown optional metrics into measured zero', () => {
    expect(toKLineData(candle(60, { volume: null, volumeUsd: null }))).toEqual({
      timestamp: 60_000, open: 1, high: 3, low: 0.5, close: 2,
    });
    expect(toKLineData(candle(60, { volume: 0, volumeUsd: 0 }))).toMatchObject({
      volume: 0, turnover: 0,
    });
  });

  it('uses measured USD volume for a pool chart without calling it token volume', () => {
    expect(toKLineData(candle(60, { volume: null, volumeUsd: 24 }), 'usd')).toMatchObject({
      timestamp: 60_000, volume: 24, turnover: 24,
    });
    expect(toKLineData(candle(60, { volume: null, volumeUsd: null }), 'usd')).not.toHaveProperty('volume');
  });

  it('sorts history and retains the latest revision of each timestamp', () => {
    expect(toKLineDataList([
      candle(120), candle(60), candle(120, { close: 2.5, volumeUsd: 30 }),
    ])).toEqual([
      toKLineData(candle(60)),
      toKLineData(candle(120, { close: 2.5, volumeUsd: 30 })),
    ]);
  });

  it('replays only a changed last bar and newer bars, one callback value at a time', () => {
    const loaded = toKLineDataList([candle(60), candle(120)]);
    const incoming = toKLineDataList([
      candle(60), candle(120, { volumeUsd: 25 }), candle(180),
    ]);
    expect(barsAfterLoaded(loaded, incoming)).toEqual(incoming.slice(1));
    expect(barsAfterLoaded(loaded, loaded)).toEqual([]);
    expect(barsAfterLoaded([], incoming)).toEqual(incoming);
  });
});
