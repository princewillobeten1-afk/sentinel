import 'server-only';

import { isSolanaMint } from '@/lib/market/chart-model';
import { acquireBitquerySlot } from '@/lib/market/bitquery-limiter';
import { fetchDexPairSnapshots, finite, queueDexMarketReconciliation } from './dexscreener-market';
import { mapJupiterToken, type JupiterToken } from './jupiter-feed';
import type { DiscoveryToken } from './types';

const ENDPOINT = 'https://streaming.bitquery.io/graphql';
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const CACHE_MS = 15_000;
const LOOKBACK_MS = 15 * 60_000;
let cache: { until: number; rows: Array<{ raw: JupiterToken; token: DiscoveryToken }> } | null = null;
let inFlight: Promise<Array<{ raw: JupiterToken; token: DiscoveryToken }>> | null = null;
let pausedUntil = 0;
let lastError: string | null = null;
const usableCache = () => cache?.rows.filter(({ raw }) => {
  const created = Date.parse(raw.createdAt ?? '');
  return Number.isFinite(created) && created >= Date.now() - LOOKBACK_MS;
}) ?? [];

export function parseBitqueryLaunches(body: unknown, now = Date.now()): JupiterToken[] | null {
  const result = body as { errors?: unknown[]; data?: { Solana?: { TokenSupplyUpdates?: unknown } } };
  if (result?.errors?.length || !Array.isArray(result?.data?.Solana?.TokenSupplyUpdates)) return null;
  const seen = new Set<string>();
  const tokens: JupiterToken[] = [];
  for (const raw of result.data.Solana.TokenSupplyUpdates) {
    const row = raw as { Block?: { Time?: unknown }; Transaction?: { Signer?: unknown };
      TokenSupplyUpdate?: { Currency?: { MintAddress?: unknown; Name?: unknown; Symbol?: unknown } } };
    const mint = row?.TokenSupplyUpdate?.Currency?.MintAddress;
    const createdAt = row?.Block?.Time;
    if (typeof createdAt !== 'string') continue;
    const timestamp = Date.parse(createdAt);
    if (typeof mint !== 'string' || !isSolanaMint(mint) || !Number.isFinite(timestamp)
      || timestamp > now + 5_000 || timestamp < now - LOOKBACK_MS || seen.has(mint)) continue;
    const currency = row.TokenSupplyUpdate?.Currency;
    const dev = row.Transaction?.Signer;
    tokens.push({
      id: mint, name: typeof currency?.Name === 'string' ? currency.Name : undefined,
      symbol: typeof currency?.Symbol === 'string' ? currency.Symbol : undefined,
      dev: typeof dev === 'string' && isSolanaMint(dev) ? dev : undefined,
      createdAt, launchpad: 'pump.fun', firstPool: { id: mint, createdAt },
    });
    seen.add(mint);
  }
  return tokens;
}

function queryFor(now: number): string {
  return `query SentinelRecentPumpLaunches {
    Solana {
      TokenSupplyUpdates(
        where: { Block: { Time: { since: ${JSON.stringify(new Date(now - LOOKBACK_MS).toISOString())} } },
          Transaction: { Result: { Success: true } },
          Instruction: { Program: { Address: { is: "${PUMP_PROGRAM}" },
            Method: { in: ["create", "create_v2"] } } } }
        orderBy: { descending: Block_Time }
        limit: { count: 30 }
      ) {
        Block { Time }
        Transaction { Signer }
        TokenSupplyUpdate { Currency { MintAddress Name Symbol } }
      }
    }
  }`;
}

/** Only used when Jupiter's public /recent feed fails; never generates launches. */
export async function getBitqueryRecentLaunches(): Promise<Array<{ raw: JupiterToken; token: DiscoveryToken }>> {
  const key = process.env.BITQUERY_ACCESS_TOKEN?.trim();
  if (!key || Date.now() < pausedUntil) return usableCache();
  if (cache && cache.until > Date.now()) return usableCache();
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      await acquireBitquerySlot('launch', AbortSignal.timeout(4_000));
      const response = await fetch(ENDPOINT, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: queryFor(Date.now()) }), cache: 'no-store', signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        lastError = `Bitquery launches HTTP ${response.status}`;
        if ([401, 402, 403, 429].includes(response.status)) pausedUntil = Date.now() + 60_000;
        return usableCache();
      }
      const launches = parseBitqueryLaunches(await response.json());
      if (!launches) { lastError = 'Bitquery returned malformed launch data.'; return usableCache(); }
      const pairs = await fetchDexPairSnapshots(launches.map(token => token.id), 2_500);
      // The creation event must not wait on a slower secondary market index.
      // Missing pairs are reconciled into token.card patches in the background.
      queueDexMarketReconciliation(launches.filter(token => !pairs.has(token.id)).map(token => token.id));
      const rows = launches.map(raw => {
        const token = mapJupiterToken(raw);
        const pair = pairs.get(raw.id);
        const price = finite(pair?.priceUsd);
        const cap = finite(pair?.marketCap ?? pair?.fdv);
        const liquidity = finite(pair?.liquidity?.usd);
        const observedAt = new Date().toISOString();
        const creationAt = raw.createdAt!;
        if (pair) {
          if (price !== undefined) token.priceUsd = String(price);
          if (cap !== undefined) token.marketCapUsd = String(cap);
          if (liquidity !== undefined) token.liquidityUsd = String(liquidity);
          for (const [window, key] of [['m5', 'volume5mUsd'], ['h1', 'volume1hUsd'], ['h24', 'volume24hUsd']] as const) {
            const volume = finite(pair.volume?.[window]);
            if (volume !== undefined) token[key] = String(volume);
          }
          const buys5 = finite(pair.txns?.m5?.buys), sells5 = finite(pair.txns?.m5?.sells);
          const buys1 = finite(pair.txns?.h1?.buys), sells1 = finite(pair.txns?.h1?.sells);
          if (buys5 !== undefined) token.buysCount5m = buys5;
          if (sells5 !== undefined) token.sellsCount5m = sells5;
          if (buys1 !== undefined) { token.buysCount1h = buys1; token.buysCount = buys1; }
          if (sells1 !== undefined) { token.sellsCount1h = sells1; token.sellsCount = sells1; }
          if (buys5 !== undefined && sells5 !== undefined) token.txCount5m = buys5 + sells5;
          if (buys1 !== undefined && sells1 !== undefined) token.txCount1h = buys1 + sells1;
          if (finite(pair.priceChange?.m5) !== undefined) token.priceChange5m = finite(pair.priceChange?.m5)!;
          if (finite(pair.priceChange?.h1) !== undefined) token.priceChange1h = finite(pair.priceChange?.h1)!;
          if (finite(pair.priceChange?.h24) !== undefined) token.priceChange24h = finite(pair.priceChange?.h24)!;
          if (pair.info?.imageUrl) token.logoURI = pair.info.imageUrl;
          const marketMeasured = price !== undefined || cap !== undefined || liquidity !== undefined;
          token.marketEvidence = marketMeasured ? { status: 'measured', source: 'dexscreener-batch-rest',
            observedAt, expiresAt: new Date(Date.now() + CACHE_MS).toISOString() } : undefined;
          token.activityEvidence = buys5 !== undefined || sells5 !== undefined || finite(pair.volume?.m5) !== undefined
            ? { status: 'measured', source: 'dexscreener-batch-rest', observedAt,
              expiresAt: new Date(Date.now() + CACHE_MS).toISOString() } : undefined;
        } else {
          token.marketEvidence = undefined;
          token.activityEvidence = undefined;
        }
        token.lifecycleEvidence = { status: 'measured', source: 'bitquery-pump-creation', observedAt: creationAt };
        token.creatorEvidence = raw.dev
          ? { status: 'measured', source: 'bitquery-pump-creation', observedAt: creationAt } : undefined;
        return { raw, token };
      });
      cache = { until: Date.now() + CACHE_MS, rows };
      lastError = null;
      return rows;
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message.slice(0, 120)}` : 'Unknown error';
      lastError = `Bitquery launch pipeline failed (${detail}).`;
      return usableCache();
    }
  })();
  try { return await inFlight; } finally { inFlight = null; }
}

export function bitqueryLaunchHealth() {
  return { configured: Boolean(process.env.BITQUERY_ACCESS_TOKEN?.trim()), pausedUntil, lastError,
    cached: cache?.rows.length ?? 0 };
}

export function resetBitqueryLaunchesForTests() {
  cache = null; inFlight = null; pausedUntil = 0; lastError = null;
}
