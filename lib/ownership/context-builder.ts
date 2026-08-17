/**
 * Wires the real `calculateEffectiveOwnership()` engine to raw mock inputs,
 * replacing `lib/mocks/ownership-mocks.ts`'s `getMockOwnershipReport()` (a
 * set of hand-authored `EffectiveOwnershipReport` literals) with the actual
 * computed pipeline (Sprint 28 — orphaned-engine wiring).
 *
 * `MOCK_HOLDERS`/`MOCK_CLUSTERS` are already exactly the raw shape
 * `calculateEffectiveOwnership()` expects (confirmed against
 * `lib/ownership/__tests__/effective-ownership.test.ts`) — the only thing
 * missing is total/circulating supply, which only existed inside the old
 * literals (not exported). The values below mirror those literals exactly,
 * so switching the routes over produces the same qualitative concentration
 * reads (e.g. QUANT stays EXTREME) rather than a discontinuity.
 */

import { calculateEffectiveOwnership, type OwnershipInput } from './effective-ownership';
import type { EffectiveOwnershipReport } from './types';
import { MOCK_HOLDERS, MOCK_CLUSTERS } from '@/lib/mocks/ownership-mocks';

interface TokenSupplyProfile {
  tokenId: string;
  totalSupply: number;
  circulatingSupply: number;
}

/** Mirrors the totalSupply/circulatingSupply baked into the old report literals. */
const SUPPLY_PROFILES: Record<string, TokenSupplyProfile> = {
  SENT: { tokenId: 'dt_sentinel', totalSupply: 100_000_000, circulatingSupply: 85_000_000 },
  QUANT: { tokenId: 'dt_quantum', totalSupply: 100_000_000, circulatingSupply: 90_000_000 },
  BONK: { tokenId: 'dt_bonk', totalSupply: 100_000_000_000, circulatingSupply: 93_000_000_000 },
  ALPHA: { tokenId: 'dt_alpha', totalSupply: 100_000_000, circulatingSupply: 95_000_000 },
};

export function buildOwnershipInput(symbol: string): OwnershipInput | null {
  const key = symbol.toUpperCase();
  const profile = SUPPLY_PROFILES[key];
  const holders = MOCK_HOLDERS[key];

  if (!profile || !holders) return null;

  return {
    tokenId: profile.tokenId,
    chain: 'solana',
    totalSupply: profile.totalSupply,
    circulatingSupply: profile.circulatingSupply,
    holders,
    clusters: MOCK_CLUSTERS[key] ?? [],
  };
}

/**
 * Runs the real engine for a symbol. Returns `null` when no context can be
 * built for it (unknown symbol) — callers should surface a 404, not a 500,
 * for that case (this mirrors the null-return contract
 * `getMockOwnershipReport()` already had, so route code barely changes).
 */
export function computeOwnershipReport(symbol: string): EffectiveOwnershipReport | null {
  const input = buildOwnershipInput(symbol);
  if (!input) return null;
  return calculateEffectiveOwnership(input);
}
