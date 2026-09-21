import 'server-only';

import { getTokenCardPatch, updateTokenCard } from '@/lib/market/live/card-cache';

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

interface DexPair {
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h1?: number; h24?: number };
  txns?: { h1?: { buys?: number; sells?: number }; h24?: { buys?: number; sells?: number } };
  priceChange?: { h1?: number; h24?: number };
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
      if (!pair) continue;
      const buys1h = finite(pair.txns?.h1?.buys);
      const sells1h = finite(pair.txns?.h1?.sells);
      const buys24h = finite(pair.txns?.h24?.buys);
      const sells24h = finite(pair.txns?.h24?.sells);
      updateTokenCard(mint, {
        priceUsd: finite(pair.priceUsd) !== undefined ? String(finite(pair.priceUsd)) : undefined,
        marketCapUsd: finite(pair.marketCap ?? pair.fdv) !== undefined ? String(finite(pair.marketCap ?? pair.fdv)) : undefined,
        liquidityUsd: finite(pair.liquidity?.usd) !== undefined ? String(finite(pair.liquidity?.usd)) : undefined,
        volume1hUsd: finite(pair.volume?.h1) !== undefined ? String(finite(pair.volume?.h1)) : undefined,
        volume24hUsd: finite(pair.volume?.h24) !== undefined ? String(finite(pair.volume?.h24)) : undefined,
        buysCount: buys1h,
        sellsCount: sells1h,
        buysCount1h: buys1h,
        sellsCount1h: sells1h,
        buysCount24h: buys24h,
        sellsCount24h: sells24h,
        txCount1h: buys1h !== undefined && sells1h !== undefined ? buys1h + sells1h : undefined,
        txCount24h: buys24h !== undefined && sells24h !== undefined ? buys24h + sells24h : undefined,
        priceChange1h: finite(pair.priceChange?.h1),
        priceChange24h: finite(pair.priceChange?.h24),
        marketEvidence: {
          status: 'measured',
          source: 'dexscreener-batch-rest',
          observedAt,
          expiresAt: new Date(Date.now() + RECONCILE_MS).toISOString(),
        },
      }, 'dexscreener-batch-rest', 'fresh', observedAt);
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
