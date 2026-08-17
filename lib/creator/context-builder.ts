/**
 * Wires the real `calculateReputation()` engine to existing mock creator
 * entities, replacing the hand-authored `.reputation` literal each mock
 * `CreatorEntity` carries (Sprint 28 — orphaned-engine wiring).
 *
 * `lib/mocks/creator-mocks.ts`'s `getMockCreatorEntity()` already builds a
 * structurally real `CreatorEntity` — real `launches` (`CreatorLaunchRecord[]`),
 * a real `behaviorProfile`, real `associatedWallets`. The ONLY placeholder
 * part is `.reputation`, which `identifyCreator()` itself marks as pending
 * (`createPendingReputation()`) until a separate reputation stage runs — the
 * mocks hand-authored that stage's output instead of running it. This module
 * runs it for real, keeping everything else (identification, launch history,
 * behavior profile) exactly as-is, since none of that was ever the
 * placeholder part.
 */

import { calculateReputation } from './creator-reputation';
import { getMockCreatorEntity } from '@/lib/mocks/creator-mocks';
import type { CreatorEntity } from './types';

/**
 * Returns the creator entity for a symbol with a genuinely computed
 * `.reputation`, or `null` for an unknown symbol (mirrors
 * `getMockCreatorEntity`'s null-return contract).
 */
export function computeCreatorEntity(symbol: string): CreatorEntity | null {
  const base = getMockCreatorEntity(symbol);
  if (!base) return null;

  const reputation = calculateReputation({
    launches: base.launches,
    behaviorProfile: base.behaviorProfile,
    patterns: base.reputation.patterns,
    associatedWalletCount: base.associatedWallets.length,
    creatorIdentified: base.primaryAddress !== '',
    hasOnChainHistory: base.launches.length > 0,
  });

  return { ...base, reputation };
}
