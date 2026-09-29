import type { ChartCandle } from '@/lib/market/chart-model';

export interface BacktestTrade {
  entryTime: number; exitTime: number; entryPrice: number; exitPrice: number; netReturnPct: number;
}

/** Long-only 5/20 SMA crossover. A signal at close i executes at open i+1. */
export function runMeasuredBacktest(candles: ChartCandle[], costPerSidePct: number) {
  const sorted = [...candles]
    .filter(c => Number.isFinite(c.time) && c.open > 0 && c.close > 0)
    .sort((a, b) => a.time - b.time);
  const bars = sorted.filter((c, i) => i === 0 || c.time !== sorted[i - 1].time).slice(0, -1);
  if (bars.length < 30 || !Number.isFinite(costPerSidePct) || costPerSidePct < 0 || costPerSidePct > 5) {
    return { status: 'insufficient' as const, bars: bars.length, trades: [] as BacktestTrade[] };
  }
  const average = (end: number, span: number) => {
    let sum = 0;
    for (let i = end - span + 1; i <= end; i++) sum += bars[i].close;
    return sum / span;
  };
  let entry: { time: number; price: number } | null = null;
  const trades: BacktestTrade[] = [];
  for (let i = 20; i < bars.length - 1; i++) {
    const short = average(i, 5);
    const long = average(i, 20);
    const previousShort = average(i - 1, 5);
    const previousLong = average(i - 1, 20);
    const next = bars[i + 1];
    if (!entry && previousShort <= previousLong && short > long) {
      entry = { time: next.time, price: next.open };
    } else if (entry && previousShort >= previousLong && short < long) {
      const gross = next.open / entry.price;
      const net = gross * (1 - costPerSidePct / 100) ** 2;
      trades.push({ entryTime: entry.time, exitTime: next.time, entryPrice: entry.price,
        exitPrice: next.open, netReturnPct: (net - 1) * 100 });
      entry = null;
    }
  }
  let equity = 1;
  let peak = 1;
  let maxDrawdownPct = 0;
  for (const trade of trades) {
    equity *= 1 + trade.netReturnPct / 100;
    peak = Math.max(peak, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, (peak - equity) / peak * 100);
  }
  return {
    status: 'measured' as const,
    bars: bars.length,
    firstTime: bars[0].time,
    lastTime: bars[bars.length - 1].time,
    trades,
    closedTrades: trades.length,
    openPositionExcluded: entry !== null,
    winRatePct: trades.length ? trades.filter(t => t.netReturnPct > 0).length / trades.length * 100 : null,
    compoundedReturnPct: trades.length ? (equity - 1) * 100 : null,
    maxClosedTradeDrawdownPct: trades.length ? maxDrawdownPct : null,
  };
}
