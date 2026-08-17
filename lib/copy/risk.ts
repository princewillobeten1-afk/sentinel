export interface PortfolioExposure {
  tokenId: string;
  totalExposureUsd: number;
}

export interface PortfolioRiskLimits {
  maxTotalExposureUsd: number; // e.g. Max $1000 across all copied traders for a single token
}

export interface RiskCheckResult {
  passed: boolean;
  reasons: string[];
}

export class CopyRiskEngine {
  /**
   * Evaluates the risk of a new copy trade against portfolio-wide limits.
   * Prevents overexposure when multiple copied traders buy the same token.
   */
  public evaluatePortfolioRisk(
    proposedTradeSizeUsd: number,
    tokenId: string,
    currentExposures: PortfolioExposure[],
    limits: PortfolioRiskLimits
  ): RiskCheckResult {
    const reasons: string[] = [];
    
    const currentTokenExposure = currentExposures.find(e => e.tokenId === tokenId)?.totalExposureUsd || 0;
    const projectedExposure = currentTokenExposure + proposedTradeSizeUsd;

    if (projectedExposure > limits.maxTotalExposureUsd) {
      reasons.push(`Trade blocked. Projected portfolio exposure of $${projectedExposure} for token ${tokenId} exceeds the limit of $${limits.maxTotalExposureUsd}.`);
      return { passed: false, reasons };
    }

    if (projectedExposure > limits.maxTotalExposureUsd * 0.8) {
      reasons.push(`Warning: Combined token exposure reached ${((projectedExposure / limits.maxTotalExposureUsd) * 100).toFixed(0)}% of your limit.`);
    }

    return { passed: true, reasons };
  }
}
