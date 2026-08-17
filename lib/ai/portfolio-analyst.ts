/**
 * Portfolio AI Risk & Exitability Analyst (Sprint 37 §63-64).
 *
 * Consumes deterministic portfolio metrics:
 *   - Allocation concentration
 *   - Pool liquidity depth per asset
 *   - Exitability score trajectory
 *   - Deteriorating liquidity exposure
 */

import { PortfolioAiAnalysis } from './types';

export interface PortfolioPositionInput {
  tokenAddress: string;
  symbol: string;
  valueUsd: number;
  allocationPct: number;
  liquidityUsd: number;
  exitabilityScore: number;
  hasLiquidityDrainWarning?: boolean;
}

export class PortfolioAiAnalyst {
  /**
   * Generates a comprehensive portfolio risk assessment.
   */
  public static analyzePortfolio(positions: PortfolioPositionInput[]): PortfolioAiAnalysis {
    if (!positions || positions.length === 0) {
      return {
        portfolioRiskRating: 'LOW',
        topRiskContributors: [],
        lowLiquidityExposurePct: 0,
        deterioratingExitabilityCount: 0,
        actionableInsights: ['No active open positions. Portfolio has zero speculative risk exposure.'],
        summary: 'Portfolio is currently 100% in liquid cash/base currency.',
      };
    }

    let lowLiquidityValue = 0;
    let deterioratingCount = 0;
    const totalValue = positions.reduce((acc, p) => acc + p.valueUsd, 0);

    const contributors: PortfolioAiAnalysis['topRiskContributors'] = [];
    const actionableInsights: string[] = [];

    for (const p of positions) {
      const isLowLiq = p.liquidityUsd < 50_000;
      const isPoorExit = p.exitabilityScore < 45;

      if (isLowLiq) {
        lowLiquidityValue += p.valueUsd;
      }
      if (isPoorExit || p.hasLiquidityDrainWarning) {
        deterioratingCount++;
        contributors.push({
          tokenAddress: p.tokenAddress,
          symbol: p.symbol,
          allocationPct: p.allocationPct,
          exitabilityScore: p.exitabilityScore,
          primaryConcern: isLowLiq
            ? `Extremely low liquidity ($${p.liquidityUsd.toLocaleString()}) limits exit capacity.`
            : `Exitability score is constrained (${p.exitabilityScore}/100).`,
        });
      }
    }

    const lowLiquidityExposurePct = totalValue > 0 ? Number(((lowLiquidityValue / totalValue) * 100).toFixed(1)) : 0;

    // Evaluate overall risk rating
    let rating: PortfolioAiAnalysis['portfolioRiskRating'] = 'LOW';
    if (lowLiquidityExposurePct > 40 || deterioratingCount >= 2) {
      rating = 'HIGH';
      actionableInsights.push(`Reduce allocation to assets with exitability under 45 (currently represents ${lowLiquidityExposurePct}% of portfolio).`);
    } else if (lowLiquidityExposurePct > 20 || deterioratingCount === 1) {
      rating = 'MODERATE';
      actionableInsights.push('Monitor positions with falling pool depth for potential slippage spikes.');
    } else {
      actionableInsights.push('Portfolio maintains healthy exitability depth across all major holdings.');
    }

    const summary = `Portfolio Risk is rated ${rating}. ${lowLiquidityExposurePct}% of portfolio is exposed to assets with shallow liquidity (<$50k pool depth). ${deterioratingCount} holding(s) exhibit deteriorating exit capacity.`;

    return {
      portfolioRiskRating: rating,
      topRiskContributors: contributors,
      lowLiquidityExposurePct,
      deterioratingExitabilityCount: deterioratingCount,
      actionableInsights,
      summary,
    };
  }
}
