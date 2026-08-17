import { describe, expect, it } from 'vitest';
import { generateCandleRange, TIMEFRAME_SECONDS } from '../mock-ohlcv';

describe('generateCandleRange', () => {
  it('is deterministic across repeated calls with identical params', () => {
    const a = generateCandleRange('SENT', '15m', { count: 50, beforeTimeSeconds: 1_800_000_000 });
    const b = generateCandleRange('SENT', '15m', { count: 50, beforeTimeSeconds: 1_800_000_000 });
    expect(a).toEqual(b);
  });

  it('produces different candles for a different symbol', () => {
    const a = generateCandleRange('SENT', '15m', { count: 20, beforeTimeSeconds: 1_800_000_000 });
    const b = generateCandleRange('OTHER', '15m', { count: 20, beforeTimeSeconds: 1_800_000_000 });
    expect(a.candles).not.toEqual(b.candles);
  });

  it('produces different candles for a different timeframe', () => {
    const a = generateCandleRange('SENT', '15m', { count: 20, beforeTimeSeconds: 1_800_000_000 });
    const b = generateCandleRange('SENT', '1h', { count: 20, beforeTimeSeconds: 1_800_000_000 });
    expect(a.candles).not.toEqual(b.candles);
  });

  it('returns count candles evenly spaced by the timeframe step', () => {
    const { candles } = generateCandleRange('SENT', '5m', { count: 30, beforeTimeSeconds: 1_800_000_000 });
    expect(candles).toHaveLength(30);
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time - candles[i - 1].time).toBe(TIMEFRAME_SECONDS['5m']);
    }
  });

  it('respects the OHLC invariants for every candle', () => {
    const { candles } = generateCandleRange('SENT', '1h', { count: 200, beforeTimeSeconds: 1_800_000_000 });
    for (const candle of candles) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      expect(candle.low).toBeGreaterThan(0);
      expect(candle.open).toBeGreaterThan(0);
      expect(candle.close).toBeGreaterThan(0);
      expect(candle.volume).toBeGreaterThanOrEqual(0);
    }
  });

  it('all candles are strictly before beforeTimeSeconds', () => {
    const beforeTimeSeconds = 1_800_000_000;
    const { candles } = generateCandleRange('SENT', '15m', { count: 40, beforeTimeSeconds });
    for (const candle of candles) {
      expect(candle.time).toBeLessThan(beforeTimeSeconds);
    }
  });

  it('has no gap or overlap when paging to an older range via beforeTimeSeconds', () => {
    const stepSeconds = TIMEFRAME_SECONDS['15m'];
    const page1 = generateCandleRange('SENT', '15m', { count: 50, beforeTimeSeconds: 1_800_000_000 });
    const oldestOfPage1 = page1.candles[0].time;

    const page2 = generateCandleRange('SENT', '15m', { count: 50, beforeTimeSeconds: oldestOfPage1 });
    const newestOfPage2 = page2.candles[page2.candles.length - 1].time;

    expect(newestOfPage2 + stepSeconds).toBe(oldestOfPage1);

    // No timestamp overlap between the two pages.
    const page1Times = new Set(page1.candles.map((c) => c.time));
    for (const candle of page2.candles) {
      expect(page1Times.has(candle.time)).toBe(false);
    }
  });

  it('produces byte-identical candles for an overlapping index regardless of which page fetched it', () => {
    // The same absolute candle time, fetched as part of two different range
    // requests, must come out identical — proving no request-scoped state.
    const wide = generateCandleRange('SENT', '15m', { count: 100, beforeTimeSeconds: 1_800_000_000 });
    const targetTime = wide.candles[40].time;
    const narrow = generateCandleRange('SENT', '15m', { count: 1, beforeTimeSeconds: targetTime + TIMEFRAME_SECONDS['15m'] });
    expect(narrow.candles[0]).toEqual(wide.candles[40]);
  });

  it('hasMore is true when far from genesis and false once genesis is reached', () => {
    const recent = generateCandleRange('SENT', '1d', { count: 10, beforeTimeSeconds: 1_800_000_000 });
    expect(recent.hasMore).toBe(true);

    // 2023-01-01 is the generator's genesis; ask for a huge range starting
    // right after it so the result gets clamped against the floor.
    const nearGenesis = generateCandleRange('SENT', '1d', {
      count: 100_000,
      beforeTimeSeconds: Date.parse('2023-02-01T00:00:00Z') / 1000,
    });
    expect(nearGenesis.hasMore).toBe(false);
  });

  it('returns an empty range with count 0', () => {
    const { candles } = generateCandleRange('SENT', '15m', { count: 0, beforeTimeSeconds: 1_800_000_000 });
    expect(candles).toHaveLength(0);
  });

  it('falls back to the 15m step for an unknown timeframe', () => {
    const known = generateCandleRange('SENT', '15m', { count: 5, beforeTimeSeconds: 1_800_000_000 });
    const unknown = generateCandleRange('SENT', 'bogus', { count: 5, beforeTimeSeconds: 1_800_000_000 });
    expect(unknown.candles.map((c) => c.time)).toEqual(known.candles.map((c) => c.time));
  });
});
