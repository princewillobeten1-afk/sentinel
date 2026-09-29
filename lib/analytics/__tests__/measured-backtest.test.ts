import { describe, expect, it } from 'vitest';
import { runMeasuredBacktest } from '../measured-backtest';
import type { ChartCandle } from '@/lib/market/chart-model';

const candles = (closes: number[]): ChartCandle[] => closes.map((close, index) => ({
  time: 1_700_000_000 + index * 3600, open: close, high: close,
  low: close, close, volume: null, volumeUsd: null,
}));

describe('measured candle backtest', () => {
  it('declines to claim performance with sparse candle history', () => {
    expect(runMeasuredBacktest(candles(Array(20).fill(1)), 0.3)).toMatchObject({ status: 'insufficient', trades: [] });
  });

  it('ignores the newest potentially open candle', () => {
    const history = candles([
      ...Array(24).fill(1), ...Array(10).fill(2), ...Array(10).fill(0.5), 1,
    ]);
    const altered = [...history.slice(0, -1), { ...history[history.length - 1], close: 10000 }];
    expect(runMeasuredBacktest(history, 0.3)).toEqual(runMeasuredBacktest(altered, 0.3));
  });

  it('never returns a success metric without a closed trade', () => {
    const result = runMeasuredBacktest(candles(Array(40).fill(1)), 0.3);
    expect(result).toMatchObject({ status: 'measured', closedTrades: 0, winRatePct: null, compoundedReturnPct: null });
  });
});
