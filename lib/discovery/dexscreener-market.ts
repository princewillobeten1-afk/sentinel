import 'server-only';

import { getTokenCardPatch, updateTokenCard, type TokenCardFields } from '@/lib/market/live/card-cache';

const BASE = 'https://api.dexscreener.com/tokens/v1/solana';
const RECONCILE_MS = 30_000;
const BATCH_SIZE = 30;
const requestedAt = new Map<string, number>();
const pending = new Set<string>();
let draining = false;
let failures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;

export interface DexPair {
  chainId?: string;
  pairAddress?: string;
  pairCreatedAt?: number;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h24?: number };
  txns?: { m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number }; h24?: { buys?: number; sells?: number } };
  priceChange?: { m5?: number; h1?: number; h24?: number };
  info?: { imageUrl?: string; websites?: Array<{ url?: string }>;
    socials?: Array<{ type?: string; url?: string }> };
}

export function finite(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function selectDexPair(pairs: DexPair[], mint: string): DexPair | undefined {
  // DexScreener priceUsd and marketCap describe the BASE token. A quote-side
  // match must not supply another token's price to this card.
  return pairs.filter((pair) => pair?.baseToken?.address === mint)
    .sort((a, b) => (finite(b.liquidity?.usd) ?? -1) - (finite(a.liquidity?.usd) ?? -1))[0];
}

/** A lifecycle record is authoritative for column membership; this endpoint
 * supplies identity and measured market fields only when Jupiter is limited. */
export async function fetchDexPairSnapshots(mints: string[], timeoutMs = 8_000): Promise<Map<string, DexPair>> {
  const snapshots = new Map<string, DexPair>();
  const unique = [...new Set(mints.filter(Boolean))];
  for (let offset = 0; offset < unique.length; offset += BATCH_SIZE) {
    const batch = unique.slice(offset, offset + BATCH_SIZE);
    try {
      const response = await fetch(`${BASE}/${batch.map(encodeURIComponent).join(',')}`, {
        headers: { Accept: 'application/json' }, cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) continue;
      const body: unknown = await response.json();
      if (!Array.isArray(body)) continue;
      const pairs = body as DexPair[];
      for (const mint of batch) {
        const pair = selectDexPair(pairs, mint);
        if (pair?.chainId === 'solana' && pair.baseToken?.address === mint)
          snapshots.set(mint, pair);
      }
    } catch { /* Preserve any earlier cached metadata. */ }
  }
  return snapshots;
}

function reportFailure(mint: string, reason: string, observedAt: string): void {
  const current = getTokenCardPatch(mint)?.changedFields.marketEvidence;
  // The source health endpoint reports fallback failures separately. Do not
  // invalidate a healthy Birdeye/Jupiter observation when only this source fails.
  if (current && current.source !== 'dexscreener-batch-rest') return;
  updateTokenCard(mint, { marketEvidence: {
    ...current,
    status: current?.status === 'measured' || current?.status === 'stale' ? 'stale' : 'unavailable',
    source: 'dexscreener-batch-rest',
    observedAt: current?.observedAt ?? observedAt,
    reason,
  } }, 'dexscreener-batch-rest', 'stale', observedAt);
}

async function fetchBatch(mints: string[]): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${BASE}/${mints.map(encodeURIComponent).join(',')}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DexScreener returned HTTP ${response.status}`);
    const body = await response.json();
    const pairs: DexPair[] = Array.isArray(body) ? body : (body?.pairs ?? []);
    const observedAt = new Date().toISOString();
    for (const mint of mints) {
      const pair = selectDexPair(pairs, mint);
      if (!pair || pair.chainId !== 'solana') continue;
      const patch = getTokenCardPatch(mint);
      const current = patch?.changedFields;
      const next: TokenCardFields = {};
      const put = <K extends keyof TokenCardFields>(key: K, value: TokenCardFields[K], group: 'marketEvidence' | 'activityEvidence') => {
        if (value === undefined) return;
        const prior = current?.[key];
        const source = patch?.fieldSources?.[key] ?? current?.[group]?.source;
        if (prior === undefined || prior === null || prior === '' || source === 'dexscreener-batch-rest')
          (next as Record<string, unknown>)[key] = value;
      };
      const dollars = (value: unknown) => finite(value) !== undefined ? String(finite(value)) : undefined;
      const buys5m = finite(pair.txns?.m5?.buys);
      const sells5m = finite(pair.txns?.m5?.sells);
      const buys1h = finite(pair.txns?.h1?.buys);
      const sells1h = finite(pair.txns?.h1?.sells);
      const buys24h = finite(pair.txns?.h24?.buys);
      const sells24h = finite(pair.txns?.h24?.sells);
      put('priceUsd', dollars(pair.priceUsd), 'marketEvidence');
      put('marketCapUsd', dollars(pair.marketCap ?? pair.fdv), 'marketEvidence');
      put('liquidityUsd', dollars(pair.liquidity?.usd), 'marketEvidence');
      put('volume5mUsd', dollars(pair.volume?.m5), 'activityEvidence');
      put('buysCount5m', buys5m, 'activityEvidence');
      put('sellsCount5m', sells5m, 'activityEvidence');
      put('txCount5m', buys5m !== undefined && sells5m !== undefined ? buys5m + sells5m : undefined, 'activityEvidence');
      put('priceChange5m', finite(pair.priceChange?.m5), 'activityEvidence');
      put('volume1hUsd', dollars(pair.volume?.h1), 'marketEvidence');
      put('volume24hUsd', dollars(pair.volume?.h24), 'marketEvidence');
      put('buysCount', buys1h, 'marketEvidence');
      put('sellsCount', sells1h, 'marketEvidence');
      put('buysCount1h', buys1h, 'marketEvidence');
      put('sellsCount1h', sells1h, 'marketEvidence');
      put('buysCount24h', buys24h, 'marketEvidence');
      put('sellsCount24h', sells24h, 'marketEvidence');
      put('txCount1h', buys1h !== undefined && sells1h !== undefined ? buys1h + sells1h : undefined, 'marketEvidence');
      put('txCount24h', buys24h !== undefined && sells24h !== undefined ? buys24h + sells24h : undefined, 'marketEvidence');
      put('priceChange1h', finite(pair.priceChange?.h1), 'marketEvidence');
      put('priceChange24h', finite(pair.priceChange?.h24), 'marketEvidence');
      const keys = Object.keys(next);
      const evidence = (group: 'marketEvidence' | 'activityEvidence') => ({
        status: 'measured' as const,
        source: current?.[group]?.source && current[group]?.source !== 'dexscreener-batch-rest'
          ? `${current[group]!.source.split('+').filter(part => part !== 'dexscreener-batch-rest').join('+')}+dexscreener-batch-rest`
          : 'dexscreener-batch-rest',
        observedAt, expiresAt: new Date(Date.now() + RECONCILE_MS).toISOString(),
      });
      if (keys.some(key => ['volume5mUsd', 'buysCount5m', 'sellsCount5m', 'txCount5m', 'priceChange5m'].includes(key)))
        next.activityEvidence = evidence('activityEvidence');
      if (keys.some(key => !['volume5mUsd', 'buysCount5m', 'sellsCount5m', 'txCount5m', 'priceChange5m'].includes(key)))
        next.marketEvidence = evidence('marketEvidence');
      if (keys.length) updateTokenCard(mint, next, 'dexscreener-batch-rest', 'fresh', observedAt);
    }
    failures = 0;
  } catch (error) {
    failures += 1;
    if (failures >= CIRCUIT_FAILURE_THRESHOLD) circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    const observedAt = new Date().toISOString();
    const reason = error instanceof Error ? error.message : 'DexScreener reconciliation failed.';
    for (const mint of mints) {
      reportFailure(mint, reason, observedAt);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (pending.size > 0) {
      const batch = [...pending].slice(0, BATCH_SIZE);
      batch.forEach((mint) => pending.delete(mint));
      await fetchBatch(batch);
    }
  } finally {
    draining = false;
  }
}

/** Queues a 30-second, 30-mint fallback reconciliation without blocking REST. */
export function queueDexMarketReconciliation(mints: string[]): void {
  const now = Date.now();
  if (now < circuitOpenUntil) {
    const observedAt = new Date(now).toISOString();
    for (const mint of mints) {
      if (!mint) continue;
      reportFailure(mint, 'DexScreener circuit breaker is cooling down after repeated failures.', observedAt);
    }
    return;
  }
  for (const mint of mints) {
    if (!mint || now - (requestedAt.get(mint) ?? 0) < RECONCILE_MS) continue;
    requestedAt.set(mint, now);
    pending.add(mint);
  }
  if (!draining && pending.size > 0) void drain();
}

export function dexMarketStats(): { queued: number; draining: boolean; failures: number; circuitOpen: boolean; circuitRetryAfterMs: number } {
  return {
    queued: pending.size,
    draining,
    failures,
    circuitOpen: Date.now() < circuitOpenUntil,
    circuitRetryAfterMs: Math.max(0, circuitOpenUntil - Date.now()),
  };
}
