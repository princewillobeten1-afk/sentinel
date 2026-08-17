/**
 * Deterministic mock OHLCV generator (Sprint 31 — Item 12), standing in for
 * a real data feed while a live candle source isn't wired up.
 *
 * Closed-form per candle index, not a continuously-advanced random walk:
 * every candle is derived purely from `(symbol, timeframe, index)` with no
 * dependency on neighboring candles or any server-side memoization. That's
 * what makes arbitrary older ranges (`generateCandleRange` with
 * `beforeTimeSeconds`) independently regenerable and byte-identical across
 * repeated requests — a real cache-free, horizontally-scalable property a
 * stateful walk wouldn't have. The tradeoff is explicit: candles are
 * *visually* continuous (each one's open lands close to the previous one's
 * close, because both come from the same smooth `priceAtIndex` curve) but
 * not *exactly* continuous the way a true tick-by-tick walk would be.
 *
 * `index` and `time` are a stable, pure bijection anchored to the Unix
 * epoch (`index = floor(timeSeconds / stepSeconds)`), independent of when
 * the server happens to evaluate it — the only place real-world "now" enters
 * is picking the latest index when no `beforeTimeSeconds` is given.
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type Timeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

/** Seconds per candle for each supported timeframe. */
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
};

/** No synthetic history before this point — gives `hasMore` a real, eventual false. */
const GENESIS_TIME_SECONDS = Date.parse('2023-01-01T00:00:00Z') / 1000;

function stepSecondsFor(timeframe: string): number {
  return TIMEFRAME_SECONDS[timeframe as Timeframe] ?? TIMEFRAME_SECONDS['15m'];
}

function genesisIndexFor(timeframe: string): number {
  return Math.floor(GENESIS_TIME_SECONDS / stepSecondsFor(timeframe));
}

function hashSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

/** Park-Miller minimal-standard LCG — deterministic given a seed. */
function seededRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function basePriceFor(symbol: string, timeframe: string): number {
  const rand = seededRandom(hashSeed(`${symbol}:${timeframe}:base`));
  return 0.5 + rand() * 50;
}

/** Smooth, closed-form "price curve" a candle's open/close are sampled from. */
function priceAtIndex(symbol: string, timeframe: string, index: number): number {
  const base = basePriceFor(symbol, timeframe);
  const trendRand = seededRandom(hashSeed(`${symbol}:${timeframe}:trend`));
  const amplitude = 0.15 + trendRand() * 0.25;
  const frequency = 0.01 + trendRand() * 0.03;
  const phase = trendRand() * Math.PI * 2;

  const wave = Math.sin(index * frequency + phase) * amplitude;
  const noiseRand = seededRandom(hashSeed(`${symbol}:${timeframe}:${index}:noise`));
  const noise = (noiseRand() - 0.5) * 0.05;

  return Math.max(0.0001, base * (1 + wave + noise));
}

function generateCandleAtIndex(symbol: string, timeframe: string, index: number): Candle {
  const stepSeconds = stepSecondsFor(timeframe);
  const open = priceAtIndex(symbol, timeframe, index);
  const close = priceAtIndex(symbol, timeframe, index + 1);

  const rand = seededRandom(hashSeed(`${symbol}:${timeframe}:${index}:wick`));
  const bodyRange = Math.abs(close - open);
  const wick = bodyRange * 0.3 + Math.max(open, close) * 0.004 * rand();
  const high = Math.max(open, close) + wick * rand();
  const low = Math.max(0.0001, Math.min(open, close) - wick * rand());
  const volume = Math.round((500 + rand() * 50000) * (1 + bodyRange / Math.max(open, 0.0001)));

  return {
    time: index * stepSeconds,
    open,
    high,
    low,
    close,
    volume,
  };
}

export interface GenerateCandleRangeParams {
  /** Number of candles requested. */
  count: number;
  /** When given, returns the `count` candles strictly before this Unix-seconds timestamp. Omit for the most recent candles up to now. */
  beforeTimeSeconds?: number;
}

export interface CandleRangeResult {
  candles: Candle[];
  /** Whether an older page exists (a `before` fetch using `candles[0].time` would return more). */
  hasMore: boolean;
}

/**
 * Returns up to `count` candles, oldest first, ending just before
 * `beforeTimeSeconds` (or ending at "now" if omitted). Pure/stateless: the
 * same inputs always produce the same output, and no candle ever needs a
 * neighbor to be computed first.
 */
export function generateCandleRange(symbol: string, timeframe: string, params: GenerateCandleRangeParams): CandleRangeResult {
  const stepSeconds = stepSecondsFor(timeframe);
  const count = Math.max(0, Math.floor(params.count));

  const endIndexExclusive = params.beforeTimeSeconds !== undefined
    ? Math.floor(params.beforeTimeSeconds / stepSeconds)
    : Math.floor(Date.now() / 1000 / stepSeconds) + 1;

  const genesisIndex = genesisIndexFor(timeframe);
  const startIndex = Math.max(genesisIndex, endIndexExclusive - count);

  const candles: Candle[] = [];
  for (let index = startIndex; index < endIndexExclusive; index += 1) {
    candles.push(generateCandleAtIndex(symbol, timeframe, index));
  }

  return {
    candles,
    hasMore: startIndex > genesisIndex,
  };
}
