// lib/portfolio/intelligence-engine.ts

import { PortfolioPosition, PortfolioSummary } from './pnl-types';

export class PortfolioIntelligenceEngine {
  
  /**
   * Enriches a standard financial position with Sprint 17 (Exitability) and Sprint 16 (Insider Risk) data.
   */
  public enrichPosition(position: Omit<PortfolioPosition, 'exitabilityScore' | 'insiderRisk' | 'organicVolumePct' | 'portfolioWeightPct'>): PortfolioPosition {
    // In a real implementation, this would query the ExitabilityEngine and InsiderRiskEngine.
    // We mock the intelligence data for the MVP.
    return {
      ...position,
      exitabilityScore: Math.floor(Math.random() * 40) + 40, // 40-80
      insiderRisk: Math.random() > 0.8 ? 'HIGH' : 'LOW',
      organicVolumePct: 75,
      portfolioWeightPct: 0 // Calculated in summarize
    };
  }

  public summarizePortfolio(positions: PortfolioPosition[]): PortfolioSummary {
    let totalReportedValueUsd = 0;
    let estimatedExecutableValueUsd = 0;
    let trueNetPnlUsd = 0;
    let realizedPnlUsd = 0;
    let unrealizedPnlUsd = 0;
    let knownCostsUsd = 0;

    for (const p of positions) {
      totalReportedValueUsd += p.marketValueUsd;
      estimatedExecutableValueUsd += p.estimatedExecutableValueUsd;
      trueNetPnlUsd += p.trueNetPnlUsd;
      realizedPnlUsd += p.realizedPnlUsd;
      unrealizedPnlUsd += p.unrealizedPnlUsd;
      knownCostsUsd += p.totalFeesPaidUsd + p.totalGasPaidUsd + p.totalSlippageUsd;
    }

    // Assign portfolio weights
    if (totalReportedValueUsd > 0) {
      positions.forEach(p => {
        p.portfolioWeightPct = (p.marketValueUsd / totalReportedValueUsd) * 100;
      });
    }

    const maxWeight = Math.max(...positions.map(p => p.portfolioWeightPct), 0);
    let concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (maxWeight > 40) concentrationRisk = 'HIGH';
    else if (maxWeight > 20) concentrationRisk = 'MEDIUM';

    const liquidityRatio = totalReportedValueUsd > 0 ? (estimatedExecutableValueUsd / totalReportedValueUsd) : 1;
    let liquidityHealth: 'POOR' | 'MODERATE' | 'GOOD' = 'GOOD';
    if (liquidityRatio < 0.5) liquidityHealth = 'POOR';
    else if (liquidityRatio < 0.8) liquidityHealth = 'MODERATE';

    // Mock aggregate intelligence metrics
    const overallExitability = positions.length > 0 
      ? positions.reduce((acc, p) => acc + p.exitabilityScore * (p.portfolioWeightPct / 100), 0)
      : 0;

    return {
      totalReportedValueUsd,
      estimatedExecutableValueUsd,
      trueNetPnlUsd,
      realizedPnlUsd,
      unrealizedPnlUsd,
      knownCostsUsd,
      concentrationRisk,
      liquidityHealth,
      overallExitability: Math.round(overallExitability),
      insiderExposurePct: 14 // Mocked for MVP
    };
  }
}
