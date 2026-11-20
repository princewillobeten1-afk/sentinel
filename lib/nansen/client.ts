import 'server-only';

import { env } from '@/lib/server/env';
import {
  isNansenNativeToken,
  isNansenTgmDexTradesRestricted,
  toNansenChain,
} from './chains';
import type {
  NansenAccountInfo,
  NansenPagination,
  NansenRateLimitStatus,
  NansenSmartMoneyDexTradeItem,
  NansenSmartMoneyHoldingItem,
  NansenSmartMoneyNetflowItem,
  NansenSmartMoneyPnlLeaderboardItem,
  NansenTgmDexTradeItem,
  NansenTgmFlowIntelligenceItem,
  NansenTgmHolderItem,
  NansenTgmTimeframe,
  NansenTgmWhoBoughtSoldItem,
  NansenTokenDetailLevel,
  NansenTokenScreenerItem,
  NansenTokenSmartMoneyResponse,
} from './types';

const DEFAULT_BASE_URL = 'https://api.nansen.ai';
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
const TRADES_CACHE_TTL_MS = 2 * 60_000;
const MAX_CACHE_ENTRIES = 500;
const ERROR_COOLDOWN_MS = 5 * 60_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 120_000;

const ALL_SCREENER_CHAINS = ['solana', 'robinhood', 'ethereum', 'base', 'bnb'];

interface CacheEntry {
  at: number;
  ttlMs: number;
  data: unknown;
}

interface NansenEnvelope<T> {
  data?: T;
  pagination?: NansenPagination;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

let authCooldownUntil = 0;
let authCooldownKey = '';
let insufficientCreditsUntil = 0;
let insufficientCreditsKey = '';
let rateLimitCooldownUntil = 0;
let creditsRemaining: number | null = null;
let creditsLastCost: number | null = null;
let creditsLastUsed: number | null = null;
let rateLimitRemaining: number | null = null;

function getApiKey(): string {
  return (process.env.NANSEN_API_KEY ?? env.NANSEN_API_KEY ?? '').trim();
}

function getBaseUrl(): string {
  const configured = (process.env.NANSEN_API_BASE_URL ?? env.NANSEN_API_BASE_URL ?? '').trim();
  return (configured || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function isNansenConfigured(): boolean {
  return getApiKey().length > 0;
}

export function getNansenRateLimitStatus(): NansenRateLimitStatus {
  const apiKey = getApiKey();
  const now = Date.now();
  const authFailed = Boolean(apiKey && authCooldownKey === apiKey && now < authCooldownUntil);
  const insufficientCredits = Boolean(
    apiKey && insufficientCreditsKey === apiKey && now < insufficientCreditsUntil,
  );
  return {
    creditsRemaining,
    creditsLastCost,
    creditsLastUsed,
    rateLimitRemaining,
    coolingDown: authFailed || insufficientCredits || now < rateLimitCooldownUntil,
    insufficientCredits,
    authFailed,
  };
}

export function resetNansenClientStateForTests(): void {
  cache.clear();
  inflight.clear();
  authCooldownUntil = 0;
  authCooldownKey = '';
  insufficientCreditsUntil = 0;
  insufficientCreditsKey = '';
  rateLimitCooldownUntil = 0;
  creditsRemaining = null;
  creditsLastCost = null;
  creditsLastUsed = null;
  rateLimitRemaining = null;
}

function parseOptionalHeaderInt(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (!raw) return null;
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`)
    .join(',')}}`;
}

function setCached(key: string, data: unknown, ttlMs: number): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { at: Date.now(), ttlMs, data });
}

function updateTelemetryHeaders(headers: Headers): void {
  const remainingCredits = parseOptionalHeaderInt(headers, 'X-Nansen-Credits-Remaining');
  if (remainingCredits !== null) creditsRemaining = remainingCredits;

  const cost = parseOptionalHeaderInt(headers, 'X-Nansen-Credits-Cost');
  if (cost !== null) creditsLastCost = cost;

  const used = parseOptionalHeaderInt(headers, 'X-Nansen-Credits-Used');
  if (used !== null) creditsLastUsed = used;

  const stdRem = parseOptionalHeaderInt(headers, 'RateLimit-Remaining');
  const legacyRem = parseOptionalHeaderInt(headers, 'X-RateLimit-Remaining');
  if (stdRem !== null && legacyRem !== null) {
    rateLimitRemaining = Math.min(stdRem, legacyRem);
  } else if (stdRem !== null) {
    rateLimitRemaining = stdRem;
  } else if (legacyRem !== null) {
    rateLimitRemaining = legacyRem;
  }
}

export async function nansenRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  options?: { ttlMs?: number; timeoutMs?: number },
): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const now = Date.now();
  if (authCooldownKey !== apiKey) {
    authCooldownUntil = 0;
    authCooldownKey = '';
  }
  if (insufficientCreditsKey !== apiKey) {
    insufficientCreditsUntil = 0;
    insufficientCreditsKey = '';
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const bodyKey = method === 'POST' && body !== undefined ? canonicalStringify(body) : '';
  const cacheKey = `${method}:${normalizedPath}:${bodyKey}`;
  const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS;

  const cached = cache.get(cacheKey);
  if (cached && now - cached.at < cached.ttlMs) {
    return cached.data as T;
  }

  if (authCooldownKey === apiKey && now < authCooldownUntil) {
    return null;
  }
  if (insufficientCreditsKey === apiKey && now < insufficientCreditsUntil) {
    return (cached?.data as T) ?? null;
  }
  if (now < rateLimitCooldownUntil) {
    return (cached?.data as T) ?? null;
  }

  const existingInflight = inflight.get(cacheKey);
  if (existingInflight) {
    return (await existingInflight) as T | null;
  }

  const run = (async (): Promise<T | null> => {
    try {
      const res = await fetch(`${getBaseUrl()}${normalizedPath}`, {
        method,
        headers: {
          apikey: apiKey,
          Accept: 'application/json',
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
        signal: AbortSignal.timeout(options?.timeoutMs ?? 10000),
        cache: 'no-store',
      });

      updateTelemetryHeaders(res.headers);

      if (res.status === 401 || res.status === 402) {
        authCooldownKey = apiKey;
        authCooldownUntil = Date.now() + ERROR_COOLDOWN_MS;
        return null;
      }

      if (res.status === 403) {
        const errBody = await res.json().catch(() => null) as { code?: string } | null;
        if (errBody?.code === 'insufficient_credits') {
          insufficientCreditsKey = apiKey;
          insufficientCreditsUntil = Date.now() + ERROR_COOLDOWN_MS;
          return (cached?.data as T) ?? null;
        }
        if (errBody?.code === 'api_key_disabled' || errBody?.code === 'insufficient_scope') {
          authCooldownKey = apiKey;
          authCooldownUntil = Date.now() + ERROR_COOLDOWN_MS;
        }
        return null;
      }

      if (res.status === 429) {
        const retryAfter = parseOptionalHeaderInt(res.headers, 'Retry-After');
        const waitMs = retryAfter !== null && retryAfter > 0
          ? Math.min(retryAfter * 1000, MAX_RATE_LIMIT_COOLDOWN_MS)
          : DEFAULT_RATE_LIMIT_COOLDOWN_MS;
        rateLimitCooldownUntil = Date.now() + waitMs;
        return (cached?.data as T) ?? null;
      }

      // 512 / 514 are native-token query timeout / backend refusal codes, NOT auth failures.
      if (res.status === 512 || res.status === 514 || !res.ok) {
        return null;
      }

      const data = (await res.json()) as T;
      setCached(cacheKey, data, ttlMs);
      return data;
    } catch {
      return null;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, run);
  return run;
}

function resolveMultiChains(chains?: string[]): string[] {
  if (!chains || chains.length === 0) return ['solana'];
  const mapped = Array.from(new Set(chains.map((c) => toNansenChain(c)).filter(Boolean)));
  return mapped.length > 0 ? mapped : ['solana'];
}

function getDateRangeForTimeframe(timeframe: NansenTgmTimeframe): { from: string; to: string } {
  const now = Date.now();
  const durationMap: Record<NansenTgmTimeframe, number> = {
    '5m': 60 * 60_000,
    '1h': 60 * 60_000,
    '6h': 6 * 60 * 60_000,
    '12h': 12 * 60 * 60_000,
    '1d': 24 * 60 * 60_000,
    '7d': 7 * 24 * 60 * 60_000,
  };
  const ms = durationMap[timeframe] ?? 24 * 60 * 60_000;
  return {
    from: new Date(now - ms).toISOString(),
    to: new Date(now).toISOString(),
  };
}

export async function fetchNansenAccount(): Promise<NansenAccountInfo | null> {
  return nansenRequest<NansenAccountInfo>('GET', '/api/v1/account');
}

export async function fetchNansenSmartMoneyScreener(params: {
  chains?: string[];
  timeframe?: '5m' | '10m' | '1h' | '6h' | '24h' | '7d' | '30d';
  page?: number;
  perPage?: number;
} = {}): Promise<{ data: NansenTokenScreenerItem[]; pagination: NansenPagination | null } | null> {
  const resolved = resolveMultiChains(params.chains);
  const chains = resolved.includes('all') ? ALL_SCREENER_CHAINS : resolved.slice(0, 5);

  const res = await nansenRequest<NansenEnvelope<NansenTokenScreenerItem[]>>(
    'POST',
    '/api/v1/token-screener',
    {
      chains,
      timeframe: params.timeframe ?? '24h',
      filters: {
        trader_type: 'sm',
        include_smart_money_labels: ['Smart Trader'],
        include_stablecoins: false,
      },
      pagination: {
        page: params.page ?? 1,
        per_page: Math.min(Math.max(params.perPage ?? 20, 1), 100),
      },
      order_by: [{ field: 'netflow', direction: 'DESC' }],
    },
  );
  if (!res || !Array.isArray(res.data)) return null;
  return { data: res.data, pagination: res.pagination ?? null };
}

export async function fetchNansenSmartMoneyNetflow(params: {
  chains?: string[];
  page?: number;
  perPage?: number;
} = {}): Promise<{ data: NansenSmartMoneyNetflowItem[]; pagination: NansenPagination | null } | null> {
  const res = await nansenRequest<NansenEnvelope<NansenSmartMoneyNetflowItem[]>>(
    'POST',
    '/api/v1/smart-money/netflow',
    {
      chains: resolveMultiChains(params.chains),
      filters: {
        include_smart_money_labels: ['Smart Trader'],
        include_stablecoins: false,
        include_native_tokens: false,
      },
      pagination: {
        page: params.page ?? 1,
        per_page: Math.min(Math.max(params.perPage ?? 20, 1), 100),
      },
      order_by: [{ field: 'net_flow_24h_usd', direction: 'DESC' }],
    },
  );
  if (!res || !Array.isArray(res.data)) return null;
  return { data: res.data, pagination: res.pagination ?? null };
}

export async function fetchNansenSmartMoneyHoldings(params: {
  chains?: string[];
  page?: number;
  perPage?: number;
} = {}): Promise<{ data: NansenSmartMoneyHoldingItem[]; pagination: NansenPagination | null } | null> {
  const res = await nansenRequest<NansenEnvelope<NansenSmartMoneyHoldingItem[]>>(
    'POST',
    '/api/v1/smart-money/holdings',
    {
      chains: resolveMultiChains(params.chains),
      filters: {
        include_smart_money_labels: ['Smart Trader'],
        include_stablecoins: false,
        include_native_tokens: false,
      },
      pagination: {
        page: params.page ?? 1,
        per_page: Math.min(Math.max(params.perPage ?? 20, 1), 100),
      },
      order_by: [{ field: 'value_usd', direction: 'DESC' }],
    },
  );
  if (!res || !Array.isArray(res.data)) return null;
  return { data: res.data, pagination: res.pagination ?? null };
}

export async function fetchNansenSmartMoneyDexTrades(params: {
  chains?: string[];
  page?: number;
  perPage?: number;
} = {}): Promise<{ data: NansenSmartMoneyDexTradeItem[]; pagination: NansenPagination | null } | null> {
  const res = await nansenRequest<NansenEnvelope<NansenSmartMoneyDexTradeItem[]>>(
    'POST',
    '/api/v1/smart-money/dex-trades',
    {
      chains: resolveMultiChains(params.chains),
      filters: {
        include_smart_money_labels: ['Smart Trader'],
      },
      pagination: {
        page: params.page ?? 1,
        per_page: Math.min(Math.max(params.perPage ?? 25, 1), 100),
      },
      order_by: [{ field: 'block_timestamp', direction: 'DESC' }],
    },
    { ttlMs: TRADES_CACHE_TTL_MS },
  );
  if (!res || !Array.isArray(res.data)) return null;
  return { data: res.data, pagination: res.pagination ?? null };
}

export async function fetchNansenSmartMoneyLeaderboard(params: {
  chains?: string[];
  timeframe?: 1 | 7 | 30 | 90 | 180;
  page?: number;
  perPage?: number;
} = {}): Promise<{
  data: NansenSmartMoneyPnlLeaderboardItem[];
  pagination: NansenPagination | null;
} | null> {
  const res = await nansenRequest<NansenEnvelope<NansenSmartMoneyPnlLeaderboardItem[]>>(
    'POST',
    '/api/v1/smart-money/pnl-leaderboard',
    {
      chains: resolveMultiChains(params.chains),
      timeframe: params.timeframe ?? 30,
      filters: {
        include_smart_money_labels: ['Smart Trader'],
      },
      pagination: {
        page: params.page ?? 1,
        per_page: Math.min(Math.max(params.perPage ?? 25, 1), 100),
      },
      order_by: [{ field: 'total_pnl_usd', direction: 'DESC' }],
    },
  );
  if (!res || !Array.isArray(res.data)) return null;
  return { data: res.data, pagination: res.pagination ?? null };
}

export async function fetchNansenTgmFlowIntelligence(
  chain: string,
  tokenAddress: string,
  timeframe: NansenTgmTimeframe = '1d',
): Promise<NansenTgmFlowIntelligenceItem | null> {
  const clean = tokenAddress.trim();
  if (!clean) return null;
  const res = await nansenRequest<NansenEnvelope<NansenTgmFlowIntelligenceItem[]>>(
    'POST',
    '/api/v1/tgm/flow-intelligence',
    {
      chain: toNansenChain(chain),
      token_address: clean,
      timeframe,
    },
  );
  if (!res || !Array.isArray(res.data) || res.data.length === 0) return null;
  return res.data[0];
}

export async function fetchNansenTgmWhoBoughtSold(params: {
  chain: string;
  tokenAddress: string;
  buyOrSell: 'BUY' | 'SELL';
  timeframe?: NansenTgmTimeframe;
  page?: number;
  perPage?: number;
}): Promise<NansenTgmWhoBoughtSoldItem[]> {
  const clean = params.tokenAddress.trim();
  if (!clean) return [];
  const res = await nansenRequest<NansenEnvelope<NansenTgmWhoBoughtSoldItem[]>>(
    'POST',
    '/api/v1/tgm/who-bought-sold',
    {
      chain: toNansenChain(params.chain),
      token_address: clean,
      buy_or_sell: params.buyOrSell,
      date: getDateRangeForTimeframe(params.timeframe ?? '1d'),
      filters: {
        include_smart_money_labels: ['Smart Trader'],
      },
      pagination: {
        page: params.page ?? 1,
        per_page: Math.min(Math.max(params.perPage ?? 20, 1), 100),
      },
      order_by: [{ field: 'net_volume_usd', direction: 'DESC' }],
    },
  );
  return Array.isArray(res?.data) ? res.data : [];
}

export async function fetchNansenTgmDexTrades(params: {
  chain: string;
  tokenAddress: string;
  timeframe?: NansenTgmTimeframe;
  page?: number;
  perPage?: number;
}): Promise<NansenTgmDexTradeItem[]> {
  const clean = params.tokenAddress.trim();
  if (!clean || isNansenTgmDexTradesRestricted(params.chain, clean)) return [];
  const res = await nansenRequest<NansenEnvelope<NansenTgmDexTradeItem[]>>(
    'POST',
    '/api/v1/tgm/dex-trades',
    {
      chain: toNansenChain(params.chain),
      token_address: clean,
      date: getDateRangeForTimeframe(params.timeframe ?? '7d'),
      only_smart_money: true,
      pagination: {
        page: params.page ?? 1,
        per_page: Math.min(Math.max(params.perPage ?? 25, 1), 100),
      },
      order_by: [{ field: 'block_timestamp', direction: 'DESC' }],
    },
    { ttlMs: TRADES_CACHE_TTL_MS },
  );
  return Array.isArray(res?.data) ? res.data : [];
}

export async function fetchNansenTgmSmartHolders(params: {
  chain: string;
  tokenAddress: string;
  page?: number;
  perPage?: number;
}): Promise<NansenTgmHolderItem[]> {
  const clean = params.tokenAddress.trim();
  if (!clean || isNansenNativeToken(params.chain, clean)) return [];
  const res = await nansenRequest<NansenEnvelope<NansenTgmHolderItem[]>>(
    'POST',
    '/api/v1/tgm/holders',
    {
      chain: toNansenChain(params.chain),
      token_address: clean,
      aggregate_by_entity: false,
      label_type: 'smart_money',
      premium_labels: false,
      pagination: {
        page: params.page ?? 1,
        per_page: Math.min(Math.max(params.perPage ?? 25, 1), 100),
      },
      order_by: [{ field: 'ownership_percentage', direction: 'DESC' }],
    },
  );
  return Array.isArray(res?.data) ? res.data : [];
}

export async function fetchNansenTokenSmartMoney(
  chain: string,
  tokenAddress: string,
  options?: { timeframe?: NansenTgmTimeframe; detail?: NansenTokenDetailLevel },
): Promise<NansenTokenSmartMoneyResponse> {
  const clean = tokenAddress.trim();
  const nansenChain = toNansenChain(chain);
  const timeframe = options?.timeframe ?? '1d';
  const detail = options?.detail ?? 'core';
  const configured = isNansenConfigured();
  const nativeRestricted = isNansenNativeToken(nansenChain, clean);
  const dexTradesRestricted = isNansenTgmDexTradesRestricted(nansenChain, clean);

  if (!configured || !clean) {
    return {
      configured,
      chain: nansenChain,
      tokenAddress: clean,
      timeframe,
      detail,
      nativeRestricted,
      dexTradesRestricted,
      flowIntelligence: null,
      smartBuyers: [],
      smartSellers: [],
      dexTrades: [],
      smartHolders: [],
      rateLimit: getNansenRateLimitStatus(),
      fetchedAt: new Date().toISOString(),
    };
  }

  if (detail === 'trades') {
    const [smartSellers, dexTrades] = await Promise.all([
      fetchNansenTgmWhoBoughtSold({
        chain: nansenChain,
        tokenAddress: clean,
        buyOrSell: 'SELL',
        timeframe,
      }),
      fetchNansenTgmDexTrades({
        chain: nansenChain,
        tokenAddress: clean,
        timeframe: timeframe === '5m' ? '1d' : timeframe,
      }),
    ]);

    return {
      configured: true,
      chain: nansenChain,
      tokenAddress: clean,
      timeframe,
      detail,
      nativeRestricted,
      dexTradesRestricted,
      flowIntelligence: null,
      smartBuyers: [],
      smartSellers,
      dexTrades,
      smartHolders: [],
      rateLimit: getNansenRateLimitStatus(),
      fetchedAt: new Date().toISOString(),
    };
  }

  if (detail === 'holders') {
    const smartHolders = await fetchNansenTgmSmartHolders({
      chain: nansenChain,
      tokenAddress: clean,
    });

    return {
      configured: true,
      chain: nansenChain,
      tokenAddress: clean,
      timeframe,
      detail,
      nativeRestricted,
      dexTradesRestricted,
      flowIntelligence: null,
      smartBuyers: [],
      smartSellers: [],
      dexTrades: [],
      smartHolders,
      rateLimit: getNansenRateLimitStatus(),
      fetchedAt: new Date().toISOString(),
    };
  }

  // Default 'core' mode: 2 credits total (flow-intelligence + BUY who-bought-sold)
  const [flowIntelligence, smartBuyers] = await Promise.all([
    fetchNansenTgmFlowIntelligence(nansenChain, clean, timeframe),
    fetchNansenTgmWhoBoughtSold({
      chain: nansenChain,
      tokenAddress: clean,
      buyOrSell: 'BUY',
      timeframe,
    }),
  ]);

  return {
    configured: true,
    chain: nansenChain,
    tokenAddress: clean,
    timeframe,
    detail: 'core',
    nativeRestricted,
    dexTradesRestricted,
    flowIntelligence,
    smartBuyers,
    smartSellers: [],
    dexTrades: [],
    smartHolders: [],
    rateLimit: getNansenRateLimitStatus(),
    fetchedAt: new Date().toISOString(),
  };
}
