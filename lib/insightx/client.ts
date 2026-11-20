import 'server-only';

import { env } from '@/lib/server/env';
import type { HolderProfile } from '@/lib/market/enrichment/holder-profile';
import {
  getInsightXAtlasEmbedUrl,
  isInsightXScannerSupported,
  isInsightXSolanaMetricsSupported,
  toInsightXNetwork,
} from './atlas-embed';
import type {
  InsightXAddressLabel,
  InsightXBundlersResponse,
  InsightXCluster,
  InsightXClusterTag,
  InsightXClustersResponse,
  InsightXClustersSummary,
  InsightXDexMetrics,
  InsightXDistributionResponse,
  InsightXInsidersResponse,
  InsightXNormalizedDistribution,
  InsightXScannerResponse,
  InsightXSnipersResponse,
  InsightXTokenIntelligence,
} from './types';

const DEFAULT_BASE_URL = 'https://api.insightx.network';
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 500;
const AUTH_COOLDOWN_MS = 5 * 60_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 120_000;
const MAX_LABELS_PER_BATCH = 100;

const BENIGN_CLUSTER_TAGS = new Set<InsightXClusterTag>([
  'liquidity_pool',
  'burn',
  'exchange',
]);

interface CacheEntry {
  at: number;
  ttlMs: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

let authCooldownUntil = 0;
let authCooldownKey = '';
let rateLimitCooldownUntil = 0;
let lastMinuteRemaining: number | null = null;
let lastMonthRemaining: number | null = null;

function getApiKey(): string {
  return (process.env.INSIGHTX_API_KEY ?? env.INSIGHTX_API_KEY ?? '').trim();
}

function getBaseUrl(): string {
  const configured = (process.env.INSIGHTX_API_BASE_URL ?? env.INSIGHTX_API_BASE_URL ?? '').trim();
  const base = configured || DEFAULT_BASE_URL;
  return base.replace(/\/+$/, '');
}

export function isInsightXConfigured(): boolean {
  return getApiKey().length > 0;
}

export function hasInsightXQuotaHeadroom(minRemaining = 2): boolean {
  const apiKey = getApiKey();
  if (!apiKey) return false;
  const now = Date.now();
  if ((authCooldownKey === apiKey && now < authCooldownUntil) || now < rateLimitCooldownUntil) {
    return false;
  }
  if (lastMinuteRemaining !== null && lastMinuteRemaining <= minRemaining) {
    return false;
  }
  return true;
}

export function getInsightXRateLimitStatus(): {
  minuteRemaining: number | null;
  monthRemaining: number | null;
  coolingDown: boolean;
} {
  const apiKey = getApiKey();
  const now = Date.now();
  return {
    minuteRemaining: lastMinuteRemaining,
    monthRemaining: lastMonthRemaining,
    coolingDown:
      (authCooldownKey === apiKey && now < authCooldownUntil) ||
      now < rateLimitCooldownUntil,
  };
}

export function resetInsightXClientStateForTests(): void {
  cache.clear();
  inflight.clear();
  authCooldownUntil = 0;
  authCooldownKey = '';
  rateLimitCooldownUntil = 0;
  lastMinuteRemaining = null;
  lastMonthRemaining = null;
}

function parseOptionalHeaderInt(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (!raw) return null;
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) ? parsed : null;
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

export async function insightxFetch<T>(
  path: string,
  options?: { ttlMs?: number; timeoutMs?: number },
): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const now = Date.now();
  if (authCooldownKey !== apiKey) {
    authCooldownUntil = 0;
    authCooldownKey = '';
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const ttlMs = options?.ttlMs ?? CACHE_TTL_MS;
  const cached = cache.get(normalizedPath);
  if (cached && now - cached.at < cached.ttlMs) {
    return cached.data as T;
  }

  if (authCooldownKey === apiKey && now < authCooldownUntil) {
    return null;
  }
  if (now < rateLimitCooldownUntil) {
    return (cached?.data as T) ?? null;
  }

  const existingInflight = inflight.get(normalizedPath);
  if (existingInflight) {
    return (await existingInflight) as T | null;
  }

  const run = (async (): Promise<T | null> => {
    try {
      const res = await fetch(`${getBaseUrl()}${normalizedPath}`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(options?.timeoutMs ?? 8000),
        cache: 'no-store',
      });

      const minuteRem = parseOptionalHeaderInt(res.headers, 'X-RateLimit-Minute-Remaining');
      if (minuteRem !== null) lastMinuteRemaining = minuteRem;

      const monthRem = parseOptionalHeaderInt(res.headers, 'X-Quota-Month-Remaining');
      if (monthRem !== null) lastMonthRemaining = monthRem;

      if (res.status === 401 || res.status === 403) {
        authCooldownKey = apiKey;
        authCooldownUntil = Date.now() + AUTH_COOLDOWN_MS;
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

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as T;
      setCached(normalizedPath, data, ttlMs);
      return data;
    } catch {
      return null;
    } finally {
      inflight.delete(normalizedPath);
    }
  })();

  inflight.set(normalizedPath, run);
  return run;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Normalizes InsightX's `top_10_holder_concentration` field across both
 * `0-1` (older schema) and `0-100` (newer schema) representations.
 */
export function normalizeDistributionPct(
  value: number | null | undefined,
  referencePct?: number | null,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value <= 1) {
    if (referencePct !== null && referencePct !== undefined && Number.isFinite(referencePct)) {
      const scaledDiff = Math.abs(value * 100 - referencePct);
      const rawDiff = Math.abs(value - referencePct);
      return scaledDiff <= rawDiff ? Number((value * 100).toFixed(4)) : Number(value.toFixed(4));
    }
    return Number((value * 100).toFixed(4));
  }
  return Number(value.toFixed(4));
}

export function normalizeDistributionMetrics(
  raw: InsightXDistributionResponse | null,
  referenceTop10Pct?: number | null,
): InsightXNormalizedDistribution | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    gini: toFiniteNumber(raw.gini),
    hhi: toFiniteNumber(raw.hhi),
    nakamoto: toFiniteNumber(raw.nakamoto),
    top10Pct: normalizeDistributionPct(raw.top_10_holder_concentration, referenceTop10Pct),
  };
}

function isSuspiciousCluster(cluster: InsightXCluster): boolean {
  const tags = Array.isArray(cluster.tags) ? cluster.tags : [];
  if (tags.length === 0) return true;
  return !tags.every((tag) => BENIGN_CLUSTER_TAGS.has(tag));
}

export function summarizeClusters(raw: InsightXClustersResponse | null): InsightXClustersSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const clusters = Array.isArray(raw.clusters) ? raw.clusters : [];
  const suspiciousClusterCount = clusters.filter(isSuspiciousCluster).length;
  const clusteredAddressCount = clusters.reduce(
    (sum, cluster) => sum + (Array.isArray(cluster.cluster_addresses) ? cluster.cluster_addresses.length : 0),
    0,
  );
  return {
    totalClusterPct: toFiniteNumber(raw.total_cluster_pct),
    clusterCount: clusters.length,
    suspiciousClusterCount,
    clusteredAddressCount,
    clusters,
  };
}

export async function fetchInsightXDexMetrics(
  chain: string,
  address: string,
): Promise<InsightXDexMetrics | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress) return null;
  const network = toInsightXNetwork(chain);
  const raw = await insightxFetch<InsightXDexMetrics>(
    `/dex-metrics/v1/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}`,
  );
  if (!raw || typeof raw !== 'object') return null;
  return {
    cluster_pct: toFiniteNumber(raw.cluster_pct),
    snipers_pct: toFiniteNumber(raw.snipers_pct),
    bundlers_pct: toFiniteNumber(raw.bundlers_pct),
    dev_pct: toFiniteNumber(raw.dev_pct),
    insiders_pct: toFiniteNumber(raw.insiders_pct),
    top10_pct: toFiniteNumber(raw.top10_pct),
  };
}

export async function fetchInsightXDistribution(
  chain: string,
  address: string,
  referenceTop10Pct?: number | null,
): Promise<InsightXNormalizedDistribution | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress) return null;
  const network = toInsightXNetwork(chain);
  const raw = await insightxFetch<InsightXDistributionResponse>(
    `/dex-metrics/v1/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}/distribution`,
  );
  return normalizeDistributionMetrics(raw, referenceTop10Pct);
}

export async function fetchInsightXClusters(
  chain: string,
  address: string,
): Promise<InsightXClustersSummary | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress) return null;
  const network = toInsightXNetwork(chain);
  const raw = await insightxFetch<InsightXClustersResponse>(
    `/dex-metrics/v1/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}/clusters`,
  );
  return summarizeClusters(raw);
}

export async function fetchInsightXSnipers(
  chain: string,
  address: string,
): Promise<InsightXSnipersResponse | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress || !isInsightXSolanaMetricsSupported(chain)) return null;
  const network = toInsightXNetwork(chain);
  return insightxFetch<InsightXSnipersResponse>(
    `/dex-metrics/v1/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}/snipers`,
  );
}

export async function fetchInsightXBundlers(
  chain: string,
  address: string,
): Promise<InsightXBundlersResponse | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress || !isInsightXSolanaMetricsSupported(chain)) return null;
  const network = toInsightXNetwork(chain);
  return insightxFetch<InsightXBundlersResponse>(
    `/dex-metrics/v1/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}/bundlers`,
  );
}

export async function fetchInsightXInsiders(
  chain: string,
  address: string,
): Promise<InsightXInsidersResponse | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress || !isInsightXSolanaMetricsSupported(chain)) return null;
  const network = toInsightXNetwork(chain);
  return insightxFetch<InsightXInsidersResponse>(
    `/dex-metrics/v1/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}/insiders`,
  );
}

export async function fetchInsightXScanner(
  chain: string,
  address: string,
): Promise<InsightXScannerResponse | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress || !isInsightXScannerSupported(chain)) return null;
  const network = toInsightXNetwork(chain);
  return insightxFetch<InsightXScannerResponse>(
    `/scanner/v1/tokens/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}`,
  );
}

export async function fetchInsightXLabels(
  chain: string,
  addresses: string[],
): Promise<InsightXAddressLabel[]> {
  if (!isInsightXConfigured()) return [];

  const network = toInsightXNetwork(chain);
  const isEvm = network !== 'sol' && network !== 'sui';
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const raw of addresses) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const dedupeKey = isEvm ? trimmed.toLowerCase() : trimmed;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    unique.push(trimmed);
  }

  if (unique.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_LABELS_PER_BATCH) {
    batches.push(unique.slice(i, i + MAX_LABELS_PER_BATCH));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const encodedAddresses = batch.map((addr) => encodeURIComponent(addr)).join(',');
      const res = await insightxFetch<InsightXAddressLabel[]>(
        `/labels/v1/${encodeURIComponent(network)}/${encodedAddresses}`,
      );
      return Array.isArray(res) ? res : [];
    }),
  );

  return results.flat();
}

export function buildInsightXLabelMap(
  labels: InsightXAddressLabel[],
  chain: string,
): Map<string, InsightXAddressLabel> {
  const network = toInsightXNetwork(chain);
  const isEvm = network !== 'sol' && network !== 'sui';
  const map = new Map<string, InsightXAddressLabel>();
  for (const item of labels) {
    if (!item?.address) continue;
    const key = isEvm ? item.address.toLowerCase() : item.address;
    map.set(key, item);
  }
  return map;
}

export function lookupInsightXLabel(
  map: Map<string, InsightXAddressLabel>,
  address: string,
  chain: string,
): InsightXAddressLabel | undefined {
  const network = toInsightXNetwork(chain);
  const isEvm = network !== 'sol' && network !== 'sui';
  return map.get(isEvm ? address.toLowerCase() : address);
}

/**
 * Queries InsightX DEX Metrics (1 quota call; falling back to Distribution only
 * when `top10_pct` is omitted) and maps it to Sentinel's `HolderProfile`.
 */
export async function fetchInsightXOwnershipProfile(
  chain: string,
  address: string,
): Promise<HolderProfile | null> {
  if (!isInsightXConfigured()) return null;
  const cleanAddress = address.trim();
  if (!cleanAddress) return null;

  const metrics = await fetchInsightXDexMetrics(chain, cleanAddress);
  let top10Pct = metrics?.top10_pct ?? null;

  if (top10Pct === null) {
    const distribution = await fetchInsightXDistribution(chain, cleanAddress, top10Pct);
    if (distribution?.top10Pct !== null && distribution?.top10Pct !== undefined) {
      top10Pct = distribution.top10Pct;
    }
  }

  const solMetricsSupported = isInsightXSolanaMetricsSupported(chain);
  const snipersPct = solMetricsSupported ? metrics?.snipers_pct ?? null : null;
  const bundlersPct = solMetricsSupported ? metrics?.bundlers_pct ?? null : null;
  const insidersPct = solMetricsSupported ? metrics?.insiders_pct ?? null : null;
  const devPct = solMetricsSupported ? metrics?.dev_pct ?? null : null;

  const hasAnySignal =
    top10Pct !== null ||
    snipersPct !== null ||
    bundlersPct !== null ||
    insidersPct !== null ||
    devPct !== null;

  if (!hasAnySignal) return null;

  return {
    mint: cleanAddress,
    source: 'insightx',
    top10Pct,
    totalHolders: null,
    snipersPct,
    insidersPct,
    bundlersPct,
    devPct,
    proTraders: null,
    kols: null,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetches full on-demand InsightX intelligence for a token detail view / API route.
 * Never throws when the key is missing or rate-limited; returns `configured: false`
 * alongside the working Atlas Live embed URL.
 */
export async function fetchInsightXTokenIntelligence(
  chain: string,
  address: string,
  options?: { mode?: 'core' | 'full' },
): Promise<InsightXTokenIntelligence> {
  const cleanAddress = address.trim();
  const network = toInsightXNetwork(chain);
  const configured = isInsightXConfigured();
  const scannerSupported = isInsightXScannerSupported(network);
  const solMetricsSupported = isInsightXSolanaMetricsSupported(network);
  const atlasEmbedUrl = getInsightXAtlasEmbedUrl(network, cleanAddress);
  const mode = options?.mode ?? 'core';
  const apiKey = getApiKey();
  const coolingDown =
    (authCooldownKey === apiKey && Date.now() < authCooldownUntil) ||
    Date.now() < rateLimitCooldownUntil;

  if (!configured || !cleanAddress) {
    return {
      configured,
      network,
      token: cleanAddress,
      atlasEmbedUrl,
      capabilities: {
        atlasLive: Boolean(atlasEmbedUrl),
        dexMetrics: true,
        distribution: true,
        clusters: true,
        labels: true,
        snipersAndBundlers: solMetricsSupported,
        scanner: scannerSupported,
      },
      metrics: null,
      distribution: null,
      clusters: null,
      snipers: null,
      bundlers: null,
      insiders: null,
      scanner: null,
      rateLimit: {
        minuteRemaining: lastMinuteRemaining,
        monthRemaining: lastMonthRemaining,
        coolingDown,
      },
      detailLevel: mode,
      fetchedAt: new Date().toISOString(),
    };
  }

  if (mode === 'core') {
    const [metrics, clusters] = await Promise.all([
      fetchInsightXDexMetrics(network, cleanAddress),
      fetchInsightXClusters(network, cleanAddress),
    ]);

    return {
      configured: true,
      network,
      token: cleanAddress,
      atlasEmbedUrl,
      capabilities: {
        atlasLive: Boolean(atlasEmbedUrl),
        dexMetrics: true,
        distribution: true,
        clusters: true,
        labels: true,
        snipersAndBundlers: solMetricsSupported,
        scanner: scannerSupported,
      },
      metrics,
      distribution: null,
      clusters,
      snipers: null,
      bundlers: null,
      insiders: null,
      scanner: null,
      rateLimit: {
        minuteRemaining: lastMinuteRemaining,
        monthRemaining: lastMonthRemaining,
        coolingDown:
          (authCooldownKey === apiKey && Date.now() < authCooldownUntil) ||
          Date.now() < rateLimitCooldownUntil,
      },
      detailLevel: 'core',
      fetchedAt: new Date().toISOString(),
    };
  }

  const [metrics, rawDistribution, clusters, snipers, bundlers, insiders, scanner] =
    await Promise.all([
      fetchInsightXDexMetrics(network, cleanAddress),
      insightxFetch<InsightXDistributionResponse>(
        `/dex-metrics/v1/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}/distribution`,
      ),
      fetchInsightXClusters(network, cleanAddress),
      solMetricsSupported ? fetchInsightXSnipers(network, cleanAddress) : Promise.resolve(null),
      solMetricsSupported ? fetchInsightXBundlers(network, cleanAddress) : Promise.resolve(null),
      solMetricsSupported ? fetchInsightXInsiders(network, cleanAddress) : Promise.resolve(null),
      scannerSupported ? fetchInsightXScanner(network, cleanAddress) : Promise.resolve(null),
    ]);

  const distribution = normalizeDistributionMetrics(rawDistribution, metrics?.top10_pct ?? null);

  return {
    configured: true,
    network,
    token: cleanAddress,
    atlasEmbedUrl,
    capabilities: {
      atlasLive: Boolean(atlasEmbedUrl),
      dexMetrics: true,
      distribution: true,
      clusters: true,
      labels: true,
      snipersAndBundlers: solMetricsSupported,
      scanner: scannerSupported,
    },
    metrics,
    distribution,
    clusters,
    snipers,
    bundlers,
    insiders,
    scanner,
    rateLimit: {
      minuteRemaining: lastMinuteRemaining,
      monthRemaining: lastMonthRemaining,
      coolingDown:
        (authCooldownKey === apiKey && Date.now() < authCooldownUntil) ||
        Date.now() < rateLimitCooldownUntil,
    },
    detailLevel: 'full',
    fetchedAt: new Date().toISOString(),
  };
}
