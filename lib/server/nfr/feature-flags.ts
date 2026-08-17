/**
 * Feature Flags & Progressive Canary Rollouts Engine (Sprint 32 §36-37).
 *
 * Implements dynamic feature flagging and safe progressive rollout capabilities:
 *   - Percentage-based rollouts (0% -> 10% -> 50% -> 100%)
 *   - Deterministic user bucketing (same user consistently gets the same variant)
 *   - Role and explicit user whitelisting (e.g. internal employees, alpha testers)
 *   - Instant kill-switch disabling
 */

import crypto from 'node:crypto';

export interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0 to 100
  allowedRoles?: string[];
  whitelistedUserIds?: string[];
  disabledUserIds?: string[];
}

const defaultFlags: FeatureFlag[] = [
  {
    key: 'advanced_copy_trading',
    description: 'Autonomous high-frequency copy trading and wallet mirroring',
    enabled: true,
    rolloutPercentage: 10, // 10% progressive rollout
    allowedRoles: ['admin', 'analyst'],
  },
  {
    key: 'mev_protection_ultra',
    description: 'Private mempool routing and Jito bundle integration',
    enabled: true,
    rolloutPercentage: 50,
  },
  {
    key: 'subsecond_order_stream',
    description: 'Sub-second real-time order matching stream',
    enabled: true,
    rolloutPercentage: 100,
  },
  {
    key: 'ai_pre_rug_detector_v2',
    description: 'Neural net graph clustering for pre-rug liquidity detection',
    enabled: true,
    rolloutPercentage: 25,
    allowedRoles: ['admin', 'analyst'],
  },
];

const flagsRegistry = new Map<string, FeatureFlag>();

for (const flag of defaultFlags) {
  flagsRegistry.set(flag.key, flag);
}

/**
 * Deterministically computes a hash bucket (0-99) for a user on a given feature key.
 */
export function computeUserBucket(userId: string, featureKey: string): number {
  const hash = crypto.createHash('md5').update(`${featureKey}:${userId}`).digest('hex');
  const integerVal = parseInt(hash.slice(0, 8), 16);
  return integerVal % 100;
}

export function isFeatureEnabled(
  key: string,
  context?: {
    userId?: string;
    role?: string;
  }
): boolean {
  const flag = flagsRegistry.get(key);
  if (!flag || !flag.enabled) {
    return false;
  }

  // Check explicit disable list
  if (context?.userId && flag.disabledUserIds?.includes(context.userId)) {
    return false;
  }

  // Check role override (admins/analysts get instant access if configured)
  if (context?.role && flag.allowedRoles?.includes(context.role)) {
    return true;
  }

  // Check explicit whitelist
  if (context?.userId && flag.whitelistedUserIds?.includes(context.userId)) {
    return true;
  }

  // 100% rollout check
  if (flag.rolloutPercentage >= 100) {
    return true;
  }

  // 0% rollout check
  if (flag.rolloutPercentage <= 0) {
    return false;
  }

  // Check deterministic bucket
  if (context?.userId) {
    const bucket = computeUserBucket(context.userId, key);
    return bucket < flag.rolloutPercentage;
  }

  return false;
}

export function setFeatureFlag(flag: FeatureFlag): void {
  flagsRegistry.set(flag.key, flag);
}

export function updateRolloutPercentage(key: string, percentage: number): void {
  const flag = flagsRegistry.get(key);
  if (flag) {
    flag.rolloutPercentage = Math.min(100, Math.max(0, percentage));
  }
}

export function getAllFeatureFlags(): FeatureFlag[] {
  return Array.from(flagsRegistry.values());
}

/** Test-only reset */
export function resetFeatureFlags(): void {
  flagsRegistry.clear();
  for (const flag of defaultFlags) {
    flagsRegistry.set(flag.key, { ...flag });
  }
}
