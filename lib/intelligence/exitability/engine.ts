// lib/intelligence/exitability/engine.ts
import { 
  ExitabilityScore, 
  ExecutionEstimate, 
  TokenRestrictions,
  ExitabilityRating
} from './types';

export class ExitabilityEngine {
  
  /**
   * Simulates a trade against a mocked constant-product AMM pool.
   * In a real implementation, this would query on-chain reserves or an aggregator SDK.
   */
  public simulateExit(
    positionSizeUsd: number, 
    executableLiquidityUsd: number,
    restrictions: TokenRestrictions
  ): ExecutionEstimate {
    
    if (!restrictions.canSell) {
      return {
        positionSizeUsd,
        estimatedProceedsUsd: 0,
        priceImpactPct: 100,
        slippageToleranceNeededPct: 100,
        feesUsd: 0,
        route: [],
        executionWarning: 'SELLABILITY WARNING: Token is currently restricted or paused.'
      };
    }

    // Simplistic constant product mock: impact ≈ size / (liquidity + size)
    const rawImpactPct = (positionSizeUsd / (executableLiquidityUsd + positionSizeUsd)) * 100;
    
    const sellTax = (positionSizeUsd * restrictions.sellTaxPct) / 100;
    const dexSwapFee = positionSizeUsd * 0.003; // 0.3% mock swap fee
    const feesUsd = sellTax + dexSwapFee;

    const estimatedProceedsUsd = positionSizeUsd - (positionSizeUsd * (rawImpactPct / 100)) - feesUsd;

    return {
      positionSizeUsd,
      estimatedProceedsUsd: Math.max(estimatedProceedsUsd, 0),
      priceImpactPct: Number(rawImpactPct.toFixed(2)),
      slippageToleranceNeededPct: Number((rawImpactPct + 1.0).toFixed(2)), // impact + buffer
      feesUsd,
      route: ['MockDEX Pool 1'],
      executionWarning: rawImpactPct > 10 ? 'High price impact. This order may move the market significantly.' : undefined
    };
  }

  /**
   * Generates the baseline exitability score for a token
   */
  public calculateBaselineExitability(
    tokenId: string,
    marketCapUsd: number,
    totalLiquidityUsd: number,
    executableLiquidityUsd: number,
    restrictions: TokenRestrictions
  ): ExitabilityScore {
    
    // Simulate some standard exits
    const sim10k = this.simulateExit(10000, executableLiquidityUsd, restrictions);
    const sim50k = this.simulateExit(50000, executableLiquidityUsd, restrictions);

    let score = 100;

    // Deduct for poor liquidity relative to market cap
    const liquidityRatio = executableLiquidityUsd / marketCapUsd;
    if (liquidityRatio < 0.01) score -= 40;
    else if (liquidityRatio < 0.05) score -= 20;

    // Deduct for price impact
    if (sim10k.priceImpactPct > 5) score -= 15;
    if (sim50k.priceImpactPct > 20) score -= 20;

    // Deduct for restrictions
    if (!restrictions.canSell) score = 0;
    if (restrictions.sellTaxPct > 5) score -= 10;
    if (restrictions.sellTaxPct > 15) score -= 30;

    score = Math.max(0, Math.min(100, score));

    let rating: ExitabilityRating = 'EXCELLENT';
    if (score < 40) rating = 'CRITICAL';
    else if (score < 60) rating = 'POOR';
    else if (score < 80) rating = 'MODERATE';
    else if (score < 92) rating = 'GOOD';

    return {
      tokenId,
      score: Math.round(score),
      rating,
      marketCapUsd,
      totalLiquidityUsd,
      executableLiquidityUsd,
      trend: 'STABLE', // mocked
      confidence: 'HIGH',
      factors: {
        liquidityDepth: executableLiquidityUsd > 100000 ? 'Good' : 'Poor',
        priceImpact: sim10k.priceImpactPct > 5 ? 'High' : 'Low',
        sellRestrictions: restrictions.canSell ? (restrictions.sellTaxPct > 0 ? `Sell Tax: ${restrictions.sellTaxPct}%` : 'None detected') : 'RESTRICTED',
        liquidityConcentration: 'Moderate',
        stressExit: sim50k.priceImpactPct > 15 ? 'Poor' : 'Good'
      }
    };
  }
}
