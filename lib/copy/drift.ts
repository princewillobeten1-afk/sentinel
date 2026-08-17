import { TraderStrategy } from './types';

export interface StrategyDriftReport {
  hasDrifted: boolean;
  riskEscalation: boolean;
  driftMetrics: string[];
}

export class StrategyDriftDetector {
  /**
   * Compares a trader's historical behavioral baseline against their recent trades
   * to detect if their strategy has changed (e.g., started trading lower liquidity, higher risk).
   */
  public detectDrift(baseline: TraderStrategy, recentActivity: TraderStrategy): StrategyDriftReport {
    const driftMetrics: string[] = [];
    let riskEscalation = false;

    // Check position size changes
    if (recentActivity.avgPositionSize > baseline.avgPositionSize * 2) {
      driftMetrics.push(`Average position size doubled (from ${baseline.avgPositionSize} to ${recentActivity.avgPositionSize})`);
      riskEscalation = true;
    }

    // Check risk profile drift (stub representation)
    if (baseline.preferredTokens === 'LARGE_CAP' && recentActivity.preferredTokens === 'MICRO_CAP') {
      driftMetrics.push('Shifted from Large Cap to Micro Cap tokens');
      riskEscalation = true;
    }

    const hasDrifted = driftMetrics.length > 0;

    return {
      hasDrifted,
      riskEscalation,
      driftMetrics
    };
  }
}
