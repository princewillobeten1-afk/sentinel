import 'server-only';

import type { MetricEvidence, RugRiskEvidence } from '@/lib/discovery/types';
import { redis } from '@/lib/server/redis';

const REDIS_TTL_SECONDS = 10 * 60;
const REDIS_PREFIX = 'sentinel:token-card:';
const REDIS_CHANNEL = 'sentinel:token-card:patches';

export interface TokenCardFields extends Pick<import('@/lib/trading/sidebar-model').TradeSidebarSnapshot, 'activityEvidence' | 'funding' | 'fundingEvidence' | 'devBalanceSol' | 'devBalanceEvidence' | 'imageReuse' | 'liquidityEvidence'> {
  volume5mUsd?: string;
  buyVolume5mUsd?: number | null;
  sellVolume5mUsd?: number | null;
  buysCount5m?: number;
  sellsCount5m?: number;
  txCount5m?: number;
  priceUsd?: string;
  marketCapUsd?: string;
  liquidityUsd?: string;
  volume1hUsd?: string;
  volume24hUsd?: string;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange24h?: number;
  txCount1h?: number;
  txCount24h?: number;
  buysCount?: number;
  sellsCount?: number;
  buysCount1h?: number;
  sellsCount1h?: number;
  buysCount24h?: number;
  sellsCount24h?: number;
  holdersCount?: number;
  top10HoldingsPct?: number;
  devHoldingsPct?: number;
  sniperPercentage?: number;
  insiderHoldingsPct?: number;
  bundlerPercentage?: number;
  proTradersCount?: number;
  kolsCount?: number;
  devAddress?: string;
  devWalletAge?: string;
  devMints?: number;
  devMigrations?: number;
  isMintRenounced?: boolean;
  isFreezeDisabled?: boolean;
  isLiquidityLocked?: boolean;
  lpLockedPct?: number | null;
  rugRisk?: RugRiskEvidence;
  marketEvidence?: MetricEvidence;
  ownershipEvidence?: MetricEvidence;
  securityEvidence?: MetricEvidence;
  creatorEvidence?: MetricEvidence;
  lifecycleEvidence?: MetricEvidence;
  auditPending?: boolean;
  auditVersion?: string;
  lastTradeSide?: 'BUY' | 'SELL';
  lastTradeAmountUsd?: number;
  migrationSignature?: string;
  migratedPool?: string;
  migratedDex?: string;
  migratedAt?: number;
  bondingCurveProgress?: number;
  lifecycleState?: 'new_pairs' | 'final_stretch' | 'migrating' | 'migrated';
  liquidityPoolAddress?: string;
  isDexPaid?: boolean;
  dexPaidAt?: number;
  isBoosted?: boolean;
  boostAmount?: number;
}

export interface TokenCardPatch {
  mint: string;
  sequence: number;
  observedAt: string;
  source: string;
  freshness: 'fresh' | 'stale';
  changedFields: TokenCardFields;
  /** Individual observation times survive snapshot replay and process restart. */
  fieldObservedAt?: Partial<Record<keyof TokenCardFields, string>>;
}

type Listener = (patch: TokenCardPatch) => void;

interface CacheState {
  rows: Map<string, TokenCardPatch>;
  fieldObservedAt: Map<string, Map<string, number>>;
  sequence: number;
  listeners: Set<Listener>;
  redisSubscribed: boolean;
  redisSubscriptionRetry?: ReturnType<typeof setTimeout>;
  distributedHandler?: (raw: string) => void;
  instanceId: string;
}

const globalForCardCache = globalThis as typeof globalThis & { __sentinelCardCache?: CacheState };
const state: CacheState = (globalForCardCache.__sentinelCardCache ??= {
  rows: new Map(),
  fieldObservedAt: new Map(),
  sequence: 0,
  listeners: new Set(),
  redisSubscribed: false,
  instanceId: `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
});
state.redisSubscribed ??= false;
state.instanceId ??= `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface DistributedPatch {
  origin: string;
  patch: Omit<TokenCardPatch, 'sequence'>;
}

function mergeEvidence(previous: TokenCardFields, next: TokenCardFields): TokenCardFields {
  return Object.fromEntries([
    ...Object.entries(previous),
    ...Object.entries(next).filter(([, value]) => value !== undefined),
  ]) as TokenCardFields;
}

function applyTokenCard(
  mint: string,
  changedFields: TokenCardFields,
  source: string,
  freshness: 'fresh' | 'stale' = 'fresh',
  observedAt = new Date().toISOString(),
  publishDistributed = true,
  restoredFieldTimes?: TokenCardPatch['fieldObservedAt'],
): TokenCardPatch {
  const previous = state.rows.get(mint);
  const observedMs = Date.parse(observedAt);
  const fieldTimes = state.fieldObservedAt.get(mint) ?? new Map<string, number>();
  const accepted = Object.entries(changedFields).filter(([field, value]) => {
    if (value === undefined) return false;
    const previousObserved = fieldTimes.get(field) ?? Number.NEGATIVE_INFINITY;
    const fieldMs = Date.parse(restoredFieldTimes?.[field as keyof TokenCardFields] ?? observedAt);
    return Number.isFinite(fieldMs) && fieldMs >= previousObserved;
  });
  const delta = Object.fromEntries(accepted) as TokenCardFields;
  if (previous && accepted.length === 0) return previous;
  if (!Number.isFinite(observedMs)) {
    // Invalid timestamps have no ordering and cannot replace measured data.
    return { mint, sequence: state.sequence, observedAt, source, freshness: 'stale', changedFields: {} };
  }
  if (Number.isFinite(observedMs)) {
    for (const [field] of accepted) fieldTimes.set(field, Date.parse(restoredFieldTimes?.[field as keyof TokenCardFields] ?? observedAt));
    state.fieldObservedAt.set(mint, fieldTimes);
  }
  const patch: TokenCardPatch = {
    mint,
    sequence: ++state.sequence,
    observedAt: new Date(Math.max(observedMs, Date.parse(previous?.observedAt ?? '') || 0)).toISOString(),
    source,
    freshness,
    changedFields: mergeEvidence(previous?.changedFields ?? {}, delta),
    fieldObservedAt: Object.fromEntries([...fieldTimes].map(([field, time]) => [field, new Date(time).toISOString()])),
  };
  state.rows.set(mint, patch);
  void redis.set(`${REDIS_PREFIX}${mint}`, JSON.stringify(patch), REDIS_TTL_SECONDS);
  for (const listener of state.listeners) listener({ ...patch, observedAt, changedFields: delta });
  if (publishDistributed) {
    const message: DistributedPatch = {
      origin: state.instanceId,
      patch: { mint, observedAt, source, freshness, changedFields: delta },
    };
    void redis.publish(REDIS_CHANNEL, JSON.stringify(message));
  }
  return patch;
}

export function updateTokenCard(
  mint: string,
  changedFields: TokenCardFields,
  source: string,
  freshness: 'fresh' | 'stale' = 'fresh',
  observedAt = new Date().toISOString(),
): TokenCardPatch {
  return applyTokenCard(mint, changedFields, source, freshness, observedAt, true);
}

export function startTokenCardFanout(): void {
  if (state.redisSubscribed) return;
  state.redisSubscribed = true;
  state.distributedHandler ??= (raw) => {
    try {
      const message = JSON.parse(raw) as DistributedPatch;
      if (message.origin === state.instanceId || !message.patch?.mint || !message.patch.changedFields) return;
      applyTokenCard(
        message.patch.mint,
        message.patch.changedFields,
        message.patch.source || 'redis-fanout',
        message.patch.freshness || 'fresh',
        message.patch.observedAt,
        false,
        message.patch.fieldObservedAt,
      );
    } catch {
      // Malformed fan-out messages are ignored; REST reconciliation repairs
      // state without letting one bad frame poison the card cache.
    }
  };
  void redis.subscribe(REDIS_CHANNEL, state.distributedHandler).then((remoteConnected) => {
    if (remoteConnected) return;
    state.redisSubscribed = false;
    if (state.redisSubscriptionRetry) clearTimeout(state.redisSubscriptionRetry);
    state.redisSubscriptionRetry = setTimeout(startTokenCardFanout, 30_000);
    state.redisSubscriptionRetry.unref?.();
  });
}

/** Restores hot evidence after a process restart; restored values are stale until refreshed. */
export async function hydrateTokenCards(mints: string[]): Promise<void> {
  await Promise.all(mints.map(async (mint) => {
    if (!mint || state.rows.has(mint)) return;
    const raw = await redis.get(`${REDIS_PREFIX}${mint}`);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as TokenCardPatch;
      if (stored.mint !== mint || !stored.changedFields) return;
      const restored = { ...stored.changedFields };
      for (const group of ['marketEvidence', 'ownershipEvidence', 'securityEvidence', 'creatorEvidence', 'lifecycleEvidence'] as const) {
        const evidence = restored[group];
        if (evidence?.status === 'measured') restored[group] = { ...evidence, status: 'stale' };
      }
      // A stream may have arrived while Redis was being read. Per-field times
      // let the merge keep those newer values and recover older ownership too.
      applyTokenCard(mint, restored, stored.source || 'redis-cache', 'stale', stored.observedAt, false, stored.fieldObservedAt);
    } catch {
      // Corrupt cache entries are ignored and replaced by the provider pass.
    }
  }));
}

export function getTokenCardPatch(mint: string): TokenCardPatch | undefined {
  return state.rows.get(mint);
}

export function onTokenCardPatch(listener: Listener): () => void {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

export function tokenCardCacheStats(): { cached: number; sequence: number; redisFanout: boolean; redisDegraded: boolean } {
  return {
    cached: state.rows.size,
    sequence: state.sequence,
    redisFanout: state.redisSubscribed && !redis.isDegraded,
    redisDegraded: redis.isDegraded,
  };
}

export function __resetTokenCardCache(): void {
  state.rows.clear();
  state.fieldObservedAt.clear();
  state.sequence = 0;
  state.listeners.clear();
  if (state.redisSubscriptionRetry) clearTimeout(state.redisSubscriptionRetry);
  state.redisSubscriptionRetry = undefined;
  state.redisSubscribed = false;
}
