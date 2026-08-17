export enum EligibilityStatus {
  ELIGIBLE = 'ELIGIBLE',
  LIMITED = 'LIMITED',
  HIGH_RISK = 'HIGH_RISK',
  INELIGIBLE = 'INELIGIBLE',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA'
}

export interface EligibilityResult {
  status: EligibilityStatus;
  reasons: string[];
}

export interface TraderStats {
  completedTrades: number;
  daysActive: number;
  maxDrawdown: number;
  winRate: number;
  insiderExposureScore: number; // 0 to 100, where 100 is highly exposed
}

export class CopyEligibilityEngine {
  /**
   * Determines if a wallet is suitable to be presented as a copy-trading candidate.
   * Prevents copying wallets with insufficient data, extreme drawdowns, or high insider risk.
   */
  public evaluateEligibility(stats: TraderStats): EligibilityResult {
    const reasons: string[] = [];

    if (stats.completedTrades < 30 || stats.daysActive < 30) {
      reasons.push(`Insufficient history: ${stats.completedTrades} trades over ${stats.daysActive} days. Minimum required is 30/30.`);
      return { status: EligibilityStatus.INSUFFICIENT_DATA, reasons };
    }

    if (stats.insiderExposureScore > 80) {
      reasons.push(`High insider exposure detected (Score: ${stats.insiderExposureScore}).`);
      return { status: EligibilityStatus.INELIGIBLE, reasons };
    }

    if (stats.maxDrawdown > 80) {
      reasons.push(`Extreme maximum drawdown of ${stats.maxDrawdown}%. Too dangerous for standard copying.`);
      return { status: EligibilityStatus.INELIGIBLE, reasons };
    }

    if (stats.maxDrawdown > 50) {
      reasons.push(`High maximum drawdown of ${stats.maxDrawdown}%. Proceed with caution.`);
      return { status: EligibilityStatus.HIGH_RISK, reasons };
    }
    
    if (stats.winRate < 40) {
      reasons.push(`Low win rate of ${stats.winRate}%. Strategy relies on rare large wins.`);
      return { status: EligibilityStatus.LIMITED, reasons };
    }

    reasons.push('Trader passed all eligibility requirements.');
    return { status: EligibilityStatus.ELIGIBLE, reasons };
  }
}
