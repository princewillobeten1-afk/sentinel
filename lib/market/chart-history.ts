import 'server-only';
import { env } from '@/lib/server/env';
import { ApiError } from '@/lib/server/errors';
import { acquireBirdeyeSlot } from '@/lib/market/enrichment/birdeye-limiter';
import { parseProviderCandle, type ChartSnapshot, type ChartTimeframe } from './chart-model';

const cache = new Map<string, { snapshot: ChartSnapshot; until: number }>();
const requests = new Map<string, Promise<ChartSnapshot>>();
let pausedUntil = 0;
let pauseReason = '';

export async function getChartHistory(address: string, timeframe: ChartTimeframe, limit = 150, before?: number): Promise<ChartSnapshot> {
  const key = `${address}:${timeframe}:${limit}:${before ?? 'latest'}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.snapshot;
  const pending = requests.get(key);
  if (pending) return pending;
  const unavailable = (reason: string) => {
    if (cached) return { ...cached.snapshot, status: 'stale' as const, reason };
    throw new ApiError(reason, 503, 'CHART_UNAVAILABLE');
  };
  if (Date.now() < pausedUntil) return unavailable(pauseReason);
  if (!env.BIRDEYE_API_KEY) return unavailable('Candle provider credential is not configured.');
  const work = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      await acquireBirdeyeSlot('chart', controller.signal);
      const observedAt = Date.now();
      const to = before === undefined ? Math.floor(observedAt / 1000) : before - 1;
      const params = new URLSearchParams({ address, type: timeframe, currency: 'usd', mode: 'count',
        count_limit: String(Math.min(500, limit + 1)), time_to: String(to), padding: 'false', ui_amount_mode: 'raw' });
      const res = await fetch(`https://public-api.birdeye.so/defi/v3/ohlcv?${params}`, {
        headers: { 'X-API-KEY': env.BIRDEYE_API_KEY, 'x-chain': 'solana', Accept: 'application/json' },
        signal: controller.signal, cache: 'no-store',
      });
      if (!res.ok) {
        const retry = res.headers.get('retry-after');
        const seconds = retry?.trim() ? Number(retry) : NaN;
        const wait = Number.isFinite(seconds) ? seconds * 1000 : retry ? Date.parse(retry) - Date.now() : 30_000;
        pauseReason = res.status === 429 ? 'Candle provider rate limit reached; waiting before retrying.'
          : res.status === 401 || res.status === 403 ? 'Candle provider denied access. Check OHLCV API permissions.'
          : `Candle provider is unavailable (HTTP ${res.status}).`;
        pausedUntil = Date.now() + Math.max(5_000, Math.min(300_000, Number.isFinite(wait) ? wait : 30_000));
        throw new Error(pauseReason);
      }
      const body = await res.json();
      if (body?.success !== true || !Array.isArray(body.data?.items)) throw new Error('Candle provider returned an invalid response.');
      const rows = body.data.items;
      const parsed = rows.map((row: any) => {
        if (row.address !== address || row.type !== timeframe || row.currency !== 'usd') return null;
        return parseProviderCandle(row, timeframe);
      });
      // A corrupt payload is not an empty market and must not be cached as one.
      if (parsed.some((row: unknown) => row === null)) throw new Error('Candle provider returned malformed or mismatched candles.');
      const unique = new Map<number, NonNullable<ReturnType<typeof parseProviderCandle>>>();
      for (const row of parsed) if (row && row.time <= to) unique.set(row.time, row);
      const sorted = [...unique.values()].sort((a, b) => a.time - b.time);
      const candles = sorted.slice(-limit);
      const snapshot: ChartSnapshot = { address, timeframe, chain: 'solana', currency: 'usd', market: 'token-aggregate',
        candles, hasMore: sorted.length > limit || (limit === 500 && sorted.length === 500), oldestTime: candles[0]?.time ?? null,
        observedAt, source: 'birdeye-ohlcv-v3', status: 'measured' };
      cache.delete(key);
      cache.set(key, { snapshot, until: Date.now() + (before === undefined ? 5_000 : 60_000) });
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
      return snapshot;
    } catch (error) {
      return unavailable(controller.signal.aborted ? 'Candle request timed out; retry shortly.'
        : error instanceof Error ? error.message : 'Candle request failed.');
    } finally { clearTimeout(timeout); }
  })();
  requests.set(key, work);
  try { return await work; } finally { requests.delete(key); }
}

export function resetChartHistoryForTests() { cache.clear(); requests.clear(); pausedUntil = 0; pauseReason = ''; }
