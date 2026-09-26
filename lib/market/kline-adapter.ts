import type { KLineData } from 'klinecharts';
import type { ChartCandle } from './chart-model';

export type PriceDisplayUnit = 'price' | 'mcap';

/** Sentinel candles use Unix seconds; KLineChart v10 requires milliseconds.
 * A pool-only feed has measured USD volume but no token-unit volume. */
export function toKLineData(
  candle: ChartCandle,
  volumeUnit: 'token' | 'usd' = 'token',
  displayUnit: PriceDisplayUnit = 'price',
  supply = 1_000_000_000
): KLineData {
  const multiplier = displayUnit === 'mcap' && supply > 0 ? supply : 1;
  const chartVolume = volumeUnit === 'usd' ? candle.volumeUsd : candle.volume;
  return {
    timestamp: candle.time * 1000,
    open: candle.open * multiplier,
    high: candle.high * multiplier,
    low: candle.low * multiplier,
    close: candle.close * multiplier,
    ...(chartVolume === null ? {} : { volume: chartVolume }),
    // USD notional is the quote-currency turnover. Unknown values stay absent.
    ...(candle.volumeUsd === null ? {} : { turnover: candle.volumeUsd }),
  };
}

/** KLineChart expects ascending, unique timestamps for both history and live replay. */
export function toKLineDataList(
  candles: ChartCandle[],
  volumeUnit: 'token' | 'usd' = 'token',
  displayUnit: PriceDisplayUnit = 'price',
  supply = 1_000_000_000
): KLineData[] {
  const byTimestamp = new Map(candles.map(candle => {
    const bar = toKLineData(candle, volumeUnit, displayUnit, supply);
    return [bar.timestamp, bar] as const;
  }));
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function sameKLineData(a: KLineData, b: KLineData): boolean {
  return a.timestamp === b.timestamp && a.open === b.open && a.high === b.high
    && a.low === b.low && a.close === b.close && a.volume === b.volume && a.turnover === b.turnover;
}

/** One bar per callback: revise the last bar, then append any newer bars. */
export function barsAfterLoaded(loaded: KLineData[], incoming: KLineData[]): KLineData[] {
  const last = loaded[loaded.length - 1];
  if (!last) return incoming;
  return incoming.filter(bar => bar.timestamp > last.timestamp
    || (bar.timestamp === last.timestamp && !sameKLineData(bar, last)));
}
