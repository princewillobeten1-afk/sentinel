import 'server-only';

import type { HolderProfile } from './holder-profile';
import { fetchTrackerOwnership, trackerConfigured } from '@/lib/trading/solana-tracker';
import { fetchRugcheckOwnership } from '@/lib/trading/rugcheck-ownership';
import { fetchOnChainOwnership } from '@/lib/trading/onchain-ownership';

/**
 * Returns true if an ownership fallback is available.
 * Solana Tracker (if configured), Rugcheck (public API), and direct Solana RPC
 * are available fallbacks.
 */
export function hasOwnershipFallback(): boolean {
  return true;
}

/**
 * Resolves ownership profile from fallback providers in priority order:
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

  // 1. Solana Tracker if configured
  if (trackerConfigured()) {
    try {
      const tracker = await fetchTrackerOwnership(mint);
      if (tracker) return tracker;
    } catch {
      // Fall through to next provider
    }
  }

  // 2. Rugcheck public API
  try {
    const rugcheck = await fetchRugcheckOwnership(mint);
    if (rugcheck) return rugcheck;
  } catch {
    // Fall through to on-chain RPC
  }

  // 3. Direct on-chain Solana RPC
  try {
    const onchain = await fetchOnChainOwnership(mint, devAddress);
    if (onchain) return onchain;
  } catch {
    // Ignore
  }

  return null;
}

/**
 * If primary provider (e.g. Birdeye) succeeded but left critical fields null
 * (such as top10Pct, devPct, or insidersPct), backfills them using Rugcheck or on-chain RPC.
 */
export async function backfillMissingProfileFields(
  profile: HolderProfile,
  devAddress?: string | null,
): Promise<HolderProfile> {
  const needsTop10 = profile.top10Pct === null;
  const needsDev = profile.devPct === null;
  const needsInsiders = profile.insidersPct === null;

  if (!needsTop10 && !needsDev && !needsInsiders) {
    return profile;
  }

  // First try Rugcheck for missing fields
  try {
    const rugcheck = await fetchRugcheckOwnership(profile.mint);
    if (rugcheck) {
      if (needsTop10 && rugcheck.top10Pct !== null) {
        profile.top10Pct = rugcheck.top10Pct;
      }
      if (needsDev && rugcheck.devPct !== null) {
        profile.devPct = rugcheck.devPct;
      }
      if (needsInsiders && rugcheck.insidersPct !== null) {
        profile.insidersPct = rugcheck.insidersPct;
      }
    }
  } catch {
    // Ignore
  }

  // If top 10 is still missing, try direct on-chain RPC
  if (profile.top10Pct === null) {
    try {
      const onchain = await fetchOnChainOwnership(profile.mint, devAddress);
      if (onchain?.top10Pct !== null && onchain?.top10Pct !== undefined) {
        profile.top10Pct = onchain.top10Pct;
      }
      if (profile.devPct === null && onchain?.devPct !== null && onchain?.devPct !== undefined) {
        profile.devPct = onchain.devPct;
      }
    } catch {
      // Ignore
    }
  }

  return profile;
}

