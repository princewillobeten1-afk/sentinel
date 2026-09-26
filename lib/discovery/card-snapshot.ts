import type { DiscoveryToken } from './types';
import type { TokenCardPatch, TokenCardFields } from '@/lib/market/live/card-cache';

const MARKET_FIELDS = new Set([
  'priceUsd', 'marketCapUsd', 'liquidityUsd', 'volume5mUsd', 'volume1hUsd', 'volume24hUsd', 'priceChange5m', 'priceChange1h', 'priceChange24h',
  'buyVolume5mUsd', 'sellVolume5mUsd', 'txCount5m', 'txCount1h', 'txCount24h', 'buysCount', 'sellsCount',
  'buysCount5m', 'sellsCount5m', 'buysCount1h', 'sellsCount1h', 'buysCount24h', 'sellsCount24h', 'marketEvidence', 'activityEvidence',
]);
const OWNERSHIP_FIELDS = new Set(['holdersCount', 'top10HoldingsPct', 'devHoldingsPct', 'sniperPercentage',
  'insiderHoldingsPct', 'bundlerPercentage', 'proTradersCount', 'kolsCount', 'ownershipEvidence']);
const LIFECYCLE_FIELDS = new Set(['lifecycleState', 'bondingCurveProgress', 'migrationSignature',
  'migratedPool', 'migratedDex', 'migratedAt', 'lifecycleEvidence']);

function marketSourcePriority(source: string | undefined): number {
  if (!source) return 0;
  if (/birdeye|jupiter/.test(source)) return 3;
  if (source.includes('dexscreener')) return 1;
  return 0;
}

/** REST polling and WebSocket snapshots race; observation time, not arrival, wins. */
export function mergeTokenCardSnapshot(token: DiscoveryToken, patch: TokenCardPatch): DiscoveryToken {
  const accepted = Object.fromEntries(Object.entries(patch.changedFields).filter(([key, value]) => {
    if (value === undefined) return false;
    if (LIFECYCLE_FIELDS.has(key) && token.lifecycleState === 'migrated'
      && patch.changedFields.lifecycleState && patch.changedFields.lifecycleState !== 'migrated') return false;
    const group = MARKET_FIELDS.has(key)
      ? (['volume5mUsd', 'buyVolume5mUsd', 'sellVolume5mUsd', 'priceChange5m', 'txCount5m', 'buysCount5m', 'sellsCount5m', 'activityEvidence'].includes(key) ? 'activityEvidence' : 'marketEvidence')
      : OWNERSHIP_FIELDS.has(key) ? 'ownershipEvidence' : LIFECYCLE_FIELDS.has(key) ? 'lifecycleEvidence' : null;
    if (!group) return true;
    // Provider fallback is per field, not per whole card. A later fallback
    // observation must fill unknown REST values, never replace a measured
    // primary field merely because its request completed later.
    const fallback = patch.fieldSources?.[key as keyof TokenCardFields];
    if (group !== 'lifecycleEvidence' && key !== group && token[group]?.status === 'measured'
      && marketSourcePriority(fallback) > 0
      && marketSourcePriority(token[group]?.source) > marketSourcePriority(fallback)) {
      const baseline = (token as unknown as Record<string, unknown>)[key];
      if ((typeof baseline === 'number' && Number.isFinite(baseline))
        || (typeof baseline === 'string' && baseline.trim() !== '')) return false;
    }
    const baselineAt = Date.parse(token[group]?.observedAt ?? '');
    const fieldAt = Date.parse(patch.fieldObservedAt?.[key as keyof TokenCardFields]
      ?? patch.changedFields[group]?.observedAt ?? patch.observedAt);
    return Number.isFinite(fieldAt) && (!Number.isFinite(baselineAt) || fieldAt >= baselineAt);
  }));
  return { ...token, ...accepted };
}
