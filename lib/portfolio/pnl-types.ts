// lib/portfolio/pnl-types.ts

export type TransactionCategory = 'BUY' | 'SELL' | 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL' | 'AIRDROP' | 'REWARD';

export interface PortfolioTransaction {
  id: string;
  tokenId: string;
  category: TransactionCategory;
  quantity: number;
  priceUsd: number;
  feesUsd: number;
  gasUsd: number;
  estimatedSlippageUsd: number;
  executedAt: number;
}

export interface PortfolioPosition {
  tokenId: string;
  symbol: string;
  quantity: number;
  averageCostUsd: number;
  currentPriceUsd: number;
  
  // Financials
  marketValueUsd: number;
  estimatedExecutableValueUsd: number;
  
  grossPnlUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  
  totalFeesPaidUsd: number;
  totalGasPaidUsd: number;
  totalSlippageUsd: number;
  
  trueNetPnlUsd: number;

  // Intelligence
  exitabilityScore: number;
  insiderRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  organicVolumePct: number;
  portfolioWeightPct: number;
}

export interface PortfolioSummary {
  totalReportedValueUsd: number;
  estimatedExecutableValueUsd: number;
  
  trueNetPnlUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  
  knownCostsUsd: number;
  
  // Risk Analytics
  concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  liquidityHealth: 'POOR' | 'MODERATE' | 'GOOD';
  overallExitability: number;
  insiderExposurePct: number;
}
