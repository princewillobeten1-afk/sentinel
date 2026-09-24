/** Browser-safe chart contract. Prices are USD; volume is base-token units. */
export const CHART_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type ChartTimeframe = typeof CHART_TIMEFRAMES[number];
export const CHART_SECONDS: Record<ChartTimeframe, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
export interface ChartCandle {
  time: number; open: number; high: number; low: number; close: number;
  /** Unknown volume must not become a zero-volume bar. */
  volume: number | null;
  volumeUsd: number | null;
}
export interface ChartSnapshot {
  address: string;
  chain: 'solana';
  timeframe: ChartTimeframe;
  currency: 'usd';
  market: 'token-aggregate';
  candles: ChartCandle[];
  hasMore: boolean;
  oldestTime: number | null;
  observedAt: number;
  source: 'birdeye-ohlcv-v3';
  status: 'measured' | 'stale';
  reason?: string;
}
export interface ChartFrame {
  address: string;
  timeframe: ChartTimeframe;
  candle: ChartCandle;
  observedAt: number;
  source: 'birdeye-price-ws' | 'birdeye-ohlcv-rest';
}
export const isChartTimeframe = (value: unknown): value is ChartTimeframe => CHART_TIMEFRAMES.includes(value as ChartTimeframe);
export const isSolanaMint = (value: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export function parseProviderCandle(row: any, timeframe: ChartTimeframe): ChartCandle | null {
  if (!row || typeof row !== 'object') return null;
  const time = numeric(row.unix_time ?? row.unixTime);
  const [open, high, low, close] = [row.o, row.h, row.l, row.c].map(numeric);
  if (time === null || !Number.isInteger(time) || time <= 0 || time % CHART_SECONDS[timeframe] !== 0
    || open === null || high === null || low === null || close === null
    || Math.min(open, high, low, close) <= 0 || low > Math.min(open, close) || high < Math.max(open, close)) return null;
  return { time, open, high, low, close, volume: numeric(row.v), volumeUsd: numeric(row.v_usd ?? row.vUsd) };
}

export function parseChartTarget(target: string): { mint: string; timeframe: ChartTimeframe } | null {
  const [mint, timeframe, extra] = target.split(':');
  return extra === undefined && isSolanaMint(mint) && isChartTimeframe(timeframe) ? { mint, timeframe } : null;
}

/** Full provider candles replace previous revisions. Never add cumulative volume twice. */
export function mergeChartCandles(current: ChartCandle[], incoming: ChartCandle[], replace = true): ChartCandle[] {
  const rows = new Map(current.map(candle => [candle.time, candle]));
  for (const candle of incoming) if (replace || !rows.has(candle.time)) rows.set(candle.time, candle);
  return [...rows.values()].sort((a, b) => a.time - b.time);
}

export function parseChartFrame(value: unknown): ChartFrame | null {
  const frame = value as ChartFrame | null;
  if (!frame || typeof frame.address !== 'string' || !isSolanaMint(frame.address) || !isChartTimeframe(frame.timeframe)
    || (frame.source !== 'birdeye-price-ws' && frame.source !== 'birdeye-ohlcv-rest')
    || !Number.isFinite(frame.observedAt) || frame.observedAt <= 0) return null;
  const c = frame.candle;
  if (!c) return null;
  const candle = parseProviderCandle({ unixTime: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume, vUsd: c.volumeUsd }, frame.timeframe);
  return candle ? { ...frame, candle } : null;
}

/** Keep tiny-token candles visible without rounding them to $0.00. */
export function chartPrecision(price: number): { precision: number; minMove: number } {
  const precision = price > 0 ? Math.min(16, Math.max(2, 3 - Math.floor(Math.log10(price)))) : 8;
  return { precision, minMove: 10 ** -precision };
}

export function parseChartSnapshot(value: unknown, address: string, timeframe: ChartTimeframe): ChartSnapshot | null {
  const s = value as ChartSnapshot | null;
  if (!s || s.address !== address || s.timeframe !== timeframe || s.chain !== 'solana' || s.currency !== 'usd'
    || s.market !== 'token-aggregate' || s.source !== 'birdeye-ohlcv-v3' || !Number.isFinite(s.observedAt)
    || s.observedAt <= 0 || !['measured', 'stale'].includes(s.status) || !Array.isArray(s.candles)
    || typeof s.hasMore !== 'boolean') return null;
  const candles = s.candles.map(c => c && parseProviderCandle({ unixTime: c.time, o: c.open, h: c.high,
    l: c.low, c: c.close, v: c.volume, vUsd: c.volumeUsd }, timeframe));
  if (candles.some(c => !c)) return null;
  return { ...s, candles: mergeChartCandles([], candles as ChartCandle[]) };
}
