import 'server-only';

import type { HolderProfile } from './holder-profile';
import { fetchTrackerOwnership, trackerConfigured } from '@/lib/trading/solana-tracker';
import { fetchRugcheckOwnership } from '@/lib/trading/rugcheck-ownership';
import { fetchOnChainOwnership } from '@/lib/trading/onchain-ownership';

const FIELDS = ['top10Pct', 'totalHolders', 'snipersPct', 'insidersPct',
  'bundlersPct', 'devPct', 'proTraders', 'kols'] as const;

/** Merge only absent measurements; a partial response cannot suppress another provider. */
export function mergeOwnershipProfiles(base: HolderProfile | null, next: HolderProfile | null): HolderProfile | null {
  if (!next) return base;
  if (!base) return { ...next };
  const merged = { ...base };
  let contributed = false;
  for (const key of FIELDS) {
    if (merged[key] === null && next[key] !== null) {
      merged[key] = next[key];
      contributed = true;
    }
  }
  if (contributed) {
    merged.source = [base.source ?? 'birdeye-holder-profile', next.source ?? 'birdeye-holder-profile']
      .filter((source, index, all) => all.indexOf(source) === index).join('+');
    merged.fetchedAt = Math.min(base.fetchedAt, next.fetchedAt);
  }
  return merged;
}

function needsMore(profile: HolderProfile | null, devAddress?: string | null): boolean {
  return !profile || profile.top10Pct === null || profile.totalHolders === null
    || Boolean(devAddress && profile.devPct === null);
}

/**
 * Returns true if an ownership fallback is available.
 * Solana Tracker (if configured), Rugcheck (public API), and direct Solana RPC
 * are available fallbacks.
 */
export function hasOwnershipFallback(): boolean {
  return true;
}

/**
 * Resolves and joins complementary ownership measurements in priority order:
 * 1. Solana Tracker (if API key is configured)
 * 2. Rugcheck report (public API, provides top-account concentration and
 *    creator percentage only when the creator is in the returned list)
 * 3. On-chain Solana RPC (direct getTokenLargestAccounts + getTokenSupply)
 */
export async function resolveOwnershipFallback(
  mint: string,
  devAddress?: string | null,
): Promise<HolderProfile | null> {
  if (!mint) return null;

  let result: HolderProfile | null = null;
  // 1. Solana Tracker if configured
  if (trackerConfigured()) {
    try {
      const tracker = await fetchTrackerOwnership(mint);
      result = mergeOwnershipProfiles(result, tracker);
    } catch {
      // Fall through to next provider
    }
  }

  // 2. Rugcheck public API
  if (needsMore(result, devAddress)) {
    try { result = mergeOwnershipProfiles(result, await fetchRugcheckOwnership(mint)); }
    catch { /* Continue with independent providers. */ }
  }

  // 3. Direct on-chain Solana RPC
  if (needsMore(result, devAddress)) {
    try { result = mergeOwnershipProfiles(result, await fetchOnChainOwnership(mint, devAddress)); }
    catch { /* Continue with independent providers. */ }
  }

  return result;
}

/**
 * If primary provider (e.g. Birdeye) succeeded but left critical fields null
 * (such as top10Pct, devPct, or insidersPct), backfills them using Rugcheck or on-chain RPC.
 */
export async function backfillMissingProfileFields(
  profile: HolderProfile,
  devAddress?: string | null,
): Promise<HolderProfile> {
  if (!needsMore(profile, devAddress)) return profile;
  const fallback = await resolveOwnershipFallback(profile.mint, devAddress);
  return mergeOwnershipProfiles(profile, fallback) ?? profile;
}

