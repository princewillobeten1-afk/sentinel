import {
  getRobinhoodErc20Metadata,
  getRobinhoodEthBalance,
} from '@/lib/blockchain/robinhood-rpc';
import {
  findUniswapV4PoolByTokenFromRpc,
  readOnChainAuditSignals,
  readOnChainEthUsdPrice,
  readPonsV2FullCurveState,
  readPonsV2LaunchedCurveByToken,
  readRecentPoolTradesFromRpc,
} from '@/lib/blockchain/robinhood-rpc-protocols';
import {
  quoteAndBuildRobinhoodSwap,
  type RobinhoodSwapQuoteResult,
} from '@/lib/trading/robinhood-swap';
import {
  ROBINHOOD_USDG_ADDRESS,
  ROBINHOOD_WETH_ADDRESS,
  isEvmAddress,
} from '@/lib/chains/chain-config';
import { resolveRobinhoodDex } from '@/lib/chains/robinhood-dex-registry';
import {
  applyGoPlusSecurityToToken,
  fetchGoPlusRobinhoodSecurity,
  mapGeckoPoolToDiscoveryToken,
  type GoPlusEvmSecurity,
} from '@/lib/discovery/robinhood-feed';
import { formatAge } from '@/lib/discovery/format';
import {
  getCachedPonsLaunchAudit,
  hydratePonsLaunchAuditsFromRedis,
  queuePonsLaunchAudit,
} from '@/lib/market/enrichment/robinhood-pons-sniper';
import {
  CHART_SECONDS,
  mergeChartCandles,
  type ChartCandle,
  type ChartSnapshot,
  type ChartTimeframe,
} from '@/lib/market/chart-model';
import { calculateRugRisk } from '@/lib/market/enrichment/rug-risk';
import type { TapeTrade } from '@/lib/market/trade-tape';
import type { TokenAudit } from '@/lib/trading/audit-model';
import type { TradeSidebarSnapshot } from '@/lib/trading/sidebar-model';
import { registerRobinhoodPoolWatch } from '@/lib/market/live/robinhood-event-stream';
import type { MetricEvidence } from '@/lib/discovery/types';

const GT_BASE = 'https://api.geckoterminal.com/api/v2/networks/robinhood';
const DEXSCREENER_PAIRS = 'https://api.dexscreener.com/token-pairs/v1/robinhood';
const DEXSCREENER_ORDERS = 'https://api.dexscreener.com/orders/v1/robinhood';

interface CachedPoolResolve {
  poolAddress: string | null;
  dexId?: string;
  quoteAddress?: string;
  quoteSymbol?: string;
  priceUsd?: number;
  liquidityUsd?: number;
  fetchedAt: number;
}

const poolCache = new Map<string, CachedPoolResolve>();
const chartCache = new Map<string, { at: number; snapshot: ChartSnapshot }>();

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function boolFlag(value: unknown): boolean | null {
  if (value === '1' || value === 1 || value === true) return true;
  if (value === '0' || value === 0 || value === false) return false;
  return null;
}

const UPSTREAM_TTL_MS = 30_000;
const GT_COOLDOWN_MS = 25_000;
let geckoCooldownUntil = 0;
const dexPairsCache = new Map<string, { at: number; value: any[] }>();
const dexPairsInFlight = new Map<string, Promise<any[]>>();
const geckoPoolsCache = new Map<string, { at: number; value: { pools: any[]; includedMap: Map<string, any> } }>();
const geckoPoolsInFlight = new Map<string, Promise<{ pools: any[]; includedMap: Map<string, any> }>>();
const geckoInfoCache = new Map<string, { at: number; value: any | null }>();
const geckoInfoInFlight = new Map<string, Promise<any | null>>();

function isGtCooldownActive(): boolean {
  return Date.now() < geckoCooldownUntil;
}

function noteGtHttpStatus(status: number): void {
  if (status === 429) {
    geckoCooldownUntil = Date.now() + GT_COOLDOWN_MS;
  }
}

async function withTtlInflight<T>(
  cache: Map<string, { at: number; value: T }>,
  inFlight: Map<string, Promise<T>>,
  key: string,
  loader: () => Promise<T>,
  shouldCache: (val: T) => boolean = () => true,
): Promise<T> {
  const norm = key.toLowerCase();
  const hit = cache.get(norm);
  if (hit && Date.now() - hit.at < UPSTREAM_TTL_MS) {
    return hit.value;
  }
  const existing = inFlight.get(norm);
  if (existing) return existing;

  const work = (async () => {
    try {
      const value = await loader();
      if (shouldCache(value)) {
        cache.set(norm, { at: Date.now(), value });
      }
      return value;
    } finally {
      inFlight.delete(norm);
    }
  })();

  inFlight.set(norm, work);
  return work;
}

async function fetchDexScreenerPairs(address: string): Promise<any[]> {
  return withTtlInflight(
    dexPairsCache,
    dexPairsInFlight,
    address,
    async () => {
      try {
        const res = await fetch(`${DEXSCREENER_PAIRS}/${address.toLowerCase()}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(4_500),
          cache: 'no-store',
        });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : Array.isArray(json?.pairs) ? json.pairs : [];
      } catch {
        return [];
      }
    },
    (pairs) => pairs.length > 0,
  );
}

async function fetchGeckoTokenPools(address: string): Promise<{
  pools: any[];
  includedMap: Map<string, any>;
}> {
  const norm = address.toLowerCase();
  if (isGtCooldownActive()) {
    const stale = geckoPoolsCache.get(norm);
    return stale ? stale.value : { pools: [], includedMap: new Map() };
  }
  return withTtlInflight(
    geckoPoolsCache,
    geckoPoolsInFlight,
    norm,
    async () => {
      try {
        const res = await fetch(
          `${GT_BASE}/tokens/${norm}/pools?include=base_token,quote_token,dex`,
          {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5_000),
            cache: 'no-store',
          },
        );
        noteGtHttpStatus(res.status);
        if (!res.ok) {
          const stale = geckoPoolsCache.get(norm);
          return stale ? stale.value : { pools: [], includedMap: new Map() };
        }
        const json = await res.json();
        const includedMap = new Map<string, any>();
        for (const item of json?.included ?? []) {
          if (item?.id) includedMap.set(item.id, item);
        }
        return {
          pools: Array.isArray(json?.data) ? json.data : [],
          includedMap,
        };
      } catch {
        const stale = geckoPoolsCache.get(norm);
        return stale ? stale.value : { pools: [], includedMap: new Map() };
      }
    },
    (res) => res.pools.length > 0,
  );
}

async function fetchGeckoTokenInfo(address: string): Promise<any | null> {
  const norm = address.toLowerCase();
  if (isGtCooldownActive()) {
    return geckoInfoCache.get(norm)?.value ?? null;
  }
  return withTtlInflight(
    geckoInfoCache,
    geckoInfoInFlight,
    norm,
    async () => {
      try {
        const res = await fetch(`${GT_BASE}/tokens/${norm}/info`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(4_500),
          cache: 'no-store',
        });
        noteGtHttpStatus(res.status);
        if (!res.ok) return geckoInfoCache.get(norm)?.value ?? null;
        const json = await res.json();
        return json?.data?.attributes ?? null;
      } catch {
        return geckoInfoCache.get(norm)?.value ?? null;
      }
    },
    (info) => info !== null,
  );
}

async function fetchDexPaidStatusRobinhood(address: string): Promise<boolean | undefined> {
  try {
    const res = await fetch(`${DEXSCREENER_ORDERS}/${address}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3_500),
      cache: 'no-store',
    });
    if (!res.ok) return undefined;
    const body = await res.json();
    const orders = Array.isArray(body) ? body : Array.isArray(body?.orders) ? body.orders : [];
    return orders.some((o: any) => o?.status === 'approved');
  } catch {
    return undefined;
  }
}

async function resolveOnChainPoolFallback(norm: string): Promise<CachedPoolResolve | null> {
  const [curveAddr, ethUsd] = await Promise.all([
    readPonsV2LaunchedCurveByToken(norm),
    readOnChainEthUsdPrice(),
  ]);

  if (curveAddr) {
    const curve = await readPonsV2FullCurveState(curveAddr);
    if (curve && !curve.graduated) {
      const priceUsd =
        curve.isNativeQuote && ethUsd && curve.spotPriceInQuote > 0
          ? curve.spotPriceInQuote * ethUsd
          : undefined;
      const quoteEth = Number(curve.quoteReserveRaw) / 1e18;
      const realEth = Number(curve.realQuoteReserveRaw) / 1e18;
      const liquidityUsd =
        curve.isNativeQuote && ethUsd && quoteEth > 0
          ? (realEth > 0 ? realEth * 2 : quoteEth) * ethUsd
          : undefined;
      return {
        poolAddress: curveAddr.toLowerCase(),
        dexId: 'pons-v2',
        quoteAddress: ROBINHOOD_WETH_ADDRESS.toLowerCase(),
        quoteSymbol: 'ETH',
        priceUsd,
        liquidityUsd,
        fetchedAt: Date.now(),
      };
    }
  }

  const v4 = await findUniswapV4PoolByTokenFromRpc(norm);
  if (v4) {
    const { currency0, currency1 } = v4.poolKey;
    const is0Target = currency0.toLowerCase() === norm;
    const quoteCurrency = is0Target ? currency1 : currency0;
    const isQuoteUsdg = quoteCurrency.toLowerCase() === ROBINHOOD_USDG_ADDRESS.toLowerCase();
    const isQuoteEth =
      quoteCurrency === '0x0000000000000000000000000000000000000000' ||
      quoteCurrency.toLowerCase() === ROBINHOOD_WETH_ADDRESS.toLowerCase();

    const meta = await getRobinhoodErc20Metadata(norm).catch(() => null);
    const targetDec = meta?.decimals ?? 18;
    const quoteDec = isQuoteUsdg ? 6 : 18;
    const dec0 = is0Target ? targetDec : quoteDec;
    const dec1 = is0Target ? quoteDec : targetDec;
    const rawRatio1Per0 = (Number(v4.sqrtPriceX96) / 2 ** 96) ** 2;
    const human1Per0 = rawRatio1Per0 * 10 ** (dec0 - dec1);
    const priceInQuote = is0Target ? human1Per0 : human1Per0 > 0 ? 1 / human1Per0 : 0;
    const priceUsd =
      priceInQuote > 0
        ? isQuoteUsdg
          ? priceInQuote
          : isQuoteEth && ethUsd
            ? priceInQuote * ethUsd
            : undefined
        : undefined;

    return {
      poolAddress: v4.poolId.toLowerCase(),
      dexId: 'uniswap-v4-robinhood',
      quoteAddress: quoteCurrency.toLowerCase(),
      quoteSymbol: isQuoteUsdg ? 'USDG' : 'ETH',
      priceUsd,
      fetchedAt: Date.now(),
    };
  }

  return null;
}

function normalizeDexScreenerDexId(
  dexId?: string,
  labels?: unknown[],
  pairAddress?: string,
): string | undefined {
  const raw = (dexId || '').trim().toLowerCase();
  const normalizedLabels = Array.isArray(labels)
    ? labels.map((l) => String(l).trim().toLowerCase())
    : [];
  if ((pairAddress && /^0x[a-f0-9]{64}$/i.test(pairAddress)) || normalizedLabels.includes('v4')) {
    return !raw || raw.includes('uniswap') ? 'uniswap-v4-robinhood' : dexId;
  }
  if (raw.includes('uniswap')) {
    if (normalizedLabels.includes('v3')) return 'uniswap-v3-robinhood';
    if (normalizedLabels.includes('v2')) return 'uniswap-v2-robinhood';
  }
  return dexId;
}

export async function resolveBestRobinhoodPool(address: string): Promise<CachedPoolResolve> {
  const norm = address.toLowerCase();
  const cached = poolCache.get(norm);
  if (cached && Date.now() - cached.fetchedAt < 30_000 && cached.poolAddress) {
    return cached;
  }

  const [{ pools }, pairs] = await Promise.all([
    fetchGeckoTokenPools(norm),
    fetchDexScreenerPairs(norm),
  ]);

  let resolved: CachedPoolResolve = {
    poolAddress: null,
    fetchedAt: Date.now(),
  };

  if (pools.length > 0) {
    const best = pools.reduce((acc, curr) => {
      const aLiq = Number(acc?.attributes?.reserve_in_usd ?? 0);
      const bLiq = Number(curr?.attributes?.reserve_in_usd ?? 0);
      return bLiq > aLiq ? curr : acc;
    }, pools[0]);
    const poolAddr = best?.attributes?.address ?? null;
    if (poolAddr) {
      const gtLiq = num(best?.attributes?.reserve_in_usd);
      const matchingPair =
        pairs.find((p) => String(p?.pairAddress || '').toLowerCase() === poolAddr.toLowerCase()) ??
        pairs[0];
      const dsLiq = num(matchingPair?.liquidity?.usd);
      resolved = {
        poolAddress: poolAddr.toLowerCase(),
        dexId: normalizeDexScreenerDexId(
          best?.relationships?.dex?.data?.id ?? matchingPair?.dexId,
          matchingPair?.labels,
          poolAddr,
        ),
        quoteAddress: best?.relationships?.quote_token?.data?.id?.replace(/^robinhood_/, ''),
        priceUsd: num(best?.attributes?.base_token_price_usd) ?? num(matchingPair?.priceUsd),
        liquidityUsd: gtLiq && gtLiq > 0 ? gtLiq : dsLiq,
        fetchedAt: Date.now(),
      };
    }
  } else if (pairs.length > 0) {
    const bestPair = pairs.reduce((acc, curr) =>
      (curr?.liquidity?.usd ?? 0) > (acc?.liquidity?.usd ?? 0) ? curr : acc,
    );
    const pairAddr = bestPair?.pairAddress ? String(bestPair.pairAddress).toLowerCase() : null;
    resolved = {
      poolAddress: pairAddr,
      dexId: normalizeDexScreenerDexId(bestPair?.dexId, bestPair?.labels, pairAddr ?? undefined),
      quoteAddress: bestPair?.quoteToken?.address,
      quoteSymbol: bestPair?.quoteToken?.symbol,
      priceUsd: num(bestPair?.priceUsd),
      liquidityUsd: num(bestPair?.liquidity?.usd),
      fetchedAt: Date.now(),
    };
  } else {
    const onChain = await resolveOnChainPoolFallback(norm);
    if (onChain) resolved = onChain;
  }

  if (resolved.poolAddress) {
    registerRobinhoodPoolWatch(norm, resolved.poolAddress);
  }
  poolCache.set(norm, resolved);
  return resolved;
}

export async function getRobinhoodTokenDetail(address: string) {
  const norm = address.toLowerCase();
  const [{ pools, includedMap }, pairs, tokenInfo, erc20Meta, security] = await Promise.all([
    fetchGeckoTokenPools(norm),
    fetchDexScreenerPairs(norm),
    fetchGeckoTokenInfo(norm),
    getRobinhoodErc20Metadata(norm).catch(() => null),
    fetchGoPlusRobinhoodSecurity(norm),
  ]);

  const bestGtPool = pools[0];
  const baseMapped = bestGtPool ? mapGeckoPoolToDiscoveryToken(bestGtPool, includedMap) : null;
  const bestPair =
    pairs.length > 0
      ? pairs.reduce((prev, curr) =>
          (curr?.liquidity?.usd ?? 0) > (prev?.liquidity?.usd ?? 0) ? curr : prev,
        )
      : null;

  const isWeth = norm === ROBINHOOD_WETH_ADDRESS.toLowerCase();
  const isUsdg = norm === ROBINHOOD_USDG_ADDRESS.toLowerCase();
  const matchingBaseSide =
    bestPair?.baseToken?.address?.toLowerCase() === norm ? bestPair.baseToken : null;
  const matchingQuoteSide =
    bestPair?.quoteToken?.address?.toLowerCase() === norm ? bestPair.quoteToken : null;
  const pairTokenMeta = matchingBaseSide ?? matchingQuoteSide;

  const name =
    baseMapped?.name ||
    tokenInfo?.name ||
    pairTokenMeta?.name ||
    erc20Meta?.name ||
    (isWeth ? 'Wrapped Ether' : isUsdg ? 'Global Dollar' : `Token ${norm.slice(0, 6)}`);
  const symbol =
    baseMapped?.symbol ||
    tokenInfo?.symbol ||
    pairTokenMeta?.symbol ||
    erc20Meta?.symbol ||
    (isWeth ? 'WETH' : isUsdg ? 'USDG' : norm.slice(2, 6).toUpperCase());

  const priceUsd =
    baseMapped?.priceUsd ||
    (matchingBaseSide && bestPair?.priceUsd ? String(bestPair.priceUsd) : undefined);

  const pairCreatedAt = bestGtPool?.attributes?.pool_created_at
    ? Date.parse(bestGtPool.attributes.pool_created_at)
    : bestPair?.pairCreatedAt ?? undefined;
  const ageMinutes =
    typeof pairCreatedAt === 'number' && pairCreatedAt > 0
      ? Math.max(0.05, (Date.now() - pairCreatedAt) / 60_000)
      : baseMapped?.ageMinutes;

  const totalSupply =
    num(security?.total_supply) ??
    erc20Meta?.totalSupply ??
    (bestPair?.fdv && num(priceUsd) ? Math.round(bestPair.fdv / num(priceUsd)!) : undefined);

  let resolvedPoolFallback: CachedPoolResolve | null = null;
  if (!baseMapped?.liquidityPoolAddress && !bestPair?.pairAddress) {
    resolvedPoolFallback = await resolveOnChainPoolFallback(norm);
  }
  const onChainSignals =
    !security?.creator_address || !baseMapped?.priceUsd
      ? await readOnChainAuditSignals(norm).catch(() => null)
      : null;

  const dexInfo = resolveRobinhoodDex(
    normalizeDexScreenerDexId(
      bestGtPool?.relationships?.dex?.data?.id ?? bestPair?.dexId ?? resolvedPoolFallback?.dexId,
      bestPair?.labels,
      baseMapped?.liquidityPoolAddress ?? bestPair?.pairAddress ?? resolvedPoolFallback?.poolAddress,
    ),
  );
  const effectivePoolAddr =
    baseMapped?.liquidityPoolAddress ?? bestPair?.pairAddress ?? resolvedPoolFallback?.poolAddress;
  const fallbackPriceNum = resolvedPoolFallback?.priceUsd;
  const effectivePriceUsd =
    priceUsd ?? (fallbackPriceNum && fallbackPriceNum > 0 ? String(fallbackPriceNum) : undefined);
  const effectiveLiqUsd =
    (Number(baseMapped?.liquidityUsd) > 0 ? baseMapped?.liquidityUsd : undefined) ??
    (bestPair?.liquidity?.usd && bestPair.liquidity.usd > 0
      ? String(bestPair.liquidity.usd)
      : resolvedPoolFallback?.liquidityUsd && resolvedPoolFallback.liquidityUsd > 0
        ? String(resolvedPoolFallback.liquidityUsd)
        : undefined) ??
    baseMapped?.liquidityUsd;
  const effectiveMcapUsd =
    baseMapped?.marketCapUsd ||
    (bestPair?.marketCap
      ? String(bestPair.marketCap)
      : bestPair?.fdv
        ? String(bestPair.fdv)
        : effectivePriceUsd && totalSupply
          ? String(Number(effectivePriceUsd) * totalSupply)
          : undefined);
  const ponsAgeMinutes =
    onChainSignals?.ponsCurve?.launchedAtSec
      ? Math.max(0.05, (Date.now() - onChainSignals.ponsCurve.launchedAtSec * 1000) / 60_000)
      : undefined;
  const finalAgeMinutes = ageMinutes ?? ponsAgeMinutes;
  const onChainDevPct =
    onChainSignals?.ponsCurve && onChainSignals.ponsCurve.totalSupplyRaw > 0n
      ? Number(
          (
            (Number(onChainSignals.ponsCurve.deployerBalanceRaw) /
              Number(onChainSignals.ponsCurve.totalSupplyRaw)) *
            100
          ).toFixed(2),
        )
      : undefined;

  let detail = {
    id: norm,
    mint: norm,
    name,
    symbol,
    chain: 'robinhood',
    source: dexInfo.name,
    dexId: dexInfo.id,
    protocol: dexInfo.name,
    poolAddress: effectivePoolAddr,
    liquidityPoolAddress: effectivePoolAddr,
    pairCreatedAt:
      pairCreatedAt ??
      (onChainSignals?.ponsCurve?.launchedAtSec
        ? onChainSignals.ponsCurve.launchedAtSec * 1000
        : undefined),
    ageMinutes: finalAgeMinutes,
    ageFormatted: finalAgeMinutes !== undefined ? formatAge(finalAgeMinutes) : undefined,
    priceUsd: effectivePriceUsd,
    priceChange5m: baseMapped?.priceChange5m ?? bestPair?.priceChange?.m5,
    priceChange1h: baseMapped?.priceChange1h ?? bestPair?.priceChange?.h1,
    priceChange24h: baseMapped?.priceChange24h ?? bestPair?.priceChange?.h24,
    volume5mUsd: baseMapped?.volume5mUsd ?? (bestPair?.volume?.m5 ? String(bestPair.volume.m5) : undefined),
    volume1hUsd: baseMapped?.volume1hUsd ?? (bestPair?.volume?.h1 ? String(bestPair.volume.h1) : undefined),
    volume24hUsd: baseMapped?.volume24hUsd ?? (bestPair?.volume?.h24 ? String(bestPair.volume.h24) : undefined),
    liquidityUsd: effectiveLiqUsd,
    marketCapUsd: effectiveMcapUsd,
    fdv: bestPair?.fdv ?? (effectiveMcapUsd ? Number(effectiveMcapUsd) : undefined),
    totalSupply,
    circulatingSupply: totalSupply,
    decimals: tokenInfo?.decimals ?? erc20Meta?.decimals ?? onChainSignals?.ponsCurve?.tokenDecimals ?? 18,
    logoUrl: baseMapped?.logoURI ?? tokenInfo?.image_url ?? bestPair?.info?.imageUrl,
    logoURI: baseMapped?.logoURI ?? tokenInfo?.image_url ?? bestPair?.info?.imageUrl,
    websiteUrl: tokenInfo?.websites?.[0] ?? bestPair?.info?.websites?.[0]?.url,
    twitterUrl: tokenInfo?.twitter_handle
      ? `https://x.com/${tokenInfo.twitter_handle}`
      : bestPair?.info?.socials?.find((s: any) => s.type === 'twitter')?.url,
    telegramUrl: tokenInfo?.telegram_handle
      ? `https://t.me/${tokenInfo.telegram_handle}`
      : bestPair?.info?.socials?.find((s: any) => s.type === 'telegram')?.url,
    socials: {
      website: tokenInfo?.websites?.[0] ?? bestPair?.info?.websites?.[0]?.url,
      twitter: tokenInfo?.twitter_handle
        ? `https://x.com/${tokenInfo.twitter_handle}`
        : bestPair?.info?.socials?.find((s: any) => s.type === 'twitter')?.url,
      telegram: tokenInfo?.telegram_handle
        ? `https://t.me/${tokenInfo.telegram_handle}`
        : bestPair?.info?.socials?.find((s: any) => s.type === 'telegram')?.url,
    },
    buysCount5m: baseMapped?.buysCount5m ?? bestPair?.txns?.m5?.buys,
    sellsCount5m: baseMapped?.sellsCount5m ?? bestPair?.txns?.m5?.sells,
    buysCount24h: baseMapped?.buysCount24h ?? bestPair?.txns?.h24?.buys,
    sellsCount24h: baseMapped?.sellsCount24h ?? bestPair?.txns?.h24?.sells,
    holdersCount: num(security?.holder_count),
    devAddress: security?.creator_address ?? onChainSignals?.ponsCurve?.deployerAddress ?? undefined,
    isContractVerified:
      boolFlag(security?.is_open_source) ?? onChainSignals?.isContractVerifiedHint ?? undefined,
    ...(onChainDevPct !== undefined ? { devHoldingsPct: onChainDevPct } : {}),
    ...(onChainSignals?.ponsCurve ? { lpLockedPct: 100, isLiquidityLocked: true } : {}),
  };

  if (baseMapped && security) {
    const secured = applyGoPlusSecurityToToken(baseMapped, security);
    detail = {
      ...detail,
      holdersCount: secured.holdersCount ?? undefined,
      devAddress: secured.devAddress ?? detail.devAddress,
      ...({
        top10HoldingsPct: secured.top10HoldingsPct,
        devHoldingsPct: secured.devHoldingsPct,
        lpLockedPct: secured.lpLockedPct,
        riskScore: secured.rugRisk?.score,
        riskTier: secured.rugRisk?.level,
        isMintRenounced: secured.isMintRenounced,
        isFreezeDisabled: secured.isFreezeDisabled,
        isLiquidityLocked: secured.isLiquidityLocked,
      } as Record<string, unknown>),
    };
  }

  return detail;
}

export async function getRobinhoodTokenCard(address: string): Promise<TradeSidebarSnapshot> {
  const norm = address.toLowerCase();
  const [detail, security, isDexPaid, launchAuditMap] = await Promise.all([
    getRobinhoodTokenDetail(norm),
    fetchGoPlusRobinhoodSecurity(norm),
    fetchDexPaidStatusRobinhood(norm),
    hydratePonsLaunchAuditsFromRedis([norm]).catch(() => new Map()),
  ]);

  const launchAudit = launchAuditMap.get(norm) ?? getCachedPonsLaunchAudit(norm);
  if (!launchAudit && detail.dexId === 'pons-v2') {
    queuePonsLaunchAudit({
      tokenAddress: norm,
      curveAddress: detail.liquidityPoolAddress,
      deployerAddress: detail.devAddress ?? null,
      ageMinutes: detail.ageMinutes ?? null,
      priority: 'high',
    });
  }

  let devBalanceEth: number | null = null;
  if (detail.devAddress && isEvmAddress(detail.devAddress)) {
    devBalanceEth = await getRobinhoodEthBalance(detail.devAddress).catch(() => null);
  }

  const nowIso = new Date().toISOString();
  const vol5m = num(detail.volume5mUsd);
  const buys5m = detail.buysCount5m ?? 0;
  const sells5m = detail.sellsCount5m ?? 0;
  const total5mTx = buys5m + sells5m;
  const buyVol5m =
    vol5m !== undefined && total5mTx > 0 ? (vol5m * buys5m) / total5mTx : null;
  const sellVol5m =
    vol5m !== undefined && total5mTx > 0 ? (vol5m * sells5m) / total5mTx : null;

  const top10Pct = (detail as any).top10HoldingsPct ?? null;
  const devPct = (detail as any).devHoldingsPct ?? null;
  const lpLockedPct = (detail as any).lpLockedPct ?? null;

  return {
    mint: norm,
    chain: 'robinhood',
    name: detail.name,
    symbol: detail.symbol,
    source: detail.source,
    protocol: detail.protocol,
    logoURI: detail.logoURI,
    liquidityPoolAddress: detail.liquidityPoolAddress,
    priceUsd: detail.priceUsd ?? '',
    marketCapUsd: detail.marketCapUsd ?? '',
    liquidityUsd: detail.liquidityUsd ?? '',
    volume5mUsd: detail.volume5mUsd ?? '',
    volume1hUsd: detail.volume1hUsd ?? '',
    volume24hUsd: detail.volume24hUsd ?? '',
    buysCount5m: detail.buysCount5m,
    sellsCount5m: detail.sellsCount5m,
    buyVolume5mUsd: buyVol5m,
    sellVolume5mUsd: sellVol5m,
    holdersCount: num(security?.holder_count) ?? detail.holdersCount ?? null,
    top10HoldingsPct: top10Pct,
    devHoldingsPct: devPct,
    lpLockedPct,
    isLiquidityLocked: lpLockedPct !== null ? lpLockedPct >= 80 : undefined,
    isMintRenounced: (detail as any).isMintRenounced,
    isFreezeDisabled: (detail as any).isFreezeDisabled,
    devAddress: detail.devAddress,
    devBalanceSol: devBalanceEth,
    isDexPaid,
    proTradersCount: null,
    kolsCount: null,
    sniperPercentage: launchAudit?.sniperPercentage ?? null,
    sniperCount: launchAudit?.sniperCount ?? null,
    insiderHoldingsPct: null,
    bundlerPercentage: launchAudit?.bundlerPercentage ?? null,
    bundlerCount: launchAudit?.bundlerCount ?? null,
    marketEvidence: {
      status: detail.priceUsd ? 'measured' : 'unavailable',
      source: 'geckoterminal-robinhood',
      observedAt: nowIso,
    },
    activityEvidence: {
      status: vol5m !== undefined || total5mTx > 0 ? 'measured' : 'unavailable',
      source: 'geckoterminal-robinhood',
      observedAt: nowIso,
    },
    ownershipEvidence: security
      ? {
          status: 'measured',
          source: 'goplus-evm-4663',
          observedAt: nowIso,
        }
      : launchAudit
        ? {
            status: 'measured',
            source: 'robinhood-pons-launch-scanner',
            observedAt: launchAudit.observedAt,
          }
        : {
            status: 'unavailable',
            source: 'goplus-evm-4663',
            observedAt: nowIso,
            reason: 'GoPlus security report unavailable for this contract.',
          },
    liquidityEvidence: security?.lp_holders
      ? {
          status: 'measured',
          source: 'goplus-evm-4663',
          observedAt: nowIso,
        }
      : {
          status: 'unavailable',
          source: 'goplus-evm-4663',
          observedAt: nowIso,
          reason: 'LP lock telemetry unavailable for this pool.',
        },
    devBalanceEvidence:
      devBalanceEth !== null
        ? {
            status: 'measured',
            source: 'robinhood-rpc',
            observedAt: nowIso,
          }
        : undefined,
  };
}

function geckoOhlcvParams(timeframe: ChartTimeframe): { unit: string; aggregate: number } {
  switch (timeframe) {
    case '1m':
      return { unit: 'minute', aggregate: 1 };
    case '5m':
      return { unit: 'minute', aggregate: 5 };
    case '15m':
      return { unit: 'minute', aggregate: 15 };
    case '1h':
      return { unit: 'hour', aggregate: 1 };
    case '4h':
      return { unit: 'hour', aggregate: 4 };
    case '1d':
      return { unit: 'day', aggregate: 1 };
  }
}

function buildCandlesFromTrades(trades: TapeTrade[], stepSec: number): ChartCandle[] {
  const buckets = new Map<number, ChartCandle>();
  const chronological = [...trades].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  for (const t of chronological) {
    if (typeof t.priceUsd !== 'number' || !Number.isFinite(t.priceUsd) || t.priceUsd <= 0) {
      continue;
    }
    const tsSec = Math.floor(Date.parse(t.timestamp) / 1000);
    if (!Number.isFinite(tsSec) || tsSec <= 0) continue;
    const bucket = Math.floor(tsSec / stepSec) * stepSec;
    const vol = typeof t.amountUsd === 'number' && Number.isFinite(t.amountUsd) ? t.amountUsd : 0;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, {
        time: bucket,
        open: t.priceUsd,
        high: t.priceUsd,
        low: t.priceUsd,
        close: t.priceUsd,
        volume: vol > 0 ? vol : null,
        volumeUsd: vol > 0 ? vol : null,
      });
    } else {
      existing.high = Math.max(existing.high, t.priceUsd);
      existing.low = Math.min(existing.low, t.priceUsd);
      existing.close = t.priceUsd;
      const nextVol = (existing.volumeUsd ?? 0) + vol;
      existing.volume = nextVol > 0 ? nextVol : null;
      existing.volumeUsd = nextVol > 0 ? nextVol : null;
    }
  }
  return mergeChartCandles([], Array.from(buckets.values()));
}

export async function getRobinhoodChartHistory(
  address: string,
  timeframe: ChartTimeframe,
  limit: number,
  before?: number,
): Promise<ChartSnapshot> {
  const norm = address.toLowerCase();
  const cacheKey = `${norm}:${timeframe}:${limit}:${before ?? 'latest'}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 20_000) {
    return cached.snapshot;
  }

  const resolved = await resolveBestRobinhoodPool(norm);
  if (!resolved.poolAddress) {
    return {
      address: norm,
      chain: 'robinhood',
      timeframe,
      currency: 'usd',
      market: 'pool',
      candles: [],
      hasMore: false,
      oldestTime: null,
      observedAt: Date.now(),
      source: 'geckoterminal-pool-ohlcv',
      status: 'stale',
      reason: 'No active liquidity pool found on Robinhood Chain for this token.',
    };
  }

  const { unit, aggregate } = geckoOhlcvParams(timeframe);
  const query = new URLSearchParams({
    aggregate: String(aggregate),
    limit: String(Math.min(1000, Math.max(10, limit))),
    currency: 'usd',
  });
  if (before) query.set('before_timestamp', String(before));

  const stepSec = CHART_SECONDS[timeframe];
  let rawList: number[][] = [];
  let gtFailureReason: string | undefined;

  if (!isGtCooldownActive()) {
    try {
      const res = await fetch(
        `${GT_BASE}/pools/${resolved.poolAddress}/ohlcv/${unit}?${query.toString()}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(6_000),
          cache: 'no-store',
        },
      );
      noteGtHttpStatus(res.status);
      if (res.ok) {
        const json = await res.json();
        rawList = Array.isArray(json?.data?.attributes?.ohlcv_list)
          ? json.data.attributes.ohlcv_list
          : [];
      } else {
        gtFailureReason = `OHLCV feed HTTP ${res.status}`;
      }
    } catch {
      gtFailureReason = 'OHLCV upstream request failed';
    }
  } else {
    gtFailureReason = 'OHLCV rate-limit cooldown active';
  }

  if (rawList.length === 0) {
    if (cached && cached.snapshot.candles.length > 0) {
      return {
        ...cached.snapshot,
        observedAt: Date.now(),
        status: 'stale',
        reason: gtFailureReason,
      };
    }

    const meta = await getRobinhoodErc20Metadata(norm).catch(() => null);
    const rpcTrades = await readRecentPoolTradesFromRpc({
      tokenAddress: norm,
      poolAddress: resolved.poolAddress,
      tokenDecimals: meta?.decimals ?? 18,
      limit: 120,
    });
    const rpcCandles = buildCandlesFromTrades(rpcTrades, stepSec);
    if (rpcCandles.length > 0) {
      const snapshot: ChartSnapshot = {
        address: norm,
        chain: 'robinhood',
        timeframe,
        currency: 'usd',
        market: 'pool',
        poolAddress: resolved.poolAddress,
        candles: rpcCandles,
        hasMore: false,
        oldestTime: rpcCandles[0].time,
        observedAt: Date.now(),
        source: 'robinhood-rpc-logs',
        status: 'measured',
      };
      chartCache.set(cacheKey, { at: Date.now(), snapshot });
      return snapshot;
    }

    return {
      address: norm,
      chain: 'robinhood',
      timeframe,
      currency: 'usd',
      market: 'pool',
      poolAddress: resolved.poolAddress,
      candles: [],
      hasMore: false,
      oldestTime: null,
      observedAt: Date.now(),
      source: 'geckoterminal-pool-ohlcv',
      status: 'stale',
      reason: gtFailureReason ?? 'No pool swap candles available yet.',
    };
  }

  const parsed: ChartCandle[] = [];
  for (const row of rawList) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [rawTs, open, high, low, close, volUsd] = row;
    if (
      !Number.isFinite(rawTs) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      Math.min(open, high, low, close) <= 0
    ) {
      continue;
    }
    const alignedTime = Math.floor(rawTs / stepSec) * stepSec;
    parsed.push({
      time: alignedTime,
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      volume: Number.isFinite(volUsd) && volUsd >= 0 ? volUsd : null,
      volumeUsd: Number.isFinite(volUsd) && volUsd >= 0 ? volUsd : null,
    });
  }

  const candles = mergeChartCandles([], parsed);
  const oldestTime = candles.length > 0 ? candles[0].time : null;
  const snapshot: ChartSnapshot = {
    address: norm,
    chain: 'robinhood',
    timeframe,
    currency: 'usd',
    market: 'pool',
    poolAddress: resolved.poolAddress,
    candles,
    hasMore: rawList.length >= Math.min(limit, 100),
    oldestTime,
    observedAt: Date.now(),
    source: 'geckoterminal-pool-ohlcv',
    status: 'measured',
  };

  chartCache.set(cacheKey, { at: Date.now(), snapshot });
  return snapshot;
}

export async function getRobinhoodLiveTrades(
  address: string,
  options: { limit: number; side?: 'BUY' | 'SELL' | null; wallet?: string | null },
): Promise<{ trades: TapeTrade[]; poolAddress: string | null }> {
  const norm = address.toLowerCase();
  const resolved = await resolveBestRobinhoodPool(norm);
  if (!resolved.poolAddress) {
    return { trades: [], poolAddress: null };
  }

  let rows: any[] = [];
  if (!isGtCooldownActive()) {
    try {
      const res = await fetch(`${GT_BASE}/pools/${resolved.poolAddress}/trades`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
        cache: 'no-store',
      });
      noteGtHttpStatus(res.status);
      if (res.ok) {
        const json = await res.json();
        rows = Array.isArray(json?.data) ? json.data : [];
      }
    } catch {
      // Fall through to on-chain log reader
    }
  }

  let mappedTrades: TapeTrade[] = rows
    .map((row: any): TapeTrade | null => {
      const a = row?.attributes;
      if (!a?.tx_hash) return null;
      const side: 'BUY' | 'SELL' = a.kind === 'sell' ? 'SELL' : 'BUY';
      const isBuy = side === 'BUY';
      const tokenAmount = num(isBuy ? a.to_token_amount : a.from_token_amount) ?? null;
      const volumeUsd = num(a.volume_in_usd) ?? null;
      const priceUsd =
        num(isBuy ? a.price_to_in_usd : a.price_from_in_usd) ?? null;
      const nativeAmount = num(a.price_to_in_currency_token) ?? null;

      return {
        eventId: row.id || a.tx_hash,
        signature: a.tx_hash,
        mint: norm,
        wallet: a.tx_from_address ? String(a.tx_from_address).toLowerCase() : null,
        side,
        amountUsd: volumeUsd,
        amountSol: nativeAmount,
        amountTokens: tokenAmount,
        priceUsd,
        timestamp: a.block_timestamp || new Date().toISOString(),
        isMev: false,
        source: 'geckoterminal-robinhood',
      };
    })
    .filter((t: TapeTrade | null): t is TapeTrade => Boolean(t));

  if (mappedTrades.length === 0) {
    const meta = await getRobinhoodErc20Metadata(norm).catch(() => null);
    mappedTrades = await readRecentPoolTradesFromRpc({
      tokenAddress: norm,
      poolAddress: resolved.poolAddress,
      tokenDecimals: meta?.decimals ?? 18,
      limit: Math.max(options.limit, 30),
    });
  }

  const trades: TapeTrade[] = mappedTrades
    .filter(
      (t: TapeTrade) =>
        (!options.side || t.side === options.side) &&
        (!options.wallet || t.wallet?.toLowerCase() === options.wallet.toLowerCase()),
    )
    .sort((a: TapeTrade, b: TapeTrade) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, options.limit);

  return { trades, poolAddress: resolved.poolAddress };
}

export async function getRobinhoodTokenAudit(address: string): Promise<TokenAudit> {
  const norm = address.toLowerCase();
  const [sec, onChain] = await Promise.all([
    fetchGoPlusRobinhoodSecurity(norm),
    readOnChainAuditSignals(norm).catch(() => null),
  ]);
  const nowIso = new Date().toISOString();

  const ev: MetricEvidence = sec
    ? { status: 'measured', source: 'goplus-evm-4663', observedAt: nowIso }
    : onChain?.ponsCurve
      ? { status: 'measured', source: 'robinhood-rpc', observedAt: nowIso }
      : {
          status: 'unavailable',
          source: 'goplus-evm-4663',
          observedAt: nowIso,
          reason: 'Security scan unavailable for this contract.',
        };

  const isMintable = boolFlag(sec?.is_mintable);
  const isBlacklisted = boolFlag(sec?.is_blacklisted);
  const isPausable = boolFlag(sec?.transfer_pausable);
  const isHoneypot = boolFlag(sec?.is_honeypot);
  const buyTaxPct = sec?.buy_tax !== undefined && sec.buy_tax !== '' ? Number(sec.buy_tax) * 100 : null;
  const sellTaxPct = sec?.sell_tax !== undefined && sec.sell_tax !== '' ? Number(sec.sell_tax) * 100 : null;

  const mintAuthorityDisabled = isMintable === null ? (onChain?.ponsCurve ? true : null) : !isMintable;
  const freezeAuthorityDisabled =
    isBlacklisted === null && isPausable === null
      ? null
      : isBlacklisted !== true && isPausable !== true;

  const top10Pct = sec ? computeTop10NonPoolPctFromGoPlus(sec) : null;
  const goPlusDevPct =
    sec?.creator_percent !== undefined && sec.creator_percent !== ''
      ? Number((Number(sec.creator_percent) * 100).toFixed(2))
      : null;
  const ponsDevPct =
    onChain?.ponsCurve && onChain.ponsCurve.totalSupplyRaw > 0n
      ? Number(
          (
            (Number(onChain.ponsCurve.deployerBalanceRaw) /
              Number(onChain.ponsCurve.totalSupplyRaw)) *
            100
          ).toFixed(2),
        )
      : null;
  const devPct = goPlusDevPct ?? ponsDevPct;

  const goPlusLpLockedPct = sec ? computeLpLockedFromGoPlus(sec) : null;
  const lpLockedPct =
    goPlusLpLockedPct ?? (onChain?.ponsCurve ? 100 : null);
  const liquidityLocked = lpLockedPct !== null ? lpLockedPct >= 80 : null;
  const honeypotTaxZero =
    isHoneypot === null && buyTaxPct === null && sellTaxPct === null
      ? null
      : isHoneypot !== true && (buyTaxPct ?? 0) === 0 && (sellTaxPct ?? 0) === 0;

  const rugRisk = calculateRugRisk({
    top10Pct: top10Pct ?? undefined,
    devPct: devPct ?? undefined,
    mintAuthorityRevoked: mintAuthorityDisabled ?? undefined,
    freezeAuthorityRevoked: freezeAuthorityDisabled ?? undefined,
    liquidityLocked: liquidityLocked ?? undefined,
  });

  const creatorAddress =
    sec?.creator_address ?? onChain?.ponsCurve?.deployerAddress ?? null;
  const ownerAddress = sec?.owner_address ?? onChain?.ownerAddress ?? null;

  return {
    token: norm,
    chain: 'robinhood',
    symbol: sec?.token_symbol ?? null,
    creatorAddress,
    mintAuthorityDisabled,
    freezeAuthorityDisabled,
    lpTokensBurned: null,
    liquidityLocked,
    honeypotTaxZero,
    top10HoldersPct: top10Pct,
    devBalancePct: devPct,
    organicScore: null,
    organicScoreLabel: null,
    devMints: null,
    devMigrations: null,
    migrationRatePct: null,
    snipersPct: null,
    insidersPct: null,
    bundlersPct: null,
    sniperCount: null,
    bundlerCount: null,
    insiderCount: null,
    devCount: creatorAddress ? 1 : null,
    holderTop10Pct: top10Pct,
    totalHolders: sec?.holder_count ? Number(sec.holder_count) : null,
    holderAuditPending: false,
    rugRisk,
    auditVersion: sec ? 'goplus-evm-v1' : 'robinhood-rpc-v1',
    marketEvidence: ev,
    ownershipEvidence:
      sec || ownerAddress || onChain?.isOwnerRenounced !== null
        ? {
            status: 'measured',
            source: sec ? 'goplus-evm-4663' : 'robinhood-rpc',
            observedAt: nowIso,
          }
        : ev,
    securityEvidence: ev,
    creatorEvidence:
      creatorAddress
        ? {
            status: 'measured',
            source: sec?.creator_address ? 'goplus-evm-4663' : 'robinhood-rpc',
            observedAt: nowIso,
          }
        : ev,
    lifecycleEvidence: ev,
    liquidityEvidence:
      lpLockedPct !== null
        ? {
            status: 'measured',
            source: goPlusLpLockedPct !== null ? 'goplus-evm-4663' : 'robinhood-rpc',
            observedAt: nowIso,
          }
        : ev,
    top10Evidence: sec ? ev : {
      status: 'unavailable',
      source: 'goplus-evm-4663',
      observedAt: nowIso,
      reason: 'Top holder distribution unavailable on-chain.',
    },
    devBalanceEvidence:
      devPct !== null
        ? {
            status: 'measured',
            source: goPlusDevPct !== null ? 'goplus-evm-4663' : 'robinhood-rpc',
            observedAt: nowIso,
          }
        : ev,
    mintAuthorityEvidence: ev,
    freezeAuthorityEvidence: ev,
    organicEvidence: {
      status: 'unavailable',
      source: 'goplus-evm-4663',
      observedAt: nowIso,
      reason: 'Organic score is Solana-only.',
    },
    historyEvidence: ev,
    coverage: sec
      ? 'GoPlus EVM Security API + On-Chain RPC (Robinhood Chain #4663)'
      : 'On-Chain RPC Contract Inspection (Robinhood Chain #4663)',
    lastAuditedAt: sec || onChain?.ponsCurve ? nowIso : null,
    isContractVerified: boolFlag(sec?.is_open_source) ?? onChain?.isContractVerifiedHint ?? null,
    isProxy: boolFlag(sec?.is_proxy),
    ownerAddress,
    canTakeBackOwnership: boolFlag(sec?.can_take_back_ownership),
    isBlacklisted,
    transferPausable: isPausable,
    isHoneypot,
    cannotBuy: boolFlag(sec?.cannot_buy),
    cannotSellAll: boolFlag(sec?.cannot_sell_all),
    buyTaxPct: buyTaxPct !== null && Number.isFinite(buyTaxPct) ? Number(buyTaxPct.toFixed(2)) : null,
    sellTaxPct: sellTaxPct !== null && Number.isFinite(sellTaxPct) ? Number(sellTaxPct.toFixed(2)) : null,
  };
}

function computeTop10NonPoolPctFromGoPlus(sec: GoPlusEvmSecurity): number | null {
  if (!Array.isArray(sec.holders) || sec.holders.length === 0) return null;
  const sum = sec.holders
    .filter((h) => !h.is_contract)
    .slice(0, 10)
    .reduce((acc, h) => acc + Number(h.percent ?? 0) * 100, 0);
  return Number.isFinite(sum) ? Number(Math.min(100, Math.max(0, sum)).toFixed(2)) : null;
}

function computeLpLockedFromGoPlus(sec: GoPlusEvmSecurity): number | null {
  if (!Array.isArray(sec.lp_holders) || sec.lp_holders.length === 0) return null;
  const locked = sec.lp_holders.reduce(
    (acc, h) => acc + (h.is_locked ? Number(h.percent ?? 0) * 100 : 0),
    0,
  );
  return Number.isFinite(locked) ? Number(Math.min(100, Math.max(0, locked)).toFixed(2)) : null;
}

export async function getRobinhoodTokenHolders(address: string) {
  const norm = address.toLowerCase();
  const [sec, meta] = await Promise.all([
    fetchGoPlusRobinhoodSecurity(norm),
    getRobinhoodErc20Metadata(norm).catch(() => ({ totalSupply: undefined })),
  ]);

  const rawHolders = sec?.holders ?? [];
  const creatorLower = sec?.creator_address?.toLowerCase();
  const holders = rawHolders.map((h, index) => {
    const pct = Number(h.percent ?? 0) * 100;
    const isContract = Boolean(h.is_contract);
    let tag = isContract ? 'Contract / Pool' : 'Trader';
    if (creatorLower && h.address.toLowerCase() === creatorLower) {
      tag = 'Dev 👨‍💻';
    } else if (!isContract && pct >= 2) {
      tag = 'Whale 🐋';
    }
    return {
      rank: index + 1,
      address: h.address,
      tokenAccount: h.address,
      balance: Number(h.balance ?? 0),
      percent: Number.isFinite(pct) ? Number(pct.toFixed(4)) : null,
      tag,
      isContract,
    };
  });

  const top10IncludingPoolsPct = Number(
    holders
      .slice(0, 10)
      .reduce((acc, h) => acc + (h.percent ?? 0), 0)
      .toFixed(2),
  );
  const top10ConcentrationPct = sec ? computeTop10NonPoolPctFromGoPlus(sec) : null;

  return {
    token: norm,
    chain: 'robinhood',
    totalHoldersCount: sec?.holder_count ? Number(sec.holder_count) : null,
    top10ConcentrationPct,
    top10IncludingPoolsPct,
    totalSupply: sec?.total_supply ? Number(sec.total_supply) : meta.totalSupply ?? null,
    holders,
    coverage: 'GoPlus EVM Top Holders (Robinhood Chain #4663).',
    timestamp: new Date().toISOString(),
  };
}

export async function getRobinhoodTokenLiquidity(address: string) {
  const norm = address.toLowerCase();
  const [{ pools, includedMap }, pairs, sec] = await Promise.all([
    fetchGeckoTokenPools(norm),
    fetchDexScreenerPairs(norm),
    fetchGoPlusRobinhoodSecurity(norm),
  ]);

  const lpLockedPct = sec ? computeLpLockedFromGoPlus(sec) : null;
  const formattedPools =
    pools.length > 0
      ? pools.map((p: any, idx: number) => {
          const a = p.attributes ?? {};
          const dex = resolveRobinhoodDex(p.relationships?.dex?.data?.id);
          const base = includedMap.get(p.relationships?.base_token?.data?.id ?? '');
          const quote = includedMap.get(p.relationships?.quote_token?.data?.id ?? '');
          return {
            id: p.id || `pool_${idx}`,
            dex: dex.name,
            pair:
              a.name ||
              `${base?.attributes?.symbol ?? 'TOKEN'}/${quote?.attributes?.symbol ?? 'WETH'}`,
            poolAddress: a.address,
            liquidityUsd: String(num(a.reserve_in_usd) ?? 0),
            reserves: {
              sol: '—',
              token: '—',
            },
            volume24h: String(num(a.volume_usd?.h24) ?? 0),
            fees24h: '—',
            apy: '—',
            lockStatus: lpLockedPct !== null && lpLockedPct >= 80 ? 'locked' : 'unlocked',
            lockDetails:
              lpLockedPct !== null
                ? `${lpLockedPct.toFixed(1)}% LP locked`
                : 'Lock status unverified',
            feeTier: dex.protocol.toUpperCase(),
          };
        })
      : pairs.map((p: any, idx: number) => {
          const dex = resolveRobinhoodDex(p.dexId);
          return {
            id: p.pairAddress || `pair_${idx}`,
            dex: dex.name,
            pair: `${p.baseToken?.symbol ?? 'TOKEN'}/${p.quoteToken?.symbol ?? 'WETH'}`,
            poolAddress: p.pairAddress,
            liquidityUsd: String(p.liquidity?.usd ?? 0),
            reserves: { sol: '—', token: '—' },
            volume24h: String(p.volume?.h24 ?? 0),
            fees24h: '—',
            apy: '—',
            lockStatus: lpLockedPct !== null && lpLockedPct >= 80 ? 'locked' : 'unlocked',
            lockDetails:
              lpLockedPct !== null
                ? `${lpLockedPct.toFixed(1)}% LP locked`
                : 'Lock status unverified',
            feeTier: Array.isArray(p.labels) ? p.labels.join(', ') : dex.protocol.toUpperCase(),
          };
        });

  const totalLiquidityUsd = formattedPools.reduce(
    (acc: number, item: any) => acc + (Number(item.liquidityUsd) || 0),
    0,
  );

  return {
    token: norm,
    chain: 'robinhood',
    totalLiquidityUsd: totalLiquidityUsd > 0 ? totalLiquidityUsd : null,
    lpLockedPct,
    pools: formattedPools,
    providers: (sec?.lp_holders ?? []).slice(0, 10).map((lp, idx) => ({
      rank: idx + 1,
      provider: lp.address,
      tag: lp.is_contract ? 'Contract' : 'LP Holder',
      pool: formattedPools[0]?.pair ?? 'Primary Pool',
      lpTokens: lp.balance ?? '—',
      sharePct: `${(Number(lp.percent ?? 0) * 100).toFixed(2)}%`,
      valueUsd: lp.tag || '—',
      lockStatus: lp.is_locked ? 'Locked 🔒' : 'Unlocked ⚠️',
    })),
    timestamp: new Date().toISOString(),
  };
}

export async function getRobinhoodSwapQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  walletAddress?: string;
}): Promise<RobinhoodSwapQuoteResult & { poolLiquidityUsd: number }> {
  const inputNum = Number(params.amount);
  if (!Number.isFinite(inputNum) || inputNum <= 0) {
    throw new Error('Trade amount must be greater than zero.');
  }

  const wethLower = ROBINHOOD_WETH_ADDRESS.toLowerCase();
  const inputLower = params.inputMint.toLowerCase();
  const outputLower = params.outputMint.toLowerCase();
  const isBuy = inputLower === wethLower;
  const targetToken = isBuy ? outputLower : inputLower;

  if (!isEvmAddress(targetToken)) {
    throw new Error('Invalid Robinhood Chain token contract address.');
  }

  const [{ pools }, resolvedPool, erc20Meta, onChainEthUsd] = await Promise.all([
    fetchGeckoTokenPools(targetToken),
    resolveBestRobinhoodPool(targetToken),
    getRobinhoodErc20Metadata(targetToken).catch(() => null),
    readOnChainEthUsdPrice().catch(() => null),
  ]);

  const bestPool = pools[0];
  const tokenPriceUsd =
    num(bestPool?.attributes?.base_token_price_usd) ?? resolvedPool.priceUsd;
  const wethPriceUsd =
    num(bestPool?.attributes?.quote_token_price_usd) ??
    onChainEthUsd ??
    (await resolveBestRobinhoodPool(wethLower)).priceUsd;
  const poolLiquidityUsd =
    num(bestPool?.attributes?.reserve_in_usd) ?? resolvedPool.liquidityUsd ?? 0;

  const result = await quoteAndBuildRobinhoodSwap({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippage: params.slippageBps / 100,
    walletAddress: params.walletAddress,
    poolAddress: resolvedPool.poolAddress,
    dexId: resolvedPool.dexId,
    tokenDecimals: erc20Meta?.decimals ?? 18,
    fallbackPriceUsd: tokenPriceUsd,
    fallbackEthUsd: wethPriceUsd ?? undefined,
  });

  return {
    ...result,
    poolLiquidityUsd,
  };
}

