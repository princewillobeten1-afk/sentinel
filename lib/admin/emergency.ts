/**
 * Platform Emergency Switchboard & Subsystem Kill Switch Engine (Sprint 39 §30-31).
 * Manages 5-tier emergency states, granular subsystem pauses, and circuit breakers.
 */

import { TradingEmergencyMode, EmergencyKillSwitches, EmergencyPlatformState, AdminRole } from './types';
import { adminAuditService } from './audit';

export class AdminEmergencyEngine {
  private static instance: AdminEmergencyEngine;

  private state: EmergencyPlatformState = {
    mode: 'NORMAL',
    killSwitches: {
      pauseNewTrades: false,
      pauseWithdrawals: false,
      pauseCopyTrading: false,
      pauseLaunchpad: false,
      disabledChains: [],
      disabledRouters: [],
    },
    circuitBreakers: {
      rpcPoolCircuitBreaker: { tripped: false },
      slippageSpikeCircuitBreaker: { tripped: false },
      insiderClusterCircuitBreaker: { tripped: false },
      launchpadDrainCircuitBreaker: { tripped: false },
    },
    updatedBy: 'system_bootstrap',
    updatedByRole: 'SUPER_ADMIN',
    reason: 'Initial clean system startup',
    updatedAt: new Date().toISOString(),
  };

  private constructor() {}

  public static getInstance(): AdminEmergencyEngine {
    if (!AdminEmergencyEngine.instance) {
      AdminEmergencyEngine.instance = new AdminEmergencyEngine();
    }
    return AdminEmergencyEngine.instance;
  }

  public getState(): EmergencyPlatformState {
    return { ...this.state, killSwitches: { ...this.state.killSwitches } };
  }

  /**
   * Transition platform emergency mode.
   */
  public setEmergencyMode(opts: {
    mode: TradingEmergencyMode;
    updatedBy: string;
    updatedByRole: AdminRole;
    reason: string;
  }): EmergencyPlatformState {
    const previousMode = this.state.mode;
    const now = new Date().toISOString();

    // Automatically apply baseline safety presets based on emergency mode
    if (opts.mode === 'FULL_EMERGENCY') {
      this.state.killSwitches.pauseNewTrades = true;
      this.state.killSwitches.pauseWithdrawals = true;
      this.state.killSwitches.pauseCopyTrading = true;
      this.state.killSwitches.pauseLaunchpad = true;
    } else if (opts.mode === 'TRADING_PAUSED') {
      this.state.killSwitches.pauseNewTrades = true;
      this.state.killSwitches.pauseCopyTrading = true;
    } else if (opts.mode === 'TRADING_RESTRICTED') {
      this.state.killSwitches.pauseCopyTrading = true;
    } else if (opts.mode === 'NORMAL') {
      this.state.killSwitches.pauseNewTrades = false;
      this.state.killSwitches.pauseWithdrawals = false;
      this.state.killSwitches.pauseCopyTrading = false;
      this.state.killSwitches.pauseLaunchpad = false;
    }

    this.state.mode = opts.mode;
    this.state.updatedBy = opts.updatedBy;
    this.state.updatedByRole = opts.updatedByRole;
    this.state.reason = opts.reason;
    this.state.updatedAt = now;

    // Record Immutable Audit Log
    adminAuditService.record({
      actorId: opts.updatedBy,
      actorRole: opts.updatedByRole,
      action: 'EMERGENCY_MODE_CHANGED',
      domain: 'system',
      resourceType: 'emergency_switchboard',
      resourceId: 'global_state',
      reason: opts.reason,
      changesBefore: { mode: previousMode },
      changesAfter: { mode: opts.mode, killSwitches: this.state.killSwitches },
      timestamp: now,
    });

    return this.getState();
  }

  /**
   * Toggle a specific granular kill switch.
   */
  public setKillSwitch<K extends keyof EmergencyKillSwitches>(
    switchKey: K,
    value: EmergencyKillSwitches[K],
    opts: { updatedBy: string; updatedByRole: AdminRole; reason: string }
  ): EmergencyPlatformState {
    const previous = this.state.killSwitches[switchKey];
    this.state.killSwitches[switchKey] = value;
    this.state.updatedBy = opts.updatedBy;
    this.state.updatedByRole = opts.updatedByRole;
    this.state.reason = opts.reason;
    this.state.updatedAt = new Date().toISOString();

    adminAuditService.record({
      actorId: opts.updatedBy,
      actorRole: opts.updatedByRole,
      action: `KILL_SWITCH_${String(switchKey).toUpperCase()}_UPDATED`,
      domain: 'system',
      resourceType: 'kill_switch',
      resourceId: String(switchKey),
      reason: opts.reason,
      changesBefore: { [switchKey]: previous },
      changesAfter: { [switchKey]: value },
    });

    return this.getState();
  }

  /**
   * Trip a circuit breaker automatically or manually.
   */
  public tripCircuitBreaker(breakerKey: string, reason: string): void {
    this.state.circuitBreakers[breakerKey] = {
      tripped: true,
      trippedAt: new Date().toISOString(),
      reason,
    };

    // Automatically elevate mode to DEGRADED if currently NORMAL
    if (this.state.mode === 'NORMAL') {
      this.state.mode = 'DEGRADED';
    }
  }

  /**
   * Reset a tripped circuit breaker.
   */
  public resetCircuitBreaker(breakerKey: string, opts: { updatedBy: string; updatedByRole: AdminRole; reason: string }): void {
    if (this.state.circuitBreakers[breakerKey]) {
      this.state.circuitBreakers[breakerKey] = { tripped: false };
    }

    adminAuditService.record({
      actorId: opts.updatedBy,
      actorRole: opts.updatedByRole,
      action: 'CIRCUIT_BREAKER_RESET',
      domain: 'system',
      resourceType: 'circuit_breaker',
      resourceId: breakerKey,
      reason: opts.reason,
    });
  }

  /**
   * Quick check if a specific action is blocked by current emergency state.
   */
  public isTradeAllowed(): boolean {
    return !this.state.killSwitches.pauseNewTrades && this.state.mode !== 'TRADING_PAUSED' && this.state.mode !== 'FULL_EMERGENCY';
  }

  public isWithdrawalAllowed(): boolean {
    return !this.state.killSwitches.pauseWithdrawals && this.state.mode !== 'FULL_EMERGENCY';
  }

  public isLaunchpadAllowed(): boolean {
    return !this.state.killSwitches.pauseLaunchpad && this.state.mode !== 'FULL_EMERGENCY';
  }

  public isChainDisabled(chain: string): boolean {
    return this.state.killSwitches.disabledChains.includes(chain.toLowerCase());
  }

  public isRouterDisabled(router: string): boolean {
    return this.state.killSwitches.disabledRouters.includes(router.toLowerCase());
  }

  public reset(): void {
    this.state = {
      mode: 'NORMAL',
      killSwitches: {
        pauseNewTrades: false,
        pauseWithdrawals: false,
        pauseCopyTrading: false,
        pauseLaunchpad: false,
        disabledChains: [],
        disabledRouters: [],
      },
      circuitBreakers: {
        rpcPoolCircuitBreaker: { tripped: false },
        slippageSpikeCircuitBreaker: { tripped: false },
        insiderClusterCircuitBreaker: { tripped: false },
        launchpadDrainCircuitBreaker: { tripped: false },
      },
      updatedBy: 'system_reset',
      updatedByRole: 'SUPER_ADMIN',
      reason: 'Clean test reset',
      updatedAt: new Date().toISOString(),
    };
  }
}

export const adminEmergencyEngine = AdminEmergencyEngine.getInstance();
