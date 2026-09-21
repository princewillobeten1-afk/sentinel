import 'server-only';

import type { MetricEvidence } from '@/lib/discovery/types';
import { evidence, failureReason, ProviderReadError, readProvider } from './provider-read';
import { measuredNumber } from './sidebar-model';

export interface LiquidityLockSnapshot {
  lpLockedPct: number | null;
  evidence: MetricEvidence;
}

interface CachedLock extends LiquidityLockSnapshot { expires: number }
const cache = new Map<string, CachedLock>();
const inFlight = new Map<string, Promise<LiquidityLockSnapshot>>();

/**
 * Rugcheck can report several pools. Use the deepest reported pool rather than
 * averaging unrelated LP supplies; the selected pool and percentage both come
 * from the same provider record.
 */
export function parseLiquidityLock(body: any): number | null {
  if (!Array.isArray(body?.markets) || body.markets.length === 0) return null;
  const measured = body.markets
    .map((market: any) => ({
      pct: measuredNumber(market?.lp?.lpLockedPct),
      depth: (measuredNumber(market?.lp?.baseUSD) ?? 0) + (measuredNumber(market?.lp?.quoteUSD) ?? 0),
    }))
    .filter((market: { pct: number | null }) => market.pct !== null && market.pct! >= 0 && market.pct! <= 100)
    .sort((a: { depth: number }, b: { depth: number }) => b.depth - a.depth);
  return measured[0]?.pct ?? null;
}

export async function getLiquidityLock(mint: string): Promise<LiquidityLockSnapshot> {
  const hit = cache.get(mint);
  if (hit && hit.expires > Date.now()) return hit;
  const pending = inFlight.get(mint);
  if (pending) return pending;

  const work = (async (): Promise<LiquidityLockSnapshot> => {
    try {
      const body = await readProvider('Rugcheck', `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report`);
      const locked = parseLiquidityLock(body);
      if (locked === null) throw new ProviderReadError('Rugcheck returned no measured LP lock percentage.');
      return { lpLockedPct: locked, evidence: evidence('rugcheck-largest-pool-lock', 5 * 60_000) };
    } catch (error) {
      return { lpLockedPct: null, evidence: evidence('rugcheck-largest-pool-lock', 60_000, failureReason(error)) };
    }
  })().then((value) => {
    if (cache.size >= 300) cache.delete(cache.keys().next().value!);
    cache.set(mint, { ...value, expires: Date.now() + (value.lpLockedPct === null ? 60_000 : 5 * 60_000) });
    return value;
  }).finally(() => inFlight.delete(mint));

  inFlight.set(mint, work);
  return work;
}

export function resetLiquidityLockCache(): void { cache.clear(); inFlight.clear(); }
