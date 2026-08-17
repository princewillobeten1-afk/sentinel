/**
 * Dynamic Feature Flag & Targeting Engine (Sprint 39 §41-42).
 * Supports percentage-based rollouts, user lists, role targeting, and regional rules.
 */

import { FeatureFlag, AdminRole } from './types';
import { adminAuditService } from './audit';

export class AdminFeatureFlagService {
  private static instance: AdminFeatureFlagService;
  private flags: Map<string, FeatureFlag> = new Map();

  private constructor() {
    this.seedDefaultFlags();
  }

  public static getInstance(): AdminFeatureFlagService {
    if (!AdminFeatureFlagService.instance) {
      AdminFeatureFlagService.instance = new AdminFeatureFlagService();
    }
    return AdminFeatureFlagService.instance;
  }

  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  public getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Evaluate whether a feature flag is enabled for a given context.
   */
  public evaluate(key: string, context?: { userId?: string; role?: AdminRole; region?: string }): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    if (!flag.enabled) return false;

    // 1. Role-based override
    if (context?.role && flag.targetRoles.length > 0) {
      if (flag.targetRoles.includes(context.role)) return true;
    }

    // 2. Explicit User Whitelist
    if (context?.userId && flag.targetUsers.length > 0) {
      if (flag.targetUsers.includes(context.userId)) return true;
    }

    // 3. Regional Restrictions
    if (context?.region && flag.targetRegions.length > 0) {
      if (!flag.targetRegions.includes(context.region.toUpperCase())) return false;
    }

    // 4. Percentage-Based Deterministic Rollout
    if (flag.rolloutPct >= 100) return true;
    if (flag.rolloutPct <= 0) return false;

    if (context?.userId) {
      // Deterministic hash of userId + flagKey
      let hash = 0;
      const str = `${context.userId}:${key}`;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      const score = Math.abs(hash) % 100;
      return score < flag.rolloutPct;
    }

    return flag.rolloutPct > 0;
  }

  /**
   * Create or update a feature flag.
   */
  public setFlag(
    flag: FeatureFlag,
    opts: { updatedBy: string; updatedByRole: AdminRole; reason: string }
  ): FeatureFlag {
    const previous = this.flags.get(flag.key);
    flag.updatedBy = opts.updatedBy;
    flag.updatedAt = new Date().toISOString();
    this.flags.set(flag.key, flag);

    adminAuditService.record({
      actorId: opts.updatedBy,
      actorRole: opts.updatedByRole,
      action: 'FEATURE_FLAG_UPDATED',
      domain: 'system',
      resourceType: 'feature_flag',
      resourceId: flag.key,
      reason: opts.reason,
      changesBefore: previous,
      changesAfter: flag,
    });

    return flag;
  }

  public reset(): void {
    this.flags.clear();
    this.seedDefaultFlags();
  }

  private seedDefaultFlags(): void {
    const defaults: FeatureFlag[] = [
      {
        key: 'copy_trading',
        name: 'Smart Money Copy Trading v2',
        description: 'Enables automated position mirroring for verified alpha traders',
        enabled: true,
        rolloutPct: 100,
        targetRoles: ['SUPER_ADMIN', 'ADMIN'],
        targetUsers: [],
        targetRegions: [],
        updatedBy: 'system_init',
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'ai_analyst',
        name: 'Sentinel AI Co-Pilot & Trade Journal',
        description: 'Activates generative AI chat and automated trade journal reviews',
        enabled: true,
        rolloutPct: 100,
        targetRoles: [],
        targetUsers: [],
        targetRegions: [],
        updatedBy: 'system_init',
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'launchpad',
        name: 'Decentralized Token Launchpad',
        description: 'Bonding curve creation and participation system',
        enabled: true,
        rolloutPct: 100,
        targetRoles: [],
        targetUsers: [],
        targetRegions: [],
        updatedBy: 'system_init',
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'cross_chain_base_routing',
        name: 'Base Layer-2 Swap Routing (Beta)',
        description: 'Enables Uniswap v3 & Aerodrome routing on Base network',
        enabled: true,
        rolloutPct: 25,
        targetRoles: ['SUPER_ADMIN', 'DEVELOPER'],
        targetUsers: ['user_001'],
        targetRegions: ['US', 'EU'],
        updatedBy: 'system_init',
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'limit_orders_trailing_stop',
        name: 'Trailing Stop-Loss Execution Engine',
        description: 'Advanced dynamic trigger limit orders',
        enabled: false,
        rolloutPct: 0,
        targetRoles: ['DEVELOPER'],
        targetUsers: [],
        targetRegions: [],
        updatedBy: 'system_init',
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const f of defaults) {
      this.flags.set(f.key, f);
    }
  }
}

export const adminFeatureFlagService = AdminFeatureFlagService.getInstance();
