/**
 * Position-Specific Exitability & Multi-Tier Price Impact Simulator (Sprint 38 §27-31).
 *
 * Implements granular position-size exitability modeling:
 *   Simulates exact price impact, slippage, and execution costs across
 *   standard tiers: $100, $500, $1,000, $5,000, $10,000, $50,000.
 */

import { PositionExitabilitySimulation } from './types';

export class ExitabilitySimulator {
  private static readonly STANDARD_TIERS = [100, 500, 1000, 5000, 10000, 50000];

  /**
   * Simulates multi-tier position exitability for a token.
   */
  public static simulateExitability(params: {
    tokenAddress: string;
    poolLiquidityUsd: number;
    dailyVolumeUsd?: number;
    poolVolatility24hPct?: number;
    customTiers?: number[];
  }): PositionExitabilitySimulation {
    const {
      tokenAddress,
      poolLiquidityUsd,
      dailyVolumeUsd = 100_000,
      poolVolatility24hPct = 12.5,
      customTiers = this.STANDARD_TIERS,
    } = params;

    const effectiveBaseDepth = Math.max(1000, poolLiquidityUsd * 0.5); // 50% available quote depth

    const simulatedTradeSizesUsd = customTiers.map((size) => {
      // Constant-product AMM price impact model: Impact ≈ Size / (Depth + Size)
      const rawImpactPct = (size / (effectiveBaseDepth + size)) * 100;
      const estimatedPriceImpactPct = Number(rawImpactPct.toFixed(2));
      const estimatedSlippagePct = Number((rawImpactPct * 1.15).toFixed(2));
      const executionCostUsd = Number((size * (estimatedPriceImpactPct / 100) + 2.5).toFixed(2)); // + $2.50 base DEX/gas fee

      // Exitability Score for this specific size (100 is best)
      // Severe drop once impact exceeds 5%
      let sizeExitScore = Math.max(0, Math.round(100 - estimatedPriceImpactPct * 3.5));
      if (estimatedPriceImpactPct > 15) sizeExitScore = Math.min(sizeExitScore, 20);

      const isSafeExit = estimatedPriceImpactPct <= 5.0 && sizeExitScore >= 60;

      return {
        tradeSizeUsd: size,
        estimatedPriceImpactPct,
        estimatedSlippagePct,
        executionCostUsd,
        exitabilityScore: sizeExitScore,
        isSafeExit,
      };
    });

    // Overall token baseline score ($1,000 standard position)
    const baselineTier = simulatedTradeSizesUsd.find((t) => t.tradeSizeUsd === 1000) || simulatedTradeSizesUsd[0];
    const overallTokenExitabilityScore = baselineTier ? baselineTier.exitabilityScore : 50;

    // Liquidity Health Score (0 - 100)
    let healthScore = 75;
    if (poolLiquidityUsd < 50_000) healthScore -= 35;
    else if (poolLiquidityUsd > 500_000) healthScore += 15;

    if (poolVolatility24hPct > 30) healthScore -= 20;

    const liquidityHealthScore = Math.min(100, Math.max(0, healthScore));

    return {
      tokenAddress,
      simulatedTradeSizesUsd,
      overallTokenExitabilityScore,
      poolLiquidityUsd,
      poolVolatility24hPct,
      liquidityHealthScore,
    };
  }
}
