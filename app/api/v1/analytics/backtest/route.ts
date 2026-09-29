import { NextResponse } from 'next/server';
import { isSolanaMint, isChartTimeframe, type ChartTimeframe } from '@/lib/market/chart-model';
import { getChartHistory } from '@/lib/market/chart-history';
import { runMeasuredBacktest } from '@/lib/analytics/measured-backtest';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { body = {}; }
  const mint = body.mint;
  const timeframe = body.timeframe ?? '1h';
  const costPerSidePct = body.costPerSidePct ?? 0.3;
  if (typeof mint !== 'string' || !isSolanaMint(mint) || !isChartTimeframe(timeframe)
    || !['15m', '1h', '4h', '1d'].includes(timeframe)
    || typeof costPerSidePct !== 'number' || !Number.isFinite(costPerSidePct)
    || costPerSidePct < 0 || costPerSidePct > 5) {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'A valid mint, timeframe and per-side cost are required.' } }, { status: 400 });
  }
  try {
    const history = await getChartHistory(mint, timeframe as ChartTimeframe, 500);
    const result = runMeasuredBacktest(history.candles, costPerSidePct);
    return NextResponse.json({ mint, timeframe, costPerSidePct, market: history.market,
      poolAddress: history.poolAddress ?? null, observedAt: history.observedAt,
      freshness: history.status, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: { code: 'HISTORY_UNAVAILABLE', message: 'Measured candle history is temporarily unavailable.' } }, { status: 503 });
  }
}
