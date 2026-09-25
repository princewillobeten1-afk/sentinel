import 'server-only';
import { env } from '@/lib/server/env';
import { ApiError } from '@/lib/server/errors';
import { acquireBirdeyeSlot } from '@/lib/market/enrichment/birdeye-limiter';
import { getGeckoChartHistory } from './geckoterminal-chart';
import { getBitqueryChartHistory } from './bitquery-chart';
import { getBitqueryDexChartHistory } from './bitquery-dex-chart';
import { BIRDEYE_CHART_INTERVAL, parseProviderCandle, type ChartSnapshot, type ChartTimeframe } from './chart-model';

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
  const alternate = async (): Promise<ChartSnapshot | null> => {
    // Bitquery's Tokens cube is a token-wide USD series, like Birdeye's
    // aggregate. A GeckoTerminal pool series is the last resort for a cold chart.
    const bitquery = await getBitqueryChartHistory(address, timeframe, limit, before);
    if (bitquery?.candles.length) return bitquery;
    const dex = await getBitqueryDexChartHistory(address, timeframe, limit, before);
    if (dex?.candles.length) return dex;
    const gecko = await getGeckoChartHistory(address, timeframe, limit, before);
    return gecko?.candles.length ? gecko : bitquery ?? dex ?? gecko;
  };
  const unavailable = async (reason: string): Promise<ChartSnapshot> => {
    const fallback = await alternate();
    if (fallback?.candles.length || (fallback && !cached)) {
      cache.set(key, { snapshot: fallback, until: Date.now() + (before === undefined ? 15_000 : 60_000) });
      return fallback;
    }
    if (cached) return { ...cached.snapshot, status: 'stale', reason };
    throw new ApiError(reason, 503, 'CHART_UNAVAILABLE');
  };
  if (Date.now() < pausedUntil) return unavailable(pauseReason);
  // The custom server may import `env` before Next loads .env. Read the live
  // server environment at request time, retaining the validated env fallback.
  const apiKey = process.env.BIRDEYE_API_KEY?.trim() || env.BIRDEYE_API_KEY?.trim();
  if (!apiKey) return unavailable('Candle provider credential is not configured.');
  const providerInterval = BIRDEYE_CHART_INTERVAL[timeframe];
  const work = (async () => {
    // Birdeye remains the primary token-wide candle source. Bitquery fills
    // missing history; pool-specific Gecko/QuickNode is a labeled last resort.
    if (Date.now() < pausedUntil) return unavailable(pauseReason);
    if (!apiKey) return unavailable('Candle provider credential is not configured.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      await acquireBirdeyeSlot('chart', controller.signal);
      const observedAt = Date.now();
      const to = before === undefined ? Math.floor(observedAt / 1000) : before - 1;
      const params = new URLSearchParams({ address, type: providerInterval, currency: 'usd', mode: 'count',
        count_limit: String(Math.min(500, limit + 1)), time_to: String(to), padding: 'false', ui_amount_mode: 'raw' });
      const res = await fetch(`https://public-api.birdeye.so/defi/v3/ohlcv?${params}`, {
        headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana', Accept: 'application/json' },
        signal: controller.signal, cache: 'no-store',
      });
      if (!res.ok) {
        const errorBody = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
        const quotaExhausted = /compute\s*units?\s*usage\s*limit\s*exceeded/i.test(errorBody);
        const retry = res.headers.get('retry-after');
        const seconds = retry?.trim() ? Number(retry) : NaN;
        const wait = Number.isFinite(seconds) ? seconds * 1000 : retry ? Date.parse(retry) - Date.now() : 30_000;
        pauseReason = quotaExhausted ? 'Birdeye compute-unit quota is exhausted; candles will resume when the quota is restored.'
          : res.status === 429 ? 'Candle provider rate limit reached; waiting before retrying.'
          : res.status === 401 || res.status === 403 ? 'Candle provider denied access. Check OHLCV API permissions.'
          : `Candle provider is unavailable (HTTP ${res.status}).`;
        pausedUntil = Date.now() + (quotaExhausted ? 15 * 60_000
          : Math.max(5_000, Math.min(300_000, Number.isFinite(wait) ? wait : 30_000)));
        throw new Error(pauseReason);
      }
      const body = await res.json();
      if (body?.success !== true || !Array.isArray(body.data?.items)) throw new Error('Candle provider returned an invalid response.');
      const rows = body.data.items;
      const parsed = rows.map((row: any) => {
        if (row.address !== address || row.type !== providerInterval || row.currency !== 'usd') return null;
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
      if (!candles.length && before === undefined) {
        const fallback = await alternate();
        if (fallback?.candles.length) return fallback;
      }
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
