import 'server-only';

import {
  CHART_SECONDS, isSolanaMint, parseProviderCandle,
  type ChartSnapshot, type ChartTimeframe,
} from './chart-model';

const BASE = 'https://api.geckoterminal.com/api/v2/networks/solana';
const POOL_TTL_MS = 5 * 60_000;
const ABSENT_POOL_TTL_MS = 30_000;
const OHLCV_TTL_MS = 30_000;
const STALE_OHLCV_MS = 5 * 60_000;
const INTERVAL: Record<ChartTimeframe, { unit: 'minute' | 'hour' | 'day'; aggregate: number }> = {
  '1m': { unit: 'minute', aggregate: 1 },
  '5m': { unit: 'minute', aggregate: 5 },
  '15m': { unit: 'minute', aggregate: 15 },
  '1h': { unit: 'hour', aggregate: 1 },
  '4h': { unit: 'hour', aggregate: 4 },
  '1d': { unit: 'day', aggregate: 1 },
};

export interface GeckoPool { address: string; tokenSide: 'base' | 'quote'; quoteMint: string }
const pools = new Map<string, { value: GeckoPool | null; until: number }>();
const poolRequests = new Map<string, Promise<GeckoPool | null>>();
interface CachedOhlcv { pool: GeckoPool; candles: ChartSnapshot['candles']; fetchedLimit: number; observedAt: number }
const globalGecko = globalThis as typeof globalThis & { __sentinelGeckoOhlcv?: Map<string, CachedOhlcv> };
const ohlcvCache = globalGecko.__sentinelGeckoOhlcv ??= new Map<string, CachedOhlcv>();
let pausedUntil = 0;

async function getJson(url: string): Promise<{ status: number; body: any } | null> {
  if (Date.now() < pausedUntil) return null;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 429) {
      const retry = Number(response.headers.get('retry-after'));
      pausedUntil = Date.now() + (Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1_000, 60_000) : 30_000);
      return null;
    }
    if (!response.ok) return null;
    return { status: response.status, body: await response.json() };
  } catch { return null; }
}

export async function getGeckoPool(mint: string): Promise<GeckoPool | null> {
  const hit = pools.get(mint);
  if (hit && hit.until > Date.now()) return hit.value;
  const pending = poolRequests.get(mint);
  if (pending) return pending;
  const work = (async () => {
    const response = await getJson(`${BASE}/tokens/${encodeURIComponent(mint)}/pools`);
    if (!response || !Array.isArray(response.body?.data)) return null;
    const tokenId = `solana_${mint}`;
    let chosen: GeckoPool | null = null;
    for (const row of response.body.data) {
      const address = row?.attributes?.address;
      if (typeof address !== 'string' || !isSolanaMint(address)) continue;
      const base = row?.relationships?.base_token?.data?.id;
      const quote = row?.relationships?.quote_token?.data?.id;
      if (base === tokenId || quote === tokenId) {
        const other = base === tokenId ? quote : base;
        const quoteMint = typeof other === 'string' && other.startsWith('solana_') ? other.slice(7) : '';
        if (!isSolanaMint(quoteMint)) continue;
        chosen = { address, tokenSide: base === tokenId ? 'base' : 'quote', quoteMint };
        break;
      }
    }
    pools.set(mint, { value: chosen, until: Date.now() + (chosen ? POOL_TTL_MS : ABSENT_POOL_TTL_MS) });
    return chosen;
  })();
  poolRequests.set(mint, work);
  try { return await work; } finally { poolRequests.delete(mint); }
}

/** Measured fallback: GeckoTerminal's most liquid indexed pool, never a
 * fabricated token-aggregate chart. Its OHLCV volume is USD, not token units. */
export async function getGeckoChartHistory(
  mint: string, timeframe: ChartTimeframe, limit: number, before?: number,
): Promise<ChartSnapshot | null> {
  if (!isSolanaMint(mint)) return null;
  const key = `${mint}:${timeframe}:${before ?? 'latest'}`;
  const cached = ohlcvCache.get(key);
  const fetchedLimit = Math.max(151, Math.min(501, limit + 1));
  const fromCache = (entry: CachedOhlcv, stale: boolean): ChartSnapshot => {
    const selected = entry.candles.slice(-limit);
    return { address: mint, chain: 'solana', timeframe, currency: 'usd', market: 'pool',
      poolAddress: entry.pool.address, candles: selected,
      hasMore: entry.candles.length > limit || entry.candles.length >= entry.fetchedLimit,
      oldestTime: selected[0]?.time ?? null, observedAt: entry.observedAt,
      source: 'geckoterminal-pool-ohlcv', status: stale ? 'stale' : 'measured',
      ...(stale ? { reason: 'GeckoTerminal candle feed is delayed.' } : {}) };
  };
  if (cached && cached.fetchedLimit >= fetchedLimit
    && Date.now() - cached.observedAt < OHLCV_TTL_MS) return fromCache(cached, false);
  const pool = await getGeckoPool(mint);
  if (!pool) return cached && Date.now() - cached.observedAt < STALE_OHLCV_MS
    ? fromCache(cached, true) : null;
  const { unit, aggregate } = INTERVAL[timeframe];
  const query = new URLSearchParams({
    aggregate: String(aggregate), limit: String(fetchedLimit),
    currency: 'usd', token: pool.tokenSide, include_empty_intervals: 'false',
  });
  if (before !== undefined) query.set('before_timestamp', String(before - 1));
  const response = await getJson(`${BASE}/pools/${encodeURIComponent(pool.address)}/ohlcv/${unit}?${query}`);
  const raw = response?.body?.data?.attributes?.ohlcv_list;
  if (!Array.isArray(raw)) return cached && Date.now() - cached.observedAt < STALE_OHLCV_MS
    ? fromCache(cached, true) : null;
  const candles = raw.map((bar: unknown) => {
    if (!Array.isArray(bar) || bar.length < 6 || !Number.isFinite(bar[0])
      || bar[0] % CHART_SECONDS[timeframe] !== 0) return null;
    return parseProviderCandle({
      unix_time: bar[0], o: bar[1], h: bar[2], l: bar[3], c: bar[4], v_usd: bar[5],
    }, timeframe);
  });
  if (candles.some((candle) => candle === null)) return null;
  const unique = new Map<number, NonNullable<typeof candles[number]>>();
  for (const candle of candles) if (candle && (before === undefined || candle.time < before)) unique.set(candle.time, candle);
  const sorted = [...unique.values()].sort((a, b) => a.time - b.time);
  const entry = { pool, candles: sorted, fetchedLimit, observedAt: Date.now() };
  ohlcvCache.set(key, entry);
  if (ohlcvCache.size > 500) ohlcvCache.delete(ohlcvCache.keys().next().value!);
  return fromCache(entry, false);
}

export function resetGeckoChartForTests(): void {
  pools.clear(); poolRequests.clear(); ohlcvCache.clear(); pausedUntil = 0;
}
