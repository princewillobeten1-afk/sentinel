/**
 * Admin Action Simulator Engine (Sprint 39 §78).
 * Previews BEFORE vs AFTER state diffs, financial revenue/volume impact,
 * liquidity stress projections, and safety warnings prior to execution.
 */

import { SimulationResult } from './types';

export class AdminActionSimulator {
  /**
   * Simulate a trading fee rate change.
   */
  public static simulateFeeChange(opts: {
    currentFeePct: number;
    proposedFeePct: number;
    baseline24hVolumeUsd?: number;
  }): SimulationResult {
    const volume = opts.baseline24hVolumeUsd || 84_200_000;
    const currentRevenue = volume * (opts.currentFeePct / 100);
    const feeDiffPct = ((opts.proposedFeePct - opts.currentFeePct) / opts.currentFeePct) * 100;

    // Price elasticity model: Lower fees stimulate higher trading volume
    // Elasticity coefficient ~ -0.65
    const volumeChangePct = -0.65 * feeDiffPct;
    const newEstimatedVolume = volume * (1 + volumeChangePct / 100);
    const newEstimatedRevenue = newEstimatedVolume * (opts.proposedFeePct / 100);
    const revenueChangePct = ((newEstimatedRevenue - currentRevenue) / currentRevenue) * 100;

    const warnings: string[] = [];
    if (opts.proposedFeePct > 1.0) {
      warnings.push('High Fee Warning: Fees exceeding 1.0% significantly increase trader attrition to competing DEX aggregators.');
    }
    if (opts.proposedFeePct < 0.1) {
      warnings.push('Revenue Risk: Sub-0.10% fees may fail to cover underlying RPC and relayer gas subsidies.');
    }

    return {
      actionType: 'FEE_RATE_CHANGE',
      target: 'DEX Swap Routing Fee',
      currentState: {
        tradingFeePct: opts.currentFeePct,
        projected24hRevenueUsd: Math.round(currentRevenue),
        projected24hVolumeUsd: volume,
      },
      proposedState: {
        tradingFeePct: opts.proposedFeePct,
        projected24hRevenueUsd: Math.round(newEstimatedRevenue),
        projected24hVolumeUsd: Math.round(newEstimatedVolume),
      },
      estimatedImpact: {
        revenueChangePct: Math.round(revenueChangePct * 10) / 10,
        volumeChangePct: Math.round(volumeChangePct * 10) / 10,
        affectedUsersCount: 8721,
        liquidityStressRisk: opts.proposedFeePct > opts.currentFeePct ? 'MEDIUM' : 'LOW',
        summary: `Changing fee from ${opts.currentFeePct}% to ${opts.proposedFeePct}% is projected to adjust 24h revenue by ${revenueChangePct >= 0 ? '+' : ''}${revenueChangePct.toFixed(1)}% with a ${volumeChangePct >= 0 ? '+' : ''}${volumeChangePct.toFixed(1)}% volume response.`,
      },
      warnings,
    };
  }

  /**
   * Simulate a platform emergency mode escalation.
   */
  public static simulateEmergencyEscalation(opts: {
    currentMode: string;
    proposedMode: string;
  }): SimulationResult {
    const warnings: string[] = [];

    let affectedUsers = 0;
    let volumeImpact = 0;
    let revenueImpact = 0;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if (opts.proposedMode === 'FULL_EMERGENCY') {
      affectedUsers = 8721;
      volumeImpact = -100;
      revenueImpact = -100;
      riskLevel = 'HIGH';
      warnings.push('CRITICAL: FULL_EMERGENCY will freeze all active trading, launchpad deposits, and asset withdrawals across all chains.');
      warnings.push('Requires dual-control authorization from SUPER_ADMIN role.');
    } else if (opts.proposedMode === 'TRADING_PAUSED') {
      affectedUsers = 8721;
      volumeImpact = -95;
      revenueImpact = -95;
      riskLevel = 'HIGH';
      warnings.push('All market swap executions will be rejected. Users with open positions cannot exit on platform.');
    } else if (opts.proposedMode === 'TRADING_RESTRICTED') {
      affectedUsers = 2400;
      volumeImpact = -35;
      revenueImpact = -30;
      riskLevel = 'MEDIUM';
      warnings.push('New limit orders and copy trading will be throttled. Market exits remain enabled.');
    } else if (opts.proposedMode === 'DEGRADED') {
      affectedUsers = 500;
      volumeImpact = -10;
      revenueImpact = -8;
      riskLevel = 'LOW';
    }

    return {
      actionType: 'EMERGENCY_MODE_CHANGE',
      target: 'Global Platform Operating Mode',
      currentState: { mode: opts.currentMode },
      proposedState: { mode: opts.proposedMode },
      estimatedImpact: {
        revenueChangePct: revenueImpact,
        volumeChangePct: volumeImpact,
        affectedUsersCount: affectedUsers,
        liquidityStressRisk: riskLevel,
        summary: `Escalating mode from ${opts.currentMode} to ${opts.proposedMode} directly restricts operational capabilities for ~${affectedUsers.toLocaleString()} active traders.`,
      },
      warnings,
    };
  }

  /**
   * Simulate a Risk Engine threshold change.
   */
  public static simulateRiskThresholdChange(opts: {
    thresholdName: string;
    currentValue: number;
    proposedValue: number;
  }): SimulationResult {
    const warnings: string[] = [];
    const diff = opts.proposedValue - opts.currentValue;

    return {
      actionType: 'RISK_THRESHOLD_CHANGE',
      target: opts.thresholdName,
      currentState: { [opts.thresholdName]: opts.currentValue },
      proposedState: { [opts.thresholdName]: opts.proposedValue },
      estimatedImpact: {
        revenueChangePct: diff > 0 ? -4.2 : 2.8,
        volumeChangePct: diff > 0 ? -5.5 : 4.1,
        affectedUsersCount: 1420,
        liquidityStressRisk: diff < 0 ? 'HIGH' : 'LOW',
        summary: `Adjusting ${opts.thresholdName} from ${opts.currentValue} to ${opts.proposedValue} alters risk filtering strictness across active token discovery lists.`,
      },
      warnings: diff < 0 ? ['Relaxing risk thresholds increases exposure to low-liquidity honeypots and rug pulls.'] : [],
    };
  }
}
