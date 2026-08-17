// lib/intelligence/exitability/types.ts

export type ExitabilityRating = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR' | 'CRITICAL';
export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DETERIORATING';

export interface ExecutionEstimate {
  positionSizeUsd: number;
  estimatedProceedsUsd: number;
  priceImpactPct: number;
  slippageToleranceNeededPct: number;
  feesUsd: number;
  route: string[];
  executionWarning?: string;
}

export interface LiquidityDepth {
  depth0_5Pct: number;
  depth1Pct: number;
  depth2Pct: number;
  depth5Pct: number;
  depth10Pct: number;
}

export interface TokenRestrictions {
  canSell: boolean;
  sellTaxPct: number;
  maxSellAmountUsd?: number;
}

export interface ExitabilityScore {
  tokenId: string;
  score: number; // 0-100
  rating: ExitabilityRating;
  marketCapUsd: number;
  totalLiquidityUsd: number;
  executableLiquidityUsd: number; // liquidity within ±5%
  trend: TrendDirection;
  confidence: DataConfidence;
  factors: {
    liquidityDepth: string;
    priceImpact: string;
    sellRestrictions: string;
    liquidityConcentration: string;
    stressExit: string;
  };
}
