import 'server-only';

import { CHART_SECONDS, isSolanaMint, parseProviderCandle,
  type ChartCandle, type ChartSnapshot, type ChartTimeframe } from './chart-model';
import { acquireBitquerySlot } from './bitquery-limiter';

const ENDPOINT = 'https://streaming.bitquery.io/graphql';
const MAX_RECENT_HOURS = 30 * 24;
const cache = new Map<string, { snapshot: ChartSnapshot; until: number }>();
const requests = new Map<string, Promise<ChartSnapshot | null>>();
let pausedUntil = 0;
let lastError: string | null = null;

export function getBitqueryChartHealth() {
  return { configured: !!process.env.BITQUERY_ACCESS_TOKEN?.trim(), pausedUntil, lastError };
}

/** The Trading price index stores at most 1h buckets. Roll larger intervals up locally. */
export function rollupBitqueryCandles(candles: ChartCandle[], timeframe: '4h' | '1d'): ChartCandle[] {
  const seconds = CHART_SECONDS[timeframe];
  const groups = new Map<number, ChartCandle[]>();
  for (const candle of candles) {
    const start = Math.floor(candle.time / seconds) * seconds;
    const group = groups.get(start) ?? [];
    group.push(candle);
    groups.set(start, group);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([time, rows]) => {
    rows.sort((a, b) => a.time - b.time);
    return { time, open: rows[0].open, high: Math.max(...rows.map(row => row.high)),
      low: Math.min(...rows.map(row => row.low)), close: rows[rows.length - 1].close,
      volume: rows.every(row => row.volume !== null) ? rows.reduce((sum, row) => sum + row.volume!, 0) : null,
      volumeUsd: rows.every(row => row.volumeUsd !== null) ? rows.reduce((sum, row) => sum + row.volumeUsd!, 0) : null };
  });
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

/** Reject malformed/mismatched rows; a provider error is never an empty market. */
export function parseBitqueryCandle(row: unknown, mint: string, duration: number): ChartCandle | null {
  const item = row as any;
  if (!item || item.Token?.Address !== mint || item.Token?.Network !== 'Solana'
    || item.Interval?.Time?.Duration !== duration || item.Price?.IsQuotedInUsd !== true) return null;
  const millis = Date.parse(item.Interval.Time.Start);
  const ohlc = item.Price.Ohlc;
  const [open, high, low, close] = [ohlc?.Open, ohlc?.High, ohlc?.Low, ohlc?.Close].map(numberOrNull);
  if (!Number.isFinite(millis) || millis <= 0 || millis % 1000 !== 0 || (millis / 1000) % duration !== 0
    || open === null || high === null || low === null || close === null
    || Math.min(open, high, low, close) <= 0 || low > Math.min(open, close) || high < Math.max(open, close)) return null;
  return parseProviderCandle({ unix_time: millis / 1000, o: open, h: high, l: low, c: close,
    v: numberOrNull(item.Volume?.Base), v_usd: numberOrNull(item.Volume?.Usd) }, duration === 3600 ? '1h'
      : duration === 900 ? '15m' : duration === 300 ? '5m' : '1m');
}

function queryFor(mint: string, duration: number, count: number, before?: number): string {
  const until = before === undefined ? '' : `Block: { Time: { till: ${JSON.stringify(new Date((before - 1) * 1000).toISOString())} } }`;
  return `query SentinelCandles {
    Trading {
      Tokens(where: {
        Token: { Address: { is: ${JSON.stringify(mint)} }, Network: { is: "Solana" } }
        Interval: { Time: { Duration: { eq: ${duration} } } }
        Price: { IsQuotedInUsd: true }
        ${until}
      }, limit: { count: ${count} }, orderBy: { descending: Block_Time }) {
        Token { Address Network }
        Interval { Time { Start Duration } }
        Price { IsQuotedInUsd Ohlc { Open High Low Close } }
        Volume { Base Usd }
      }
    }
  }`;
}

/** Optional, bounded recent-history fallback. Bitquery streams and paid archive are not required. */
export async function getBitqueryChartHistory(
  mint: string, timeframe: ChartTimeframe, limit: number, before?: number,
): Promise<ChartSnapshot | null> {
  const token = process.env.BITQUERY_ACCESS_TOKEN?.trim();
  if (!token || !isSolanaMint(mint) || Date.now() < pausedUntil) return null;
  const key = `${mint}:${timeframe}:${limit}:${before ?? 'latest'}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.snapshot;
  const pending = requests.get(key);
  if (pending) return pending;
  const work = (async (): Promise<ChartSnapshot | null> => {
    const duration = timeframe === '4h' || timeframe === '1d' ? 3600 : CHART_SECONDS[timeframe];
    const hoursPerBar = CHART_SECONDS[timeframe] / duration;
    const count = Math.min(MAX_RECENT_HOURS + 1, Math.max(2, Math.min(500, limit) * hoursPerBar + hoursPerBar + 1));
    try {
      await acquireBitquerySlot('chart', AbortSignal.timeout(7_000));
      const response = await fetch(ENDPOINT, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: queryFor(mint, duration, count, before) }),
        cache: 'no-store', signal: AbortSignal.timeout(7_000),
      });
      if (!response.ok) {
        if ([401, 402, 403, 429].includes(response.status)) {
          const retry = Number(response.headers.get('retry-after'));
          pausedUntil = Date.now() + (response.status === 429 && Number.isFinite(retry) && retry > 0
            ? Math.min(retry * 1000, 15 * 60_000) : response.status === 429 ? 60_000 : 15 * 60_000);
        }
        lastError = `Bitquery HTTP ${response.status}`;
        return null;
      }
      const payload = await response.json();
      if (Array.isArray(payload?.errors) && payload.errors.length) {
        lastError = 'Bitquery GraphQL rejected the candle query.';
        pausedUntil = Date.now() + 60_000;
        return null;
      }
      const rows = payload?.data?.Trading?.Tokens;
      if (!Array.isArray(rows)) { lastError = 'Bitquery returned malformed candle data.'; return null; }
      const parsed = rows.map((row: unknown) => parseBitqueryCandle(row, mint, duration));
      if (parsed.some((row: ChartCandle | null) => row === null)) {
        lastError = 'Bitquery returned malformed or mismatched candles.';
        return null;
      }
      const unique = new Map<number, ChartCandle>();
      for (const row of parsed as ChartCandle[]) if (before === undefined || row.time < before) unique.set(row.time, row);
      let sorted = [...unique.values()].sort((a, b) => a.time - b.time);
      if (timeframe === '4h' || timeframe === '1d') {
        // If the request hit its row cap, the oldest rolled bucket may lack its first hours.
        if (rows.length >= count && sorted.length && sorted[0].time % CHART_SECONDS[timeframe] !== 0) sorted = sorted.slice(1);
        sorted = rollupBitqueryCandles(sorted, timeframe);
      }
      const candles = sorted.slice(-limit);
      const snapshot: ChartSnapshot = { address: mint, chain: 'solana', timeframe, currency: 'usd',
        market: 'token-aggregate', candles, hasMore: sorted.length > limit,
        oldestTime: candles[0]?.time ?? null, observedAt: Date.now(), source: 'bitquery-token-ohlcv', status: 'measured' };
      lastError = null;
      cache.set(key, { snapshot, until: Date.now() + (before === undefined ? 30_000 : 5 * 60_000) });
      if (cache.size > 300) cache.delete(cache.keys().next().value!);
      return snapshot;
    } catch {
      lastError = 'Bitquery candle request failed or timed out.';
      return null;
    }
  })();
  requests.set(key, work);
  try { return await work; } finally { requests.delete(key); }
}

export function resetBitqueryChartForTests() { cache.clear(); requests.clear(); pausedUntil = 0; lastError = null; }
