import 'server-only';

import { isSolanaMint, parseProviderCandle,
  type ChartCandle, type ChartSnapshot, type ChartTimeframe } from './chart-model';
import { acquireBitquerySlot } from './bitquery-limiter';

const ENDPOINT = 'https://streaming.bitquery.io/graphql';
// Native SOL is the Pump.fun bonding-curve quote; excluding it silently removes
// the very new tokens whose chart needs this fallback most.
const USD_QUOTES = [
  '11111111111111111111111111111111',
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
];
const PERIOD: Record<ChartTimeframe, { count: number; unit: 'minutes' | 'hours' | 'days' }> = {
  '1m': { count: 1, unit: 'minutes' }, '5m': { count: 5, unit: 'minutes' },
  '15m': { count: 15, unit: 'minutes' }, '1h': { count: 1, unit: 'hours' },
  '4h': { count: 4, unit: 'hours' }, '1d': { count: 1, unit: 'days' },
};
const cache = new Map<string, { value: ChartSnapshot | null; until: number }>();
const requests = new Map<string, Promise<ChartSnapshot | null>>();
let pausedUntil = 0;
let lastError: string | null = null;

export function parseBitqueryDexCandles(body: unknown, timeframe: ChartTimeframe, before?: number): ChartCandle[] | null {
  const result = body as { errors?: unknown[]; data?: { Solana?: { DEXTradeByTokens?: unknown } } };
  if (result?.errors?.length || !Array.isArray(result?.data?.Solana?.DEXTradeByTokens)) return null;
  const candles: ChartCandle[] = [];
  const times = new Set<number>();
  for (const raw of result.data.Solana.DEXTradeByTokens) {
    const row = raw as { Block?: { bucket?: string }; Trade?: Record<string, unknown>; volume?: unknown; volumeUsd?: unknown };
    const millis = Date.parse(row?.Block?.bucket ?? '');
    if (!Number.isFinite(millis) || millis % 1000 !== 0) return null;
    const number = (value: unknown): number | null => {
      if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    const candle = parseProviderCandle({
      unix_time: millis / 1_000,
      o: number(row.Trade?.open), h: number(row.Trade?.high),
      l: number(row.Trade?.low), c: number(row.Trade?.close),
      v: number(row.volume), v_usd: number(row.volumeUsd),
    }, timeframe);
    if (!candle || times.has(candle.time) || before !== undefined && candle.time >= before) return null;
    times.add(candle.time);
    candles.push(candle);
  }
  return candles.sort((a, b) => a.time - b.time);
}

function queryFor(mint: string, timeframe: ChartTimeframe, count: number, before?: number): string {
  const period = PERIOD[timeframe];
  const time = before === undefined ? '' : `Block: { Time: { before: ${JSON.stringify(new Date(before * 1_000).toISOString())} } },`;
  return `query SentinelDexCandles {
    Solana(dataset: realtime, aggregates: no) {
      DEXTradeByTokens(
        where: { ${time} Transaction: { Result: { Success: true } },
          Trade: { Currency: { MintAddress: { is: ${JSON.stringify(mint)} } },
            Side: { Currency: { MintAddress: { in: ${JSON.stringify(USD_QUOTES)} } } } } }
        orderBy: { descendingByField: "Block_bucket" }
        limit: { count: ${count} }
      ) {
        Block { bucket: Time(interval: { count: ${period.count}, in: ${period.unit} }) }
        Trade {
          open: PriceInUSD(minimum: Block_Slot)
          high: PriceInUSD(maximum: Trade_PriceInUSD)
          low: PriceInUSD(minimum: Trade_PriceInUSD)
          close: PriceInUSD(maximum: Block_Slot)
        }
        volume: sum(of: Trade_Amount)
        volumeUsd: sum(of: Trade_Side_AmountInUSD)
      }
    }
  }`;
}

/** Raw indexed DEX fills backstop the Tokens price cube for fresh bonding-curve assets. */
export async function getBitqueryDexChartHistory(
  mint: string, timeframe: ChartTimeframe, limit: number, before?: number,
): Promise<ChartSnapshot | null> {
  const token = process.env.BITQUERY_ACCESS_TOKEN?.trim();
  if (!token || !isSolanaMint(mint) || Date.now() < pausedUntil) return null;
  const key = `${mint}:${timeframe}:${limit}:${before ?? 'latest'}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const pending = requests.get(key);
  if (pending) return pending;
  const work = (async (): Promise<ChartSnapshot | null> => {
    try {
      const count = Math.min(500, Math.max(2, limit + 1));
      await acquireBitquerySlot('chart', AbortSignal.timeout(7_000));
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: queryFor(mint, timeframe, count, before) }),
        cache: 'no-store', signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        lastError = `Bitquery DEX candles HTTP ${response.status}`;
        if ([401, 402, 403, 429].includes(response.status)) pausedUntil = Date.now() + 60_000;
        return null;
      }
      const candles = parseBitqueryDexCandles(await response.json(), timeframe, before);
      if (!candles) { lastError = 'Bitquery DEX candle response is malformed.'; return null; }
      lastError = null;
      if (!candles.length) return null;
      const selected = candles.slice(-limit);
      const snapshot: ChartSnapshot = {
        address: mint, chain: 'solana', timeframe, currency: 'usd', market: 'token-aggregate',
        source: 'bitquery-dex-ohlcv', status: 'measured', observedAt: Date.now(),
        candles: selected, hasMore: candles.length > limit || candles.length >= count,
        oldestTime: selected[0]?.time ?? null,
      };
      cache.set(key, { value: snapshot, until: Date.now() + (before === undefined ? 15_000 : 60_000) });
      if (cache.size > 300) cache.delete(cache.keys().next().value!);
      return snapshot;
    } catch {
      lastError = 'Bitquery DEX candle request failed or timed out.';
      return null;
    }
  })();
  requests.set(key, work);
  try { return await work; } finally { requests.delete(key); }
}

export function bitqueryDexChartHealth() {
  return { configured: Boolean(process.env.BITQUERY_ACCESS_TOKEN?.trim()), pausedUntil, lastError };
}

export function resetBitqueryDexChartForTests() {
  cache.clear(); requests.clear(); pausedUntil = 0; lastError = null;
}
