import { DiscoveryToken, DiscoveryFilter, TimeWindow } from './types';
import { calculateDiscoveryScore } from './score-engine';
import { calculateTrendingScore } from './trending-engine';
import { filterDiscoveryTokens } from './service';
import { sanitizeTokenName } from './sanitize-name';
import { formatAge } from './format';
import { resolveRobinhoodDex, type ResolvedRobinhoodDex } from '@/lib/chains/robinhood-dex-registry';
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_USDG_ADDRESS,
  ROBINHOOD_WETH_ADDRESS,
  isEvmAddress,
} from '@/lib/chains/chain-config';
import {
  getRobinhoodErc20Metadata,
  readPonsV2CurveStates,
  type PonsV2CurveState,
} from '@/lib/blockchain/robinhood-rpc';
import {
  readOnChainEthUsdPrice,
  readPonsV2FullCurveState,
  readRecentPonsV2LaunchesFromRpc,
  type PonsV2FullCurveState,
} from '@/lib/blockchain/robinhood-rpc-protocols';
import type { LaunchpadConfig } from '@/lib/market/lifecycle/launchpads';
import { calculateRugRisk } from '@/lib/market/enrichment/rug-risk';
import { getTokenCardPatch, updateTokenCard } from '@/lib/market/live/card-cache';
import {
  getCachedPonsLaunchAudit,
  hydratePonsLaunchAuditsFromRedis,
  queuePonsLaunchAudit,
  type PonsLaunchAuditResult,
} from '@/lib/market/enrichment/robinhood-pons-sniper';
import { mergeTokenCardSnapshot } from './card-snapshot';
import { eventBus } from '@/lib/server/events/event-bus';

export type RobinhoodFeedKind =
  | 'new_pools'
  | 'trending_pools'
  | 'pools'
  | 'dexes/pons-v2/pools'
  | 'dexes/uniswap-v4-robinhood/pools';

interface GeckoTokenIncluded {
  id: string;
  type: 'token';
  attributes: {
    address: string;
    name?: string | null;
    symbol?: string | null;
    decimals?: number | null;
    image_url?: string | null;
    coingecko_coin_id?: string | null;
  };
}

interface GeckoPoolItem {
  id: string;
  type: 'pool';
  attributes: {
    address: string;
    name?: string;
    pool_created_at?: string | null;
    base_token_price_usd?: string | null;
    quote_token_price_usd?: string | null;
    fdv_usd?: string | null;
    market_cap_usd?: string | null;
    reserve_in_usd?: string | null;
    price_change_percentage?: Record<string, string | null>;
    volume_usd?: Record<string, string | null>;
    transactions?: Record<
      string,
      { buys?: number; sells?: number; buyers?: number; sellers?: number } | undefined
    >;
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
}

interface GeckoPoolsResponse {
  data?: GeckoPoolItem[];
  included?: GeckoTokenIncluded[];
}

export interface GoPlusEvmSecurity {
  is_open_source?: string;
  is_proxy?: string;
  is_mintable?: string;
  owner_address?: string;
  can_take_back_ownership?: string;
  is_blacklisted?: string;
  transfer_pausable?: string;
  is_honeypot?: string;
  cannot_buy?: string;
  cannot_sell_all?: string;
  buy_tax?: string;
  sell_tax?: string;
  creator_address?: string;
  creator_percent?: string;
  holder_count?: string;
  total_supply?: string;
  token_name?: string;
  token_symbol?: string;
  holders?: Array<{
    address: string;
    tag?: string;
    is_contract?: number;
    balance?: string;
    percent?: string;
    is_locked?: number;
  }>;
  lp_holders?: Array<{
    address: string;
    tag?: string;
    is_contract?: number;
    balance?: string;
    percent?: string;
    is_locked?: number;
  }>;
  dex?: Array<{
    liquidity_type?: string;
    name?: string;
    liquidity?: string;
    pair?: string;
  }>;
}

interface FeedCacheEntry {
  tokens: DiscoveryToken[];
  fetchedAt: number;
  error?: string;
}

interface SecurityCacheEntry {
  data: GoPlusEvmSecurity | null;
  fetchedAt: number;
}

const globalForRobinhood = globalThis as unknown as {
  sentinelRhFeedCache?: Map<RobinhoodFeedKind, FeedCacheEntry>;
  sentinelRhFeedInFlight?: Map<RobinhoodFeedKind, Promise<FeedCacheEntry>>;
  sentinelRhLaunchMs?: Map<string, number | null>;
  sentinelRhSecurityCache?: Map<string, SecurityCacheEntry>;
  sentinelRhSecurityInFlight?: Map<string, Promise<GoPlusEvmSecurity | null>>;
  sentinelRhPonsCurveCache?: Map<string, { state: PonsV2CurveState; fetchedAt: number }>;
  sentinelRhPonsFullCache?: Map<string, { state: PonsV2FullCurveState; fetchedAt: number }>;
  sentinelRhRpcFallbackCache?: { tokens: DiscoveryToken[]; fetchedAt: number };
  sentinelRhRpcFallbackInFlight?: Promise<DiscoveryToken[]>;
  sentinelRhPonsCurveRefreshing?: boolean;
  sentinelRhErc20MetaCache?: Map<string, Awaited<ReturnType<typeof getRobinhoodErc20Metadata>>>;
  sentinelRhSeenNewLaunches?: Set<string>;
  sentinelRhLaunchesBootstrapped?: boolean;
  sentinelRhGtRateLimitUntil?: number;
};

const feedCache = (globalForRobinhood.sentinelRhFeedCache ??= new Map());
const feedInFlight = (globalForRobinhood.sentinelRhFeedInFlight ??= new Map());
const launchMsCache = (globalForRobinhood.sentinelRhLaunchMs ??= new Map());
const securityCache = (globalForRobinhood.sentinelRhSecurityCache ??= new Map());
const securityInFlight = (globalForRobinhood.sentinelRhSecurityInFlight ??= new Map());
const ponsCurveCache = (globalForRobinhood.sentinelRhPonsCurveCache ??= new Map());
const ponsFullCache = (globalForRobinhood.sentinelRhPonsFullCache ??= new Map());

const FEED_TTL_MS: Record<RobinhoodFeedKind, number> = {
  new_pools: 4_000,
  trending_pools: 30_000,
  pools: 45_000,
  'dexes/pons-v2/pools': 10_000,
  'dexes/uniswap-v4-robinhood/pools': 30_000,
};

const PONS_CURVE_TTL_MS = 4_000;
const PONS_FULL_STATE_TTL_MS = 5 * 60_000;
const PONS_RPC_FALLBACK_TTL_MS = 3_000;
const SECURITY_TTL_MS = 5 * 60_000;

/** Marks cached new-pair snapshots stale and warms in background when a new on-chain launch is observed. */
export function invalidateRobinhoodNewPairsCache(): void {
  if (globalForRobinhood.sentinelRhRpcFallbackCache) {
    globalForRobinhood.sentinelRhRpcFallbackCache.fetchedAt = 0;
  }
  const newPools = feedCache.get('new_pools');
  if (newPools) {
    newPools.fetchedAt = 0;
  }
  void fetchPonsV2RpcFallbackTokens(8).catch(() => undefined);
}
const GT_BASE = 'https://api.geckoterminal.com/api/v2/networks/robinhood';
const GOPLUS_BASE = `https://api.gopluslabs.io/api/v1/token_security/${ROBINHOOD_CHAIN_ID}`;

const RESERVE_TOKENS = new Set([
  ROBINHOOD_WETH_ADDRESS.toLowerCase(),
  ROBINHOOD_USDG_ADDRESS.toLowerCase(),
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0bd7d308f8e1639fab988df18a8011f41eacad73',
  '0x4200000000000000000000000000000000000006',
  '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
]);

const CANONICAL_ECOSYSTEM_TOKENS = new Set([
  '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec', // NVDA
  '0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea', // SPCX
  '0x117cc2133c37b721f49de2a7a74833232b3b4c0c', // SPY
  '0x39dbed3a2bd333467115de45665cc57f813c4571', // PONS
]);

const RESERVE_SYMBOLS = new Set(['weth', 'eth', 'usdg', 'usdc', 'usdt']);

export function isNonMemeRobinhoodToken(token: Pick<DiscoveryToken, 'mint' | 'symbol'>): boolean {
  const mintLower = token.mint.toLowerCase();
  if (RESERVE_TOKENS.has(mintLower) || CANONICAL_ECOSYSTEM_TOKENS.has(mintLower)) {
    return true;
  }
  return RESERVE_SYMBOLS.has((token.symbol || '').trim().toLowerCase());
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function money(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function parseBoolFlag(flag: unknown): boolean | undefined {
  if (flag === '1' || flag === 1 || flag === true) return true;
  if (flag === '0' || flag === 0 || flag === false) return false;
  return undefined;
}

const GOPLUS_CONCURRENCY = 4;

export async function fetchGoPlusRobinhoodSecurityBatch(
  addresses: string[],
): Promise<Map<string, GoPlusEvmSecurity | null>> {
  const unique = Array.from(
    new Set(addresses.map((a) => a.toLowerCase()).filter((a) => isEvmAddress(a))),
  );
  const out = new Map<string, GoPlusEvmSecurity | null>();
  if (unique.length === 0) return out;

  const now = Date.now();
  const waiters: Array<[string, Promise<GoPlusEvmSecurity | null>]> = [];
  const toFetch: string[] = [];

  for (const norm of unique) {
    const cached = securityCache.get(norm);
    if (cached && now - cached.fetchedAt < SECURITY_TTL_MS) {
      out.set(norm, cached.data);
      continue;
    }
    const existing = securityInFlight.get(norm);
    if (existing) {
      waiters.push([norm, existing]);
    } else {
      toFetch.push(norm);
    }
  }

  // GoPlus EVM endpoints only evaluate a single contract per request when unauthenticated;
  // fan out single-address requests through a bounded concurrency queue.
  let nextIdx = 0;
  const runNext = async () => {
    while (nextIdx < toFetch.length) {
      const addr = toFetch[nextIdx++];
      let p!: Promise<GoPlusEvmSecurity | null>;
      p = (async (): Promise<GoPlusEvmSecurity | null> => {
        try {
          const res = await fetch(`${GOPLUS_BASE}?contract_addresses=${addr}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5_000),
            cache: 'no-store',
          });
          if (!res.ok) return securityCache.get(addr)?.data ?? null;
          const body = (await res.json()) as {
            code?: number;
            result?: Record<string, GoPlusEvmSecurity>;
          };
          if (body?.code !== 1) return securityCache.get(addr)?.data ?? null;
          const resultObj = body.result ?? {};
          const entry =
            resultObj[addr] ??
            Object.entries(resultObj).find(([k]) => k.toLowerCase() === addr)?.[1] ??
            null;
          securityCache.set(addr, { data: entry, fetchedAt: Date.now() });
          return entry;
        } catch {
          return securityCache.get(addr)?.data ?? null;
        } finally {
          if (securityInFlight.get(addr) === p) {
            securityInFlight.delete(addr);
          }
        }
      })();
      securityInFlight.set(addr, p);
      waiters.push([addr, p]);
      await p;
    }
  };

  if (toFetch.length > 0) {
    const workers = Array.from(
      { length: Math.min(GOPLUS_CONCURRENCY, toFetch.length) },
      () => runNext(),
    );
    await Promise.all(workers);
  }

  if (waiters.length > 0) {
    const resolved = await Promise.all(
      waiters.map(async ([addr, p]) => [addr, await p] as const),
    );
    for (const [addr, data] of resolved) {
      out.set(addr, data);
    }
  }

  return out;
}

export async function fetchGoPlusRobinhoodSecurity(
  address: string,
): Promise<GoPlusEvmSecurity | null> {
  if (!isEvmAddress(address)) return null;
  const map = await fetchGoPlusRobinhoodSecurityBatch([address]);
  return map.get(address.toLowerCase()) ?? null;
}

function computeTop10NonPoolPct(sec: GoPlusEvmSecurity): number | null {
  if (!Array.isArray(sec.holders) || sec.holders.length === 0) return null;
  const nonPool = sec.holders.filter((h) => !h.is_contract);
  if (nonPool.length === 0) return null;
  const sum = nonPool
    .slice(0, 10)
    .reduce((acc, h) => acc + (Number(h.percent ?? 0) * 100), 0);
  return Number.isFinite(sum) ? Number(Math.min(100, Math.max(0, sum)).toFixed(2)) : null;
}

function computeLpLockedPct(sec: GoPlusEvmSecurity): number | null {
  if (!Array.isArray(sec.lp_holders) || sec.lp_holders.length === 0) return null;
  const lockedSum = sec.lp_holders.reduce(
    (acc, h) => acc + (h.is_locked ? Number(h.percent ?? 0) * 100 : 0),
    0,
  );
  if (!Number.isFinite(lockedSum)) return null;
  return Number(Math.min(100, Math.max(0, lockedSum)).toFixed(2));
}

export function applyGoPlusSecurityToToken(
  token: DiscoveryToken,
  sec: GoPlusEvmSecurity,
): DiscoveryToken {
  const holdersCount = num(sec.holder_count) ?? token.holdersCount;
  const devPctRaw = num(sec.creator_percent);
  const devHoldingsPct =
    devPctRaw !== undefined ? Number((devPctRaw * 100).toFixed(2)) : token.devHoldingsPct;
  const top10HoldingsPct = computeTop10NonPoolPct(sec) ?? token.top10HoldingsPct;
  const lpLockedPct = computeLpLockedPct(sec) ?? token.lpLockedPct;

  const isMintable = parseBoolFlag(sec.is_mintable);
  const isBlacklisted = parseBoolFlag(sec.is_blacklisted);
  const isPausable = parseBoolFlag(sec.transfer_pausable);

  const isMintRenounced = isMintable === undefined ? token.isMintRenounced : !isMintable;
  const isFreezeDisabled =
    isBlacklisted === undefined && isPausable === undefined
      ? token.isFreezeDisabled
      : isBlacklisted !== true && isPausable !== true;

  const isLiquidityLocked =
    lpLockedPct !== null && lpLockedPct !== undefined ? lpLockedPct >= 80 : token.isLiquidityLocked;

  const rugRisk =
    calculateRugRisk({
      top10Pct: top10HoldingsPct,
      devPct: devHoldingsPct,
      mintAuthorityRevoked: isMintRenounced,
      freezeAuthorityRevoked: isFreezeDisabled,
      liquidityLocked: isLiquidityLocked,
    }) ?? token.rugRisk;

  const observedAt = new Date().toISOString();

  return {
    ...token,
    holdersCount: holdersCount ?? undefined,
    top10HoldingsPct: top10HoldingsPct ?? undefined,
    devHoldingsPct: devHoldingsPct ?? undefined,
    devAddress: sec.creator_address && isEvmAddress(sec.creator_address) ? sec.creator_address : token.devAddress,
    lpLockedPct: lpLockedPct ?? undefined,
    isLiquidityLocked,
    isMintRenounced,
    isFreezeDisabled,
    rugRisk,
    auditPending: false,
    ownershipEvidence: {
      status: 'measured',
      source: 'goplus-evm-4663',
      observedAt,
      expiresAt: new Date(Date.now() + SECURITY_TTL_MS).toISOString(),
    },
    securityEvidence: {
      status: 'measured',
      source: 'goplus-evm-4663',
      observedAt,
      expiresAt: new Date(Date.now() + SECURITY_TTL_MS).toISOString(),
    },
  };
}

export function mapGeckoPoolToDiscoveryToken(
  pool: GeckoPoolItem,
  tokenMap: Map<string, GeckoTokenIncluded>,
): DiscoveryToken | null {
  const baseId = pool.relationships?.base_token?.data?.id ?? '';
  const quoteId = pool.relationships?.quote_token?.data?.id ?? '';
  const baseToken = tokenMap.get(baseId);
  const quoteToken = tokenMap.get(quoteId);

  const baseAddr = baseToken?.attributes?.address?.toLowerCase() ?? baseId.replace(/^robinhood_/, '').toLowerCase();
  if (!isEvmAddress(baseAddr)) return null;

  const dexId = pool.relationships?.dex?.data?.id ?? '';
  const dex = resolveRobinhoodDex(dexId);

  const createdMs = pool.attributes.pool_created_at
    ? Date.parse(pool.attributes.pool_created_at)
    : Number.NaN;
  const validCreatedMs = Number.isFinite(createdMs) ? createdMs : null;
  if (validCreatedMs !== null) {
    launchMsCache.set(baseAddr, validCreatedMs);
  }
  const ageMinutes =
    validCreatedMs !== null ? Math.max(0.05, (Date.now() - validCreatedMs) / 60_000) : 0;

  const pChange = pool.attributes.price_change_percentage ?? {};
  const vol = pool.attributes.volume_usd ?? {};
  const txns = pool.attributes.transactions ?? {};

  const tx5 = txns.m5 ?? {};
  const tx15 = txns.m15 ?? txns.m5 ?? {};
  const tx1h = txns.h1 ?? {};
  const tx24 = txns.h24 ?? {};

  const buys1h = num(tx1h.buys) ?? num(tx5.buys);
  const sells1h = num(tx1h.sells) ?? num(tx5.sells);
  const totalTx1h = buys1h !== undefined && sells1h !== undefined ? buys1h + sells1h : undefined;
  const buyPressureRatio =
    totalTx1h !== undefined && totalTx1h > 0 ? (buys1h ?? 0) / totalTx1h : Number.NaN;
  const buySellImbalancePct =
    totalTx1h !== undefined && totalTx1h > 0
      ? Number(((((buys1h ?? 0) - (sells1h ?? 0)) / totalTx1h) * 100).toFixed(1))
      : Number.NaN;

  const buys5m = num(tx5.buys);
  const sells5m = num(tx5.sells);
  const txCount5m = buys5m !== undefined && sells5m !== undefined ? buys5m + sells5m : undefined;

  const buys15 = num(tx15.buys);
  const sells15 = num(tx15.sells);
  const txCount15m = buys15 !== undefined && sells15 !== undefined ? buys15 + sells15 : Number.NaN;

  const buys24 = num(tx24.buys);
  const sells24 = num(tx24.sells);
  const txCount24h = buys24 !== undefined && sells24 !== undefined ? buys24 + sells24 : undefined;

  const priceUsd = num(pool.attributes.base_token_price_usd);
  const liquidityUsd = num(pool.attributes.reserve_in_usd);
  const marketCapUsd = num(pool.attributes.market_cap_usd) ?? num(pool.attributes.fdv_usd);
  const vol5m = num(vol.m5);
  const vol1h = num(vol.h1);
  const vol24h = num(vol.h24);

  const pc5m = num(pChange.m5);
  const pc15m = num(pChange.m15) ?? pc5m;
  const pc1h = num(pChange.h1);
  const pc24h = num(pChange.h24);

  const cleanName = sanitizeTokenName(
    baseToken?.attributes?.name || baseToken?.attributes?.symbol || `Token ${baseAddr.slice(0, 6)}`,
  );
  const cleanSymbol = sanitizeTokenName(
    baseToken?.attributes?.symbol || baseAddr.slice(2, 6).toUpperCase(),
  );

  const discoveryScore = calculateDiscoveryScore(
    {
      ageMinutes,
      priceChangeWindow: pc5m ?? pc1h ?? 0,
      volumeWindowUsd: vol1h ?? 0,
      volumeAccelerationPct: 0,
      liquidityUsd: liquidityUsd ?? 0,
      liquidityChangePct: 0,
      buysCount: buys1h ?? 0,
      sellsCount: sells1h ?? 0,
      holdersCount: 0,
      holderGrowthPct: 0,
      txCount1h: totalTx1h ?? 0,
      buySellImbalancePct: Number.isFinite(buySellImbalancePct) ? buySellImbalancePct : 0,
      buyPressureRatio: Number.isFinite(buyPressureRatio) ? buyPressureRatio : 0.5,
      txAccelerationPct: 0,
      isNewToken: ageMinutes < 30,
    },
    '15m',
  );

  const observedAt = new Date().toISOString();
  const quoteSymbol = quoteToken?.attributes?.symbol || undefined;
  const poolAddressLower = pool.attributes.address?.toLowerCase();

  const buildLaunchpadInfo = (): LaunchpadConfig | undefined => {
    if (!dex.isLaunchpad) return undefined;
    const isPonsV2 = dex.id === 'pons-v2';
    const isNativePair = !quoteSymbol || ['WETH', 'ETH'].includes(quoteSymbol.toUpperCase());
    return {
      id: 'virtuals', // satisfies LaunchpadId union cleanly; display fields below are Robinhood-accurate
      name: dex.name,
      shortName: dex.name,
      tag: isPonsV2 ? 'PONS V2' : dex.name.toUpperCase().slice(0, 8),
      destinationDex: isPonsV2 ? 'Uniswap V4' : 'Robinhood DEX',
      graduationThreshold: isPonsV2
        ? (isNativePair ? '4.2 ETH' : `Quote Target (${quoteSymbol})`)
        : 'Graduates to Robinhood DEX',
      quoteToken: isNativePair ? 'ETH' : 'ERC20',
      lpHandling: 'Locked',
      migrationInstructions: [],
      curveType: isPonsV2 ? 'Pons V2 Bonding Curve (x * y = k)' : 'Robinhood Bonding Curve',
      badgeBg: 'bg-sky-950/60',
      badgeBorder: 'border-sky-800/80',
      badgeText: 'text-sky-400',
    };
  };

  const launchpadInfo = buildLaunchpadInfo();

  const mapped: DiscoveryToken = {
    id: `robinhood:${baseAddr}`,
    name: cleanName.value,
    symbol: cleanSymbol.value,
    mint: baseAddr,
    chain: 'robinhood',
    source: dex.name,
    launchpad: dex.isLaunchpad ? dex.id : undefined,
    launchpadInfo,
    originLaunchpad: dex.isLaunchpad ? dex.name : undefined,
    protocol: dex.name,
    liquidityPoolAddress: poolAddressLower,
    migratedPool: !dex.isLaunchpad ? poolAddressLower : undefined,
    migratedDex: !dex.isLaunchpad ? dex.name : undefined,
    migratedAt: !dex.isLaunchpad ? (validCreatedMs ?? undefined) : undefined,
    bondingStatus: dex.isLaunchpad ? 'bonding' : 'graduated',
    lifecycleState: dex.isLaunchpad ? 'new_pairs' : 'migrated',
    logoURI: baseToken?.attributes?.image_url || undefined,
    ageMinutes,
    ageFormatted: formatAge(ageMinutes),
    priceUsd: money(priceUsd),
    priceChange1m: pc5m ?? Number.NaN,
    priceChange5m: pc5m ?? Number.NaN,
    priceChange15m: pc15m ?? Number.NaN,
    priceChange1h: pc1h ?? Number.NaN,
    priceChange24h: pc24h ?? Number.NaN,
    volume5mUsd: money(vol5m),
    volume1hUsd: money(vol1h),
    volume24hUsd: money(vol24h),
    volumeChange15mPct: Number.NaN,
    liquidityUsd: money(liquidityUsd),
    liquidityChange1hPct: Number.NaN,
    marketCapUsd: money(marketCapUsd),
    buysCount: buys1h ?? Number.NaN,
    sellsCount: sells1h ?? Number.NaN,
    buysCount5m: buys5m,
    sellsCount5m: sells5m,
    buysCount1h: buys1h,
    sellsCount1h: sells1h,
    buysCount24h: buys24,
    sellsCount24h: sells24,
    txCount5m,
    txCount15m,
    txCount1h: totalTx1h ?? Number.NaN,
    txCount24h,
    buySellImbalancePct,
    buyPressureRatio: Number.isFinite(buyPressureRatio) ? Number(buyPressureRatio.toFixed(3)) : Number.NaN,
    txAccelerationPct: Number.NaN,
    isNewToken: ageMinutes > 0 && ageMinutes < 60,
    auditPending: true,
    hasDeceptiveName: cleanName.suspicious || cleanSymbol.suspicious ? true : undefined,
    discoveryScore,
    marketEvidence: {
      status: 'measured',
      source: 'geckoterminal-robinhood',
      observedAt,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    },
    activityEvidence: {
      status: 'measured',
      source: 'geckoterminal-robinhood',
      observedAt,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    },
    graduationTarget: quoteSymbol ? `${cleanSymbol.value}/${quoteSymbol}` : undefined,
  };

  return mapped;
}

function dedupePoolsByToken(tokens: DiscoveryToken[]): DiscoveryToken[] {
  const byToken = new Map<string, DiscoveryToken>();
  for (const token of tokens) {
    const key = token.mint.toLowerCase();
    const existing = byToken.get(key);
    if (!existing) {
      byToken.set(key, token);
      continue;
    }
    // Keep the pool with higher measured liquidity (or more recent activity when tied)
    const existingLiq = Number(existing.liquidityUsd) || 0;
    const nextLiq = Number(token.liquidityUsd) || 0;
    if (nextLiq > existingLiq) {
      byToken.set(key, token);
    }
  }
  return Array.from(byToken.values());
}

async function fetchRobinhoodPoolsFeed(kind: RobinhoodFeedKind): Promise<FeedCacheEntry> {
  const cached = feedCache.get(kind);
  if (cached && cached.tokens.length > 0) {
    if (Date.now() - cached.fetchedAt >= FEED_TTL_MS[kind] && !feedInFlight.has(kind)) {
      void refreshRobinhoodPoolsFeed(kind);
    }
    return cached;
  }

  return refreshRobinhoodPoolsFeed(kind);
}

async function refreshRobinhoodPoolsFeed(kind: RobinhoodFeedKind): Promise<FeedCacheEntry> {
  const cached = feedCache.get(kind);
  if (
    globalForRobinhood.sentinelRhGtRateLimitUntil &&
    Date.now() < globalForRobinhood.sentinelRhGtRateLimitUntil
  ) {
    if (cached && cached.tokens.length > 0) return cached;
    return {
      tokens: [],
      fetchedAt: Date.now(),
      error: 'GeckoTerminal Robinhood rate-limit cooldown active',
    };
  }

  const existing = feedInFlight.get(kind);
  if (existing) return existing;

  const work = (async (): Promise<FeedCacheEntry> => {
    try {
      const url = `${GT_BASE}/${kind}?include=base_token,quote_token,dex&page=1`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6_000),
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 429) {
          globalForRobinhood.sentinelRhGtRateLimitUntil = Date.now() + 30_000;
        }
        throw new Error(`GeckoTerminal Robinhood ${kind} HTTP ${res.status}`);
      }
      const json = (await res.json()) as GeckoPoolsResponse;
      const tokenMap = new Map<string, GeckoTokenIncluded>();
      for (const item of json.included ?? []) {
        if (item.type === 'token') tokenMap.set(item.id, item);
      }

      const rawMapped = (json.data ?? [])
        .map((pool) => mapGeckoPoolToDiscoveryToken(pool, tokenMap))
        .filter((t): t is DiscoveryToken => Boolean(t));

      const tokens = dedupePoolsByToken(rawMapped);

      // Push initial card snapshots into cache so sidebar/live updates merge cleanly
      for (const t of tokens.slice(0, 20)) {
        updateTokenCard(
          t.mint,
          {
            priceUsd: t.priceUsd,
            marketCapUsd: t.marketCapUsd,
            liquidityUsd: t.liquidityUsd,
            volume5mUsd: t.volume5mUsd,
            volume1hUsd: t.volume1hUsd,
            volume24hUsd: t.volume24hUsd,
            buysCount5m: t.buysCount5m,
            sellsCount5m: t.sellsCount5m,
            txCount5m: t.txCount5m,
            liquidityPoolAddress: t.liquidityPoolAddress,
            lifecycleState: t.lifecycleState,
            migratedPool: t.migratedPool,
            migratedDex: t.migratedDex,
            migratedAt: t.migratedAt,
          },
          'geckoterminal-robinhood',
          'fresh',
          t.marketEvidence?.observedAt,
        );
      }

      const next: FeedCacheEntry = { tokens, fetchedAt: Date.now() };
      feedCache.set(kind, next);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (cached && cached.tokens.length > 0) {
        const stale: FeedCacheEntry = { ...cached, error: message };
        feedCache.set(kind, stale);
        return stale;
      }
      return { tokens: [], fetchedAt: Date.now(), error: message };
    } finally {
      feedInFlight.delete(kind);
    }
  })();

  feedInFlight.set(kind, work);
  return work;
}

export function applyPonsV2StateToToken(
  token: DiscoveryToken,
  state: PonsV2CurveState,
): DiscoveryToken {
  if (state.graduated) {
    return {
      ...token,
      bondingCurveProgress: undefined,
      migrationProgress: undefined,
      bondingStatus: 'graduated',
      lifecycleState: 'migrated',
      migratedDex: token.migratedDex ?? 'Uniswap V4',
    };
  }

  const quoteLabel = token.graduationTarget?.includes('(')
    ? token.graduationTarget.slice(token.graduationTarget.indexOf('(') + 1, token.graduationTarget.indexOf(')'))
    : token.graduationTarget?.includes('/')
      ? token.graduationTarget.split('/')[1]
      : undefined;

  const threshWhole = Number(state.graduationThresholdRaw / 10n ** 15n) / 1000;
  const formattedThresh =
    threshWhole > 0
      ? state.isNativeQuote
        ? `${Number.isInteger(threshWhole) ? threshWhole : threshWhole.toFixed(1)} ETH`
        : quoteLabel
          ? `${Number.isInteger(threshWhole) ? threshWhole : threshWhole.toFixed(1)} ${quoteLabel}`
          : token.graduationTarget
      : token.graduationTarget;

  const isFinalStretch = state.progressPct >= 10;

  return {
    ...token,
    bondingCurveProgress: state.progressPct,
    migrationProgress: state.progressPct,
    bondingStatus: isFinalStretch ? 'migrating' : 'bonding',
    lifecycleState: isFinalStretch ? 'final_stretch' : 'new_pairs',
    graduationTarget: formattedThresh ?? token.graduationTarget,
    launchpadInfo: token.launchpadInfo
      ? {
        ...token.launchpadInfo,
        graduationThreshold: formattedThresh ?? token.launchpadInfo.graduationThreshold,
      }
      : undefined,
  };
}

async function enrichPonsV2CurveProgress(tokens: DiscoveryToken[]): Promise<DiscoveryToken[]> {
  const ponsTargets = tokens.filter(
    (t) => t.launchpad === 'pons-v2' && t.liquidityPoolAddress && isEvmAddress(t.liquidityPoolAddress),
  );
  if (ponsTargets.length === 0) return tokens;

  const now = Date.now();
  const stateByPool = new Map<string, PonsV2CurveState>();
  const uncached: string[] = [];
  const staleToRefresh: string[] = [];
  const tokenByPool = new Map<string, DiscoveryToken>();

  for (const t of ponsTargets) {
    const poolAddr = t.liquidityPoolAddress!.toLowerCase();
    tokenByPool.set(poolAddr, t);
    const cached = ponsCurveCache.get(poolAddr);
    if (cached) {
      stateByPool.set(poolAddr, cached.state);
      if (now - cached.fetchedAt >= PONS_CURVE_TTL_MS) {
        staleToRefresh.push(poolAddr);
      }
    } else {
      uncached.push(poolAddr);
    }
  }

  if (uncached.length > 0) {
    const freshStates = await readPonsV2CurveStates(uncached.slice(0, 6)).catch(
      () => new Map<string, PonsV2CurveState>(),
    );
    const fetchedAt = Date.now();
    for (const [poolAddr, state] of freshStates.entries()) {
      ponsCurveCache.set(poolAddr, { state, fetchedAt });
      stateByPool.set(poolAddr, state);
    }
  }

  if (staleToRefresh.length > 0 && !globalForRobinhood.sentinelRhPonsCurveRefreshing) {
    globalForRobinhood.sentinelRhPonsCurveRefreshing = true;
    void readPonsV2CurveStates(staleToRefresh.slice(0, 8))
      .then((freshStates) => {
        const fetchedAt = Date.now();
        for (const [poolAddr, state] of freshStates.entries()) {
          ponsCurveCache.set(poolAddr, { state, fetchedAt });
          const matchToken = tokenByPool.get(poolAddr);
          if (matchToken) {
            const updated = applyPonsV2StateToToken(matchToken, state);
            updateTokenCard(
              updated.mint,
              {
                bondingCurveProgress: updated.bondingCurveProgress,
                lifecycleState: updated.lifecycleState,
                migratedDex: updated.migratedDex,
              },
              'robinhood-pons-v2-rpc',
              'fresh',
            );
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        globalForRobinhood.sentinelRhPonsCurveRefreshing = false;
      });
  }

  return tokens.map((token) => {
    if (token.launchpad !== 'pons-v2' || !token.liquidityPoolAddress) return token;
    const state = stateByPool.get(token.liquidityPoolAddress.toLowerCase());
    if (!state) return token;
    const updated = applyPonsV2StateToToken(token, state);
    updateTokenCard(
      updated.mint,
      {
        bondingCurveProgress: updated.bondingCurveProgress,
        lifecycleState: updated.lifecycleState,
        migratedDex: updated.migratedDex,
      },
      'robinhood-pons-v2-rpc',
      'fresh',
    );
    return updated;
  });
}

function refreshTokenAges(tokens: DiscoveryToken[]): DiscoveryToken[] {
  return tokens.map((token) => {
    const patch = getTokenCardPatch(token.mint);
    const merged = patch ? mergeTokenCardSnapshot(token, patch) : token;
    const launchedAt = launchMsCache.get(merged.mint.toLowerCase());
    if (launchedAt === null || launchedAt === undefined) return merged;
    const ageMinutes = Math.max(0.05, (Date.now() - launchedAt) / 60_000);
    return {
      ...merged,
      ageMinutes,
      ageFormatted: formatAge(ageMinutes),
    };
  });
}

async function getCachedPonsFullState(curveAddress: string): Promise<PonsV2FullCurveState | null> {
  const key = curveAddress.toLowerCase();
  const cached = ponsFullCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < PONS_FULL_STATE_TTL_MS) {
    return cached.state;
  }
  const state = await readPonsV2FullCurveState(key).catch(() => null);
  if (state) {
    const fetchedAt = Date.now();
    ponsFullCache.set(key, { state, fetchedAt });
    ponsCurveCache.set(key, { state, fetchedAt });
  }
  return state;
}

const erc20MetaCache = (globalForRobinhood.sentinelRhErc20MetaCache ??= new Map());

async function getCachedErc20Metadata(tokenAddress: string) {
  const key = tokenAddress.toLowerCase();
  if (erc20MetaCache.has(key)) {
    return erc20MetaCache.get(key) ?? null;
  }
  const meta = await getRobinhoodErc20Metadata(tokenAddress).catch(() => null);
  if (meta) {
    erc20MetaCache.set(key, meta);
  }
  return meta;
}

async function fetchPonsV2RpcFallbackTokens(limit = 16): Promise<DiscoveryToken[]> {
  const rpcCached = globalForRobinhood.sentinelRhRpcFallbackCache;
  if (rpcCached && rpcCached.tokens.length > 0) {
    if (
      Date.now() - rpcCached.fetchedAt >= PONS_RPC_FALLBACK_TTL_MS &&
      !globalForRobinhood.sentinelRhRpcFallbackInFlight
    ) {
      void refreshPonsV2RpcFallbackTokens(limit);
    }
    return rpcCached.tokens;
  }

  return refreshPonsV2RpcFallbackTokens(limit);
}

async function refreshPonsV2RpcFallbackTokens(limit = 16): Promise<DiscoveryToken[]> {
  if (globalForRobinhood.sentinelRhRpcFallbackInFlight) {
    return globalForRobinhood.sentinelRhRpcFallbackInFlight;
  }

  const task = (async (): Promise<DiscoveryToken[]> => {
    try {
      const [launches, ethUsd] = await Promise.all([
        readRecentPonsV2LaunchesFromRpc(limit),
        readOnChainEthUsdPrice(),
      ]);
      if (launches.length === 0) return globalForRobinhood.sentinelRhRpcFallbackCache?.tokens ?? [];

      const latestLaunchBlock = launches[0]?.blockNumber ?? 0;
      const hydrated = await Promise.all(
        launches.slice(0, Math.min(limit, 12)).map(async (launch): Promise<DiscoveryToken | null> => {
          const [curveState, meta] = await Promise.all([
            getCachedPonsFullState(launch.curveAddress),
            getCachedErc20Metadata(launch.tokenAddress),
          ]);
          if (!curveState || !curveState.isNativeQuote) return null;

        const cleanName = sanitizeTokenName(meta?.name || `Token ${launch.tokenAddress.slice(0, 6)}`);
        const cleanSymbol = sanitizeTokenName(meta?.symbol || launch.tokenAddress.slice(2, 6).toUpperCase());
        const launchedAtMs = curveState.launchedAtSec
          ? curveState.launchedAtSec * 1000
          : Date.now() - Math.max(500, Math.max(0, latestLaunchBlock - launch.blockNumber) * 220);
        launchMsCache.set(launch.tokenAddress.toLowerCase(), launchedAtMs);
        const ageMinutes = Math.max(0.05, (Date.now() - launchedAtMs) / 60_000);
        const zeroCurveActivity = curveState.realQuoteReserveRaw === 0n;

        const priceUsdNum =
          ethUsd && curveState.spotPriceInQuote > 0 ? curveState.spotPriceInQuote * ethUsd : undefined;
        const supplyWhole =
          curveState.totalSupplyRaw > 0n
            ? Number(curveState.totalSupplyRaw) / 10 ** curveState.tokenDecimals
            : meta?.totalSupply;
        const marketCapNum =
          priceUsdNum && supplyWhole && supplyWhole > 0 ? priceUsdNum * supplyWhole : undefined;
        const quoteEthReserve = Number(curveState.quoteReserveRaw) / 1e18;
        const realEthReserve = Number(curveState.realQuoteReserveRaw) / 1e18;
        const liquidityUsdNum =
          ethUsd && quoteEthReserve > 0
            ? (realEthReserve > 0 ? realEthReserve * 2 : quoteEthReserve) * ethUsd
            : undefined;
        const devPct =
          curveState.totalSupplyRaw > 0n
            ? Number(
              ((Number(curveState.deployerBalanceRaw) / Number(curveState.totalSupplyRaw)) * 100).toFixed(2),
            )
            : undefined;
        const dex = resolveRobinhoodDex('pons-v2');
        const observedAt = new Date().toISOString();
        const isFinalStretch = !curveState.graduated && curveState.progressPct >= 10;

        const token: DiscoveryToken = {
          id: `robinhood:${launch.tokenAddress}`,
          name: cleanName.value,
          symbol: cleanSymbol.value,
          mint: launch.tokenAddress,
          chain: 'robinhood',
          source: dex.name,
          launchpad: 'pons-v2',
          originLaunchpad: dex.name,
          protocol: dex.name,
          liquidityPoolAddress: launch.curveAddress,
          bondingCurveProgress: curveState.graduated ? undefined : curveState.progressPct,
          migrationProgress: curveState.graduated ? undefined : curveState.progressPct,
          bondingStatus: curveState.graduated
            ? 'graduated'
            : isFinalStretch
              ? 'migrating'
              : 'bonding',
          lifecycleState: curveState.graduated
            ? 'migrated'
            : isFinalStretch
              ? 'final_stretch'
              : 'new_pairs',
          migratedDex: curveState.graduated ? 'Uniswap V4' : undefined,
          ageMinutes,
          ageFormatted: formatAge(ageMinutes),
          priceUsd: money(priceUsdNum),
          priceChange1m: Number.NaN,
          priceChange5m: Number.NaN,
          priceChange15m: Number.NaN,
          priceChange1h: Number.NaN,
          priceChange24h: Number.NaN,
          volume5mUsd: zeroCurveActivity ? '0' : 'NaN',
          volume1hUsd: zeroCurveActivity ? '0' : 'NaN',
          volume24hUsd: zeroCurveActivity ? '0' : 'NaN',
          volumeChange15mPct: Number.NaN,
          liquidityUsd: money(liquidityUsdNum),
          liquidityChange1hPct: Number.NaN,
          marketCapUsd: money(marketCapNum),
          buysCount: zeroCurveActivity ? 0 : Number.NaN,
          sellsCount: zeroCurveActivity ? 0 : Number.NaN,
          buysCount5m: zeroCurveActivity ? 0 : undefined,
          sellsCount5m: zeroCurveActivity ? 0 : undefined,
          txCount5m: zeroCurveActivity ? 0 : undefined,
          txCount15m: zeroCurveActivity ? 0 : Number.NaN,
          txCount1h: zeroCurveActivity ? 0 : Number.NaN,
          buySellImbalancePct: Number.NaN,
          buyPressureRatio: Number.NaN,
          txAccelerationPct: Number.NaN,
          isNewToken: ageMinutes < 60,
          auditPending: false,
          devAddress: curveState.deployerAddress ?? launch.deployerAddress,
          devHoldingsPct: devPct,
          ...(zeroCurveActivity
            ? {
                sniperPercentage: 0,
                sniperCount: 0,
                bundlerPercentage: 0,
                bundlerCount: 0,
              }
            : {}),
          isLiquidityLocked: true,
          discoveryScore: calculateDiscoveryScore(
            {
              ageMinutes,
              priceChangeWindow: 0,
              volumeWindowUsd: 0,
              volumeAccelerationPct: 0,
              liquidityUsd: liquidityUsdNum ?? 0,
              liquidityChangePct: 0,
              buysCount: 0,
              sellsCount: 0,
              holdersCount: 0,
              holderGrowthPct: 0,
              txCount1h: 0,
              buySellImbalancePct: 0,
              buyPressureRatio: 0.5,
              txAccelerationPct: 0,
              isNewToken: ageMinutes < 30,
            },
            '15m',
          ),
          marketEvidence: {
            status: priceUsdNum ? 'measured' : 'unavailable',
            source: 'robinhood-pons-v2-rpc',
            observedAt,
            expiresAt: new Date(Date.now() + 20_000).toISOString(),
          },
          activityEvidence: zeroCurveActivity
            ? {
                status: 'measured',
                source: 'robinhood-pons-v2-rpc',
                observedAt,
                expiresAt: new Date(Date.now() + 20_000).toISOString(),
              }
            : {
                status: 'unavailable',
                source: 'robinhood-pons-v2-rpc',
                observedAt,
                reason: 'DEX volume counters pending upstream indexer refresh.',
              },
          launchpadInfo: {
            id: 'virtuals',
            name: dex.name,
            shortName: dex.name,
            tag: 'PONS V2',
            destinationDex: 'Uniswap V4',
            graduationThreshold: `${Number(curveState.graduationThresholdRaw / 10n ** 15n) / 1000} ETH`,
            quoteToken: 'ETH',
            lpHandling: 'Locked',
            migrationInstructions: [],
            curveType: 'Pons V2 Bonding Curve (x * y = k)',
            badgeBg: 'bg-sky-950/60',
            badgeBorder: 'border-sky-800/80',
            badgeText: 'text-sky-400',
          },
          graduationTarget: `${cleanSymbol.value}/ETH`,
        };
        return token;
      }),
    );

      const valid = hydrated.filter((t): t is DiscoveryToken => Boolean(t));
      if (valid.length > 0) {
        globalForRobinhood.sentinelRhRpcFallbackCache = { tokens: valid, fetchedAt: Date.now() };
        const seenLaunches = (globalForRobinhood.sentinelRhSeenNewLaunches ??= new Set<string>());
        const wasBootstrapped = Boolean(globalForRobinhood.sentinelRhLaunchesBootstrapped);
        globalForRobinhood.sentinelRhLaunchesBootstrapped = true;

        for (const token of valid) {
          const mintKey = token.mint.toLowerCase();
          const isNewLaunch = wasBootstrapped && !seenLaunches.has(mintKey);
          seenLaunches.add(mintKey);
          updateTokenCard(
            token.mint,
            {
              priceUsd: token.priceUsd,
              marketCapUsd: token.marketCapUsd,
              liquidityUsd: token.liquidityUsd,
              bondingCurveProgress: token.bondingCurveProgress,
              ...(isNewLaunch || token.lifecycleState !== 'new_pairs'
                ? { lifecycleState: token.lifecycleState, migratedDex: token.migratedDex }
                : {}),
            },
            'robinhood-pons-v2-rpc',
            'fresh',
            token.marketEvidence?.observedAt,
          );
          if (isNewLaunch) {
            eventBus.emit('event', {
              id: `rh-pons:${mintKey}:${Date.now()}`,
              sequence: Date.now(),
              type: 'TOKEN_CREATED',
              timestamp: Date.now(),
              mint: token.mint,
              name: token.name,
              symbol: token.symbol,
              dex: token.source,
              priceUsd: Number(token.priceUsd) || undefined,
              liquidityUsd: Number(token.liquidityUsd) || undefined,
              extra: { chain: 'robinhood', token },
            });
          }
        }
      }
      return valid;
    } catch {
      return globalForRobinhood.sentinelRhRpcFallbackCache?.tokens ?? [];
    } finally {
      globalForRobinhood.sentinelRhRpcFallbackInFlight = undefined;
    }
  })();

  globalForRobinhood.sentinelRhRpcFallbackInFlight = task;
  return task;
}

const globalForRhSecurity = globalThis as unknown as {
  sentinelRhRedisAuditCheckedAt?: Map<string, number>;
};
const redisAuditCheckedAt = (globalForRhSecurity.sentinelRhRedisAuditCheckedAt ??= new Map());

/**
 * Applies already-cached security/ownership telemetry synchronously so the
 * discovery HTTP response never blocks on GoPlus HTTP queues or Redis timeouts,
 * while warming missing records asynchronously via `updateTokenCard`.
 */
function enrichRobinhoodSecurity(tokens: DiscoveryToken[]): DiscoveryToken[] {
  if (tokens.length === 0) return tokens;
  const targets = tokens.slice(0, 25);
  const now = Date.now();

  const uncachedGoPlusTargets = targets.filter((t) => {
    const norm = t.mint.toLowerCase();
    const cached = securityCache.get(norm);
    return (!cached || now - cached.fetchedAt >= SECURITY_TTL_MS) && !securityInFlight.has(norm);
  });

  if (uncachedGoPlusTargets.length > 0) {
    const addrs = uncachedGoPlusTargets.map((t) => t.mint);
    void fetchGoPlusRobinhoodSecurityBatch(addrs)
      .then((batchMap) => {
        for (const target of uncachedGoPlusTargets) {
          const sec = batchMap.get(target.mint.toLowerCase());
          if (!sec) continue;
          const applied = applyGoPlusSecurityToToken(target, sec);
          updateTokenCard(
            target.mint,
            {
              holdersCount: applied.holdersCount,
              top10HoldingsPct: applied.top10HoldingsPct,
              devHoldingsPct: applied.devHoldingsPct,
              devAddress: applied.devAddress,
              lpLockedPct: applied.lpLockedPct,
              isLiquidityLocked: applied.isLiquidityLocked,
              isMintRenounced: applied.isMintRenounced,
              isFreezeDisabled: applied.isFreezeDisabled,
              rugRisk: applied.rugRisk,
              auditPending: false,
              ownershipEvidence: applied.ownershipEvidence,
              securityEvidence: applied.securityEvidence,
            },
            'goplus-evm-4663',
            'fresh',
            applied.securityEvidence?.observedAt,
          );
        }
      })
      .catch(() => undefined);
  }

  const missingRedisAudits = targets
    .filter((t) => {
      const norm = t.mint.toLowerCase();
      if (getCachedPonsLaunchAudit(norm)) return false;
      const checkedAt = redisAuditCheckedAt.get(norm) ?? 0;
      return now - checkedAt >= 30_000;
    })
    .map((t) => t.mint.toLowerCase());

  if (missingRedisAudits.length > 0) {
    missingRedisAudits.forEach((norm) => redisAuditCheckedAt.set(norm, now));
    void hydratePonsLaunchAuditsFromRedis(missingRedisAudits)
      .then((launchAuditMap) => {
        for (const [norm, launchAudit] of launchAuditMap.entries()) {
          updateTokenCard(
            norm,
            {
              sniperPercentage: launchAudit.sniperPercentage,
              sniperCount: launchAudit.sniperCount,
              bundlerPercentage: launchAudit.bundlerPercentage,
              bundlerCount: launchAudit.bundlerCount,
              ownershipEvidence: {
                status: 'measured',
                source: 'robinhood-pons-launch-scanner',
                observedAt: launchAudit.observedAt,
              },
            },
            'robinhood-pons-launch-scanner',
            'fresh',
            launchAudit.observedAt,
          );
        }
      })
      .catch(() => undefined);
  }

  // Queue background creator reads for Pons V2 pools missing cached deployer metadata
  const missingPonsCreators = targets
    .filter(
      (t) =>
        t.launchpad === 'pons-v2' &&
        t.liquidityPoolAddress &&
        !securityCache.get(t.mint.toLowerCase())?.data?.creator_address &&
        !ponsFullCache.get(t.liquidityPoolAddress.toLowerCase())?.state,
    )
    .slice(0, 6);

  if (missingPonsCreators.length > 0) {
    void Promise.allSettled(
      missingPonsCreators.map(async (t) => {
        const state = await getCachedPonsFullState(t.liquidityPoolAddress!);
        if (!state) return;
        const devPct =
          state.totalSupplyRaw > 0n
            ? Number(((Number(state.deployerBalanceRaw) / Number(state.totalSupplyRaw)) * 100).toFixed(2))
            : undefined;
        updateTokenCard(
          t.mint,
          {
            devAddress: state.deployerAddress ?? undefined,
            devHoldingsPct: devPct,
            isLiquidityLocked: true,
            auditPending: false,
          },
          'robinhood-pons-v2-rpc',
          'fresh',
        );
      }),
    );
  }

  const targetSet = new Set(targets.map((t) => t.mint.toLowerCase()));
  return tokens.map((t) => {
    const norm = t.mint.toLowerCase();
    const cachedSec = securityCache.get(norm)?.data;
    let next = cachedSec ? applyGoPlusSecurityToToken(t, cachedSec) : t;

    const ponsMeta = t.liquidityPoolAddress
      ? ponsFullCache.get(t.liquidityPoolAddress.toLowerCase())?.state
      : undefined;
    if (ponsMeta) {
      const devPct =
        ponsMeta.totalSupplyRaw > 0n
          ? Number(
            ((Number(ponsMeta.deployerBalanceRaw) / Number(ponsMeta.totalSupplyRaw)) * 100).toFixed(2),
          )
          : next.devHoldingsPct;
      next = {
        ...next,
        devAddress: next.devAddress ?? ponsMeta.deployerAddress ?? undefined,
        devHoldingsPct: next.devHoldingsPct ?? devPct,
        isLiquidityLocked: next.isLiquidityLocked ?? true,
        auditPending: false,
      };
    } else if (targetSet.has(norm) && next.auditPending) {
      next = { ...next, auditPending: false };
    }

    const launchAudit = getCachedPonsLaunchAudit(norm);
    if (launchAudit) {
      next = {
        ...next,
        sniperPercentage: launchAudit.sniperPercentage,
        sniperCount: launchAudit.sniperCount,
        bundlerPercentage: launchAudit.bundlerPercentage,
        bundlerCount: launchAudit.bundlerCount,
        ownershipEvidence:
          next.ownershipEvidence?.status === 'measured'
            ? next.ownershipEvidence
            : {
                status: 'measured',
                source: 'robinhood-pons-launch-scanner',
                observedAt: launchAudit.observedAt,
              },
      };
    } else if (targetSet.has(norm) && t.launchpad === 'pons-v2') {
      queuePonsLaunchAudit({
        tokenAddress: norm,
        curveAddress: t.liquidityPoolAddress,
        deployerAddress: next.devAddress ?? null,
        ageMinutes: Number.isFinite(t.ageMinutes) ? t.ageMinutes : null,
      });
    }

    const cardPatch = getTokenCardPatch(t.mint);
    if (cardPatch) {
      next = mergeTokenCardSnapshot(next, cardPatch);
    }

    return next;
  });
}

const MAX_FINAL_STRETCH_AGE_MINUTES = 14 * 24 * 60;
const MAX_MIGRATED_AGE_MINUTES = 7 * 24 * 60;
const FALLBACK_MIGRATED_AGE_MINUTES = 30 * 24 * 60;

export function selectFinalStretchRobinhoodTokens(candidates: DiscoveryToken[]): DiscoveryToken[] {
  const freshCurves = dedupePoolsByToken(candidates).filter(
    (t) =>
      Boolean(t.launchpad) &&
      !isNonMemeRobinhoodToken(t) &&
      t.bondingStatus !== 'graduated' &&
      t.lifecycleState !== 'migrated' &&
      t.ageMinutes <= MAX_FINAL_STRETCH_AGE_MINUTES,
  );

  const highProgress = freshCurves.filter(
    (t) => typeof t.bondingCurveProgress === 'number' && t.bondingCurveProgress >= 10 && t.bondingCurveProgress < 100,
  );
  const activeCurves =
    highProgress.length >= 3
      ? highProgress
      : freshCurves.filter(
        (t) => typeof t.bondingCurveProgress === 'number' && t.bondingCurveProgress > 0 && t.bondingCurveProgress < 100,
      );

  const pool = activeCurves.length > 0 ? activeCurves : freshCurves;
  return [...pool].sort((a, b) => {
    const progDiff = (b.bondingCurveProgress ?? -1) - (a.bondingCurveProgress ?? -1);
    if (Math.abs(progDiff) > 0.01) return progDiff;
    return (Number(b.liquidityUsd) || 0) - (Number(a.liquidityUsd) || 0);
  });
}

export function selectMigratedRobinhoodTokens(candidates: DiscoveryToken[]): DiscoveryToken[] {
  const dexPools = dedupePoolsByToken(
    candidates.filter((t) => !t.launchpad && !isNonMemeRobinhoodToken(t)),
  ).filter(
    (t) =>
      (Number(t.liquidityUsd) || 0) >= 2_500 &&
      (Number(t.marketCapUsd) || 0) >= 5_000,
  );

  const recent = dexPools.filter((t) => t.ageMinutes <= MAX_MIGRATED_AGE_MINUTES);
  const pool = recent.length >= 3
    ? recent
    : dexPools.filter((t) => t.ageMinutes <= FALLBACK_MIGRATED_AGE_MINUTES);

  return [...pool].sort((a, b) => {
    if ((b.migratedAt ?? 0) !== (a.migratedAt ?? 0)) {
      return (b.migratedAt ?? 0) - (a.migratedAt ?? 0);
    }
    return a.ageMinutes - b.ageMinutes;
  });
}

export async function fetchAllLiveRobinhoodTokens(): Promise<DiscoveryToken[]> {
  const [newFeed, trendingFeed, topFeed, ponsFeed, uniV4Feed] = await Promise.all([
    fetchRobinhoodPoolsFeed('new_pools'),
    fetchRobinhoodPoolsFeed('trending_pools'),
    fetchRobinhoodPoolsFeed('pools'),
    fetchRobinhoodPoolsFeed('dexes/pons-v2/pools'),
    fetchRobinhoodPoolsFeed('dexes/uniswap-v4-robinhood/pools'),
  ]);

  const gtCount =
    newFeed.tokens.length +
    trendingFeed.tokens.length +
    topFeed.tokens.length +
    ponsFeed.tokens.length +
    uniV4Feed.tokens.length;

  const rpcPonsFallback =
    gtCount === 0 || ponsFeed.tokens.length === 0 || newFeed.tokens.length === 0
      ? await fetchPonsV2RpcFallbackTokens(16)
      : [];

  return dedupePoolsByToken(
    refreshTokenAges([
      ...newFeed.tokens,
      ...trendingFeed.tokens,
      ...topFeed.tokens,
      ...ponsFeed.tokens,
      ...uniV4Feed.tokens,
      ...rpcPonsFallback,
    ]),
  );
}

const hasPositiveNumeric = (raw: string | undefined): boolean => {
  if (!raw) return false;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0;
};

/**
 * Merges GeckoTerminal `new_pools` (indexer volume/tx/social metadata) with fast
 * on-chain Pons V2 `TokenLaunched` launches (0.22s finality), ensuring newly created
 * pairs surface immediately ahead of GeckoTerminal's ~30-60s indexing delay.
 */
export function mergeRobinhoodNewPairs(
  gtTokens: DiscoveryToken[],
  onChainTokens: DiscoveryToken[],
): DiscoveryToken[] {
  const byMint = new Map<string, DiscoveryToken>();

  for (const gt of gtTokens) {
    if (gt.launchpad === 'pons-v2' && gt.bondingStatus === 'graduated') continue;
    byMint.set(gt.mint.toLowerCase(), gt);
  }

  for (const rpc of onChainTokens) {
    const key = rpc.mint.toLowerCase();
    if (rpc.launchpad === 'pons-v2' && rpc.bondingStatus === 'graduated') {
      byMint.delete(key);
      continue;
    }

    const existing = byMint.get(key);
    if (!existing) {
      byMint.set(key, rpc);
      continue;
    }

    byMint.set(key, {
      ...existing,
      ageMinutes: rpc.ageMinutes > 0 ? rpc.ageMinutes : existing.ageMinutes,
      ageFormatted: rpc.ageMinutes > 0 ? rpc.ageFormatted : existing.ageFormatted,
      isNewToken: rpc.ageMinutes > 0 ? rpc.ageMinutes < 60 : existing.isNewToken,
      priceUsd: hasPositiveNumeric(rpc.priceUsd) ? rpc.priceUsd : existing.priceUsd,
      marketCapUsd: hasPositiveNumeric(rpc.marketCapUsd) ? rpc.marketCapUsd : existing.marketCapUsd,
      liquidityUsd: hasPositiveNumeric(rpc.liquidityUsd) ? rpc.liquidityUsd : existing.liquidityUsd,
      bondingCurveProgress: rpc.bondingCurveProgress ?? existing.bondingCurveProgress,
      migrationProgress: rpc.migrationProgress ?? existing.migrationProgress,
      bondingStatus: rpc.bondingStatus ?? existing.bondingStatus,
      lifecycleState: rpc.lifecycleState ?? existing.lifecycleState,
      migratedDex: rpc.migratedDex ?? existing.migratedDex,
      devAddress: existing.devAddress ?? rpc.devAddress,
      devHoldingsPct: existing.devHoldingsPct ?? rpc.devHoldingsPct,
    });
  }

  return Array.from(byMint.values()).sort((a, b) => {
    const aKnown = Number.isFinite(a.ageMinutes) && a.ageMinutes > 0;
    const bKnown = Number.isFinite(b.ageMinutes) && b.ageMinutes > 0;
    if (aKnown && bKnown) return a.ageMinutes - b.ageMinutes;
    if (aKnown) return -1;
    if (bKnown) return 1;
    return 0;
  });
}

export async function getRobinhoodDiscoveryTokens(
  filter?: Partial<DiscoveryFilter>,
): Promise<DiscoveryToken[]> {
  const section = filter?.section ?? 'new';
  const window: TimeWindow = filter?.timeWindow || '15m';
  const apply = (list: DiscoveryToken[]) => {
    const base = filterDiscoveryTokens(list, { ...filter, chain: 'robinhood' });
    if (filter?.includeZeroLiquidity) return base;
    return base.filter((t) => {
      const liq = Number(t.liquidityUsd);
      return Number.isFinite(liq) && liq > 0;
    });
  };

  let tokens: DiscoveryToken[] = [];

  switch (section) {
    case 'new': {
      const [newFeed, onChainLaunches] = await Promise.all([
        fetchRobinhoodPoolsFeed('new_pools'),
        fetchPonsV2RpcFallbackTokens(8),
      ]);
      const gtFiltered = refreshTokenAges(newFeed.tokens).filter(
        (t) => !isNonMemeRobinhoodToken(t),
      );
      const rpcFiltered = refreshTokenAges(onChainLaunches).filter(
        (t) => !isNonMemeRobinhoodToken(t),
      );
      const enrichedGt = await enrichPonsV2CurveProgress(gtFiltered);
      tokens = apply(mergeRobinhoodNewPairs(enrichedGt, rpcFiltered));
      break;
    }

    case 'trending': {
      const trendingFeed = await fetchRobinhoodPoolsFeed('trending_pools');
      tokens = apply(refreshTokenAges(trendingFeed.tokens)).sort((a, b) => {
        const sA = calculateTrendingScore(a, window).trendingRankScore;
        const sB = calculateTrendingScore(b, window).trendingRankScore;
        return sB - sA;
      });
      break;
    }

    case 'hot': {
      const trendingFeed = await fetchRobinhoodPoolsFeed('trending_pools');
      tokens = apply(refreshTokenAges(trendingFeed.tokens)).sort((a, b) => {
        const txA = a.txCount5m ?? a.txCount1h ?? 0;
        const txB = b.txCount5m ?? b.txCount1h ?? 0;
        return txB - txA;
      });
      break;
    }

    case 'migrating': {
      const [ponsFeed, newFeed, trendingFeed] = await Promise.all([
        fetchRobinhoodPoolsFeed('dexes/pons-v2/pools'),
        fetchRobinhoodPoolsFeed('new_pools'),
        fetchRobinhoodPoolsFeed('trending_pools'),
      ]);
      const rawLaunchpads = refreshTokenAges([
        ...ponsFeed.tokens,
        ...newFeed.tokens.filter((t) => Boolean(t.launchpad)),
        ...trendingFeed.tokens.filter((t) => Boolean(t.launchpad)),
      ]);
      const enrichedLaunchpads = await enrichPonsV2CurveProgress(rawLaunchpads);
      tokens = apply(selectFinalStretchRobinhoodTokens(enrichedLaunchpads));
      break;
    }

    case 'graduated': {
      const [uniV4Feed, newFeed, trendingFeed, topFeed] = await Promise.all([
        fetchRobinhoodPoolsFeed('dexes/uniswap-v4-robinhood/pools'),
        fetchRobinhoodPoolsFeed('new_pools'),
        fetchRobinhoodPoolsFeed('trending_pools'),
        fetchRobinhoodPoolsFeed('pools'),
      ]);
      const candidates = refreshTokenAges([
        ...uniV4Feed.tokens,
        ...newFeed.tokens,
        ...trendingFeed.tokens,
        ...topFeed.tokens,
      ]);
      tokens = apply(selectMigratedRobinhoodTokens(candidates));
      break;
    }

    case 'volume': {
      const topFeed = await fetchRobinhoodPoolsFeed('pools');
      tokens = apply(refreshTokenAges(topFeed.tokens)).sort(
        (a, b) => (Number(b.volume24hUsd) || 0) - (Number(a.volume24hUsd) || 0),
      );
      break;
    }

    case 'liquidity': {
      const topFeed = await fetchRobinhoodPoolsFeed('pools');
      tokens = apply(refreshTokenAges(topFeed.tokens)).sort(
        (a, b) => (Number(b.liquidityUsd) || 0) - (Number(a.liquidityUsd) || 0),
      );
      break;
    }

    case 'top-gainers':
    case 'momentum': {
      const pool = await fetchAllLiveRobinhoodTokens();
      tokens = apply(pool).sort(
        (a, b) => (b.priceChange24h || -999) - (a.priceChange24h || -999),
      );
      break;
    }

    case 'top-losers': {
      const pool = await fetchAllLiveRobinhoodTokens();
      tokens = apply(pool).sort(
        (a, b) => (a.priceChange24h || 999) - (b.priceChange24h || 999),
      );
      break;
    }

    case 'revived': {
      const pool = await fetchAllLiveRobinhoodTokens();
      tokens = apply(pool)
        .filter((t) => t.ageMinutes >= 60 && Number.isFinite(t.priceChange24h) && t.priceChange24h > 0)
        .sort((a, b) => b.priceChange24h - a.priceChange24h);
      break;
    }

    case 'legacy': {
      const topFeed = await fetchRobinhoodPoolsFeed('pools');
      tokens = apply(refreshTokenAges(topFeed.tokens))
        .filter((t) => t.ageMinutes >= 24 * 60)
        .sort((a, b) => (Number(b.marketCapUsd) || 0) - (Number(a.marketCapUsd) || 0));
      break;
    }

    default: {
      const pool = await fetchAllLiveRobinhoodTokens();
      tokens = apply(pool);
      break;
    }
  }

  return enrichRobinhoodSecurity(tokens);
}
