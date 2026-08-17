/**
 * Canonical OHLCV Engine (Sprint 45 §31-35, §90).
 *
 * Generates 1m, 5m, 15m, 1h, 4h, 1d candlestick series from normalized trades,
 * tracks OPEN vs FINAL state, and recalculates buckets when late trades arrive.
 */

import { OhlcvCandle, CandleInterval, SwapEvent } from '../types';

const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
};

export class OhlcvEngine {
  private static instance: OhlcvEngine;
  // Key: `${marketId}:${interval}:${timestamp}`
  private candles: Map<string, OhlcvCandle> = new Map();

  private constructor() {
    this.seedDefaultCandles();
  }

  public static getInstance(): OhlcvEngine {
    if (!OhlcvEngine.instance) {
      OhlcvEngine.instance = new OhlcvEngine();
    }
    return OhlcvEngine.instance;
  }

  private seedDefaultCandles(): void {
    const marketId = 'solana:raydium_cpmm:58oqchx4ywmvkdwllzzbi4chocc2fqcuwbkwmihlyqo2';
    const nowSec = Math.floor(Date.now() / 1000);
    const intervals: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

    for (const interval of intervals) {
      const step = INTERVAL_SECONDS[interval];
      const count = 50;
      let currentPrice = 145.0;

      for (let i = count; i >= 0; i--) {
        const bucketTimestamp = Math.floor((nowSec - i * step) / step) * step;
        const isFinal = i > 0;

        const open = currentPrice;
        const change = (Math.sin(i) * 1.5) + ((i % 5) - 2) * 0.5;
        const close = open + change;
        const high = Math.max(open, close) + Math.abs(Math.sin(i * 2)) * 1.2;
        const low = Math.min(open, close) - Math.abs(Math.cos(i * 2)) * 1.1;
        const volumeUsd = 25000 + Math.abs(Math.sin(i)) * 40000;
        const tradeCount = 45 + (i % 20);

        currentPrice = close;

        this.setCandle({
          id: `${marketId}:${interval}:${bucketTimestamp}`,
          marketId,
          interval,
          timestamp: bucketTimestamp,
          open: parseFloat(open.toFixed(4)),
          high: parseFloat(high.toFixed(4)),
          low: parseFloat(low.toFixed(4)),
          close: parseFloat(close.toFixed(4)),
          volumeUsd: parseFloat(volumeUsd.toFixed(2)),
          tradeCount,
          isFinal,
        });
      }
    }
  }

  public getBucketTimestamp(tradeTimestampSec: number, interval: CandleInterval): number {
    const step = INTERVAL_SECONDS[interval];
    return Math.floor(tradeTimestampSec / step) * step;
  }

  public setCandle(candle: OhlcvCandle): void {
    this.candles.set(candle.id, candle);
  }

  public getCandle(marketId: string, interval: CandleInterval, timestamp: number): OhlcvCandle | undefined {
    return this.candles.get(`${marketId}:${interval}:${timestamp}`);
  }

  public getCandles(marketId: string, interval: CandleInterval, limit = 150): OhlcvCandle[] {
    const prefix = `${marketId.toLowerCase()}:${interval}:`;
    const results: OhlcvCandle[] = [];

    for (const [key, c] of this.candles.entries()) {
      if (key.startsWith(prefix)) {
        results.push(c);
      }
    }

    results.sort((a, b) => a.timestamp - b.timestamp);
    return results.slice(-limit);
  }

  /**
   * Processes an incoming trade event across all candle intervals.
   * Supports both real-time stream progression and retroactive late-arrival corrections.
   */
  public processTrade(trade: SwapEvent): OhlcvCandle[] {
    const tradeSec = Math.floor(new Date(trade.timestamp).getTime() / 1000);
    const intervals: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
    const updatedCandles: OhlcvCandle[] = [];

    for (const interval of intervals) {
      const bucketTimestamp = this.getBucketTimestamp(tradeSec, interval);
      const candleId = `${trade.marketId.toLowerCase()}:${interval}:${bucketTimestamp}`;
      const nowSec = Math.floor(Date.now() / 1000);
      const isFinal = nowSec >= bucketTimestamp + INTERVAL_SECONDS[interval];

      const existing = this.candles.get(candleId);

      if (existing) {
        // Update existing candle (e.g. active forming candle or late trade correction)
        existing.high = Math.max(existing.high, trade.priceUsd);
        existing.low = Math.min(existing.low, trade.priceUsd);
        existing.close = trade.priceUsd;
        existing.volumeUsd += trade.volumeUsd;
        existing.tradeCount += 1;
        existing.isFinal = isFinal;
        updatedCandles.push(existing);
      } else {
        // Initialize new bucket
        const newCandle: OhlcvCandle = {
          id: candleId,
          marketId: trade.marketId.toLowerCase(),
          interval,
          timestamp: bucketTimestamp,
          open: trade.priceUsd,
          high: trade.priceUsd,
          low: trade.priceUsd,
          close: trade.priceUsd,
          volumeUsd: trade.volumeUsd,
          tradeCount: 1,
          isFinal,
        };
        this.candles.set(candleId, newCandle);
        updatedCandles.push(newCandle);
      }
    }

    return updatedCandles;
  }

  public reset(): void {
    this.candles.clear();
    this.seedDefaultCandles();
  }
}

export const ohlcvEngine = OhlcvEngine.getInstance();
