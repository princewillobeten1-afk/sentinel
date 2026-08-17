/**
 * Versioned Configuration Management & Risk Override Engine (Sprint 39 §43-45, §72).
 * Tracks system settings history, rollback capabilities, and strictly audited temporary risk overrides.
 */

import { ConfigSetting, RiskOverride, AdminRole } from './types';
import { adminAuditService } from './audit';

export class AdminConfigService {
  private static instance: AdminConfigService;
  private settings: Map<string, ConfigSetting> = new Map();
  private history: Map<string, ConfigSetting[]> = new Map();
  private riskOverrides: Map<string, RiskOverride> = new Map();

  private constructor() {
    this.seedDefaultSettings();
  }

  public static getInstance(): AdminConfigService {
    if (!AdminConfigService.instance) {
      AdminConfigService.instance = new AdminConfigService();
    }
    return AdminConfigService.instance;
  }

  public getAllSettings(): ConfigSetting[] {
    return Array.from(this.settings.values());
  }

  public getSetting(key: string): ConfigSetting | undefined {
    return this.settings.get(key);
  }

  public getHistory(key: string): ConfigSetting[] {
    return this.history.get(key) || [];
  }

  /**
   * Update a configuration setting with automatic version increment.
   */
  public updateSetting(
    key: string,
    newValue: any,
    opts: { updatedBy: string; updatedByRole: AdminRole; reason: string }
  ): ConfigSetting {
    const existing = this.settings.get(key);
    if (!existing) {
      throw new Error(`Configuration key "${key}" does not exist.`);
    }

    const previousValue = existing.value;
    const newVersion = existing.version + 1;
    const now = new Date().toISOString();

    const updated: ConfigSetting = {
      ...existing,
      value: newValue,
      previousValue,
      version: newVersion,
      updatedBy: opts.updatedBy,
      reason: opts.reason,
      updatedAt: now,
    };

    // Save to active map and history
    this.settings.set(key, updated);
    const hist = this.history.get(key) || [];
    hist.push({ ...existing });
    this.history.set(key, hist);

    // Audit Log
    adminAuditService.record({
      actorId: opts.updatedBy,
      actorRole: opts.updatedByRole,
      action: 'SYSTEM_CONFIG_UPDATED',
      domain: 'system',
      resourceType: 'system_configuration',
      resourceId: key,
      reason: opts.reason,
      changesBefore: { version: existing.version, value: previousValue },
      changesAfter: { version: newVersion, value: newValue },
    });

    return updated;
  }

  /**
   * Rollback a configuration setting to a previous version.
   */
  public rollbackSetting(
    key: string,
    targetVersion: number,
    opts: { updatedBy: string; updatedByRole: AdminRole; reason: string }
  ): ConfigSetting {
    const hist = this.history.get(key) || [];
    const target = hist.find((s) => s.version === targetVersion);
    if (!target) {
      throw new Error(`Cannot rollback "${key}": version ${targetVersion} not found in history.`);
    }

    return this.updateSetting(key, target.value, {
      ...opts,
      reason: `[Rollback to v${targetVersion}] ${opts.reason}`,
    });
  }

  // ── Risk Overrides (Never Silent, Strict TTL Expiry) ──

  public createRiskOverride(opts: {
    entityType: 'TOKEN' | 'WALLET' | 'CREATOR';
    entityId: string;
    overrideRules: Record<string, any>;
    adminId: string;
    adminRole: AdminRole;
    reason: string;
    durationHours?: number;
  }): RiskOverride {
    const hours = opts.durationHours || 24;
    const now = Date.now();
    const id = `ovr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const override: RiskOverride = {
      id,
      entityType: opts.entityType,
      entityId: opts.entityId,
      overrideRules: opts.overrideRules,
      adminId: opts.adminId,
      adminRole: opts.adminRole,
      reason: opts.reason,
      expiresAt: new Date(now + hours * 3600 * 1000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.riskOverrides.set(id, override);

    adminAuditService.record({
      actorId: opts.adminId,
      actorRole: opts.adminRole,
      action: 'RISK_ENGINE_OVERRIDE_GRANTED',
      domain: 'security',
      resourceType: opts.entityType.toLowerCase(),
      resourceId: opts.entityId,
      reason: opts.reason,
      changesAfter: { overrideRules: opts.overrideRules, expiresAt: override.expiresAt },
    });

    return override;
  }

  public getActiveRiskOverride(entityId: string): RiskOverride | undefined {
    const now = Date.now();
    for (const ovr of this.riskOverrides.values()) {
      if (ovr.entityId === entityId && ovr.isActive) {
        if (Date.parse(ovr.expiresAt) > now) {
          return ovr;
        } else {
          ovr.isActive = false; // expire
        }
      }
    }
    return undefined;
  }

  public listRiskOverrides(): RiskOverride[] {
    const now = Date.now();
    return Array.from(this.riskOverrides.values()).map((ovr) => {
      if (Date.parse(ovr.expiresAt) <= now) ovr.isActive = false;
      return ovr;
    });
  }

  public reset(): void {
    this.settings.clear();
    this.history.clear();
    this.riskOverrides.clear();
    this.seedDefaultSettings();
  }

  private seedDefaultSettings(): void {
    const defaults: ConfigSetting[] = [
      {
        key: 'min_pool_liquidity_usd',
        group: 'RISK',
        value: 10000,
        version: 1,
        isDangerous: true,
        updatedBy: 'system_init',
        reason: 'Baseline minimum liquidity requirement for active discovery indexing',
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'max_slippage_tolerance_pct',
        group: 'RISK',
        value: 15.0,
        version: 1,
        isDangerous: false,
        updatedBy: 'system_init',
        reason: 'Maximum permitted slippage setting in trading form',
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'insider_risk_threshold_score',
        group: 'RISK',
        value: 75,
        version: 1,
        isDangerous: false,
        updatedBy: 'system_init',
        reason: 'Score above which token is flagged with high risk insider warning',
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'api_rate_limit_free_tier_rpm',
        group: 'RATE_LIMIT',
        value: 60,
        version: 1,
        isDangerous: false,
        updatedBy: 'system_init',
        reason: 'Requests per minute for unauthenticated / free tier API keys',
        updatedAt: new Date().toISOString(),
      },
      {
        key: 'ai_grounding_strictness_level',
        group: 'AI',
        value: 'STANDARD',
        version: 1,
        isDangerous: false,
        updatedBy: 'system_init',
        reason: 'Automated claim grounding strictness for AI responses',
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const s of defaults) {
      this.settings.set(s.key, s);
    }
  }
}

export const adminConfigService = AdminConfigService.getInstance();
