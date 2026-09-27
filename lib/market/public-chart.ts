import { isChartTimeframe, isSolanaMint, mergeChartCandles, parseProviderCandle,
  type ChartCandle, type ChartTimeframe } from './chart-model';

/** Public chart transport. Infrastructure identity never crosses this boundary. */
export interface PublicChartSeries {
  seriesId: string;
  market: 'token-aggregate' | 'pool';
  poolAddress?: string;
  priority: number;
  source?: string;
  liveSource?: string;
}
export interface PublicChartSnapshot extends PublicChartSeries {
  address: string; chain: 'solana'; timeframe: ChartTimeframe; currency: 'usd';
  candles: ChartCandle[]; hasMore: boolean; oldestTime: number | null;
  observedAt: number; status: 'measured' | 'stale'; reason?: string;
  deliveryMode: 'poll';
}
export interface PublicChartFrame extends PublicChartSeries {
  address: string; timeframe: ChartTimeframe; candle: ChartCandle;
  observedAt: number; deliveryMode: 'stream' | 'poll'; provisional: boolean;
}
function validSeries(value: PublicChartSeries): boolean {
  return typeof value.seriesId === 'string' && /^[a-f0-9]{24}$/.test(value.seriesId)
    && Number.isFinite(value.priority) && value.priority >= 0
    && (value.market === 'token-aggregate' || value.market === 'pool' && isSolanaMint(value.poolAddress ?? ''));
}
function candle(value: any, timeframe: ChartTimeframe): ChartCandle | null {
  return value ? parseProviderCandle(value, timeframe) : null;
}
export function parsePublicChartFrame(value: unknown): PublicChartFrame | null {
  const f = value as PublicChartFrame;
  if (!f || !validSeries(f) || !isSolanaMint(f.address ?? '') || !isChartTimeframe(f.timeframe)
    || !['stream', 'poll'].includes(f.deliveryMode) || typeof f.provisional !== 'boolean'
    || !Number.isFinite(f.observedAt) || f.observedAt <= 0) return null;
  const bar = candle(f.candle, f.timeframe);
  return bar ? { ...f, candle: bar } : null;
}
export function parsePublicChartSnapshot(value: unknown, address: string, timeframe: ChartTimeframe): PublicChartSnapshot | null {
  const s = value as PublicChartSnapshot;
  if (!s || !validSeries(s) || s.address !== address || s.timeframe !== timeframe
    || s.chain !== 'solana' || s.currency !== 'usd' || s.deliveryMode !== 'poll'
    || !Number.isFinite(s.observedAt) || s.observedAt <= 0 || !['measured', 'stale'].includes(s.status)
    || typeof s.hasMore !== 'boolean' || !Array.isArray(s.candles)) return null;
  const bars = s.candles.map(c => candle(c, timeframe));
  return bars.some(c => !c) ? null : { ...s, candles: mergeChartCandles([], bars as ChartCandle[]) };
}
