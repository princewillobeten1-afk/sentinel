import { isPostgresConfigured } from '@/lib/server/db/pool';
import { pgMarketRepository } from '@/lib/server/db/market-repository';
import type { Market } from './types';

/**
 * Persistence adapter for the canonical market registry (Phase 5).
 *
 * `CanonicalMarketRegistry` (discovery/market-registry.ts) keeps its in-memory
 * `Map` as the hot read path — it is consulted on nearly every pricing and
 * routing call and must stay synchronous. This adapter is the durable side:
 * discovered markets and their snapshots are written through to Postgres so a
 * restart doesn't erase the registry, and so market state can be queried
 * relationally (which the Map cannot do).
 *
 * Same facade shape as the other phases: real Postgres when `DATABASE_URL` is
 * configured, silently inert otherwise, so tests and Postgres-less dev keep
 * working unchanged.
 *
 * Writes are fire-and-forget by design: the registry's own in-memory state is
 * already updated by the time these run, and a persistence hiccup must not
 * fail a price quote. Failures are surfaced via the returned promise for
 * callers that want to await them.
 */

export function marketToUpsertInput(market: Market) {
  return {
    chainId: market.chainId,
    protocol: market.protocol,
    marketType: market.marketType,
    address: market.address,
    baseTokenId: market.baseTokenId,
    quoteTokenId: market.quoteTokenId,
    feeBps: market.feeBps,
    status: market.status,
    source: market.source,
    metadata: market.metadata ?? {},
  };
}

/** Write-through for a discovered/updated market. No-op without Postgres. */
export async function persistMarket(market: Market): Promise<void> {
  if (!isPostgresConfigured()) return;
  await pgMarketRepository.upsertMarket(marketToUpsertInput(market));
}

/** Appends a market observation. Values stay strings — never JS floats. */
export async function persistMarketSnapshot(input: {
  marketId: string;
  price?: string | null;
  priceUsd?: string | null;
  liquidityUsd?: string | null;
  volume24hUsd?: string | null;
  confidence?: string | null;
  source?: string | null;
}): Promise<void> {
  if (!isPostgresConfigured()) return;
  await pgMarketRepository.recordSnapshot(input);
}

/** Durable market list, for callers that need more than the process's own Map. */
export async function loadPersistedMarkets(opts: { limit?: number; chainId?: string } = {}) {
  if (!isPostgresConfigured()) return [];
  return pgMarketRepository.listMarkets({
    limit: opts.limit ?? 500,
    offset: 0,
    chainId: opts.chainId,
  });
}
