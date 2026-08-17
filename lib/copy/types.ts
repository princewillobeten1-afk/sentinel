export interface TokenIntelligence {
  token: string;
  riskScore: number;
  exitabilityScore: number;
  executableLiquidity: number;
}

export interface CopyProfile {
  id: string;
  maxTradeUsd: number;
  maxTokenExposurePercent: number;
  maxTokenRiskScore: number;
  minExitabilityScore: number;
  copyBuys: boolean;
  copySells: boolean;
}

export interface LeaderSignal {
  id: string;
  leaderWallet: string;
  token: string;
  side: 'BUY' | 'SELL';
  valueUsd: number;
  price: number;
  timestamp: number;
}

export type CopyDecision = 'COPY' | 'COPY_WITH_REDUCTION' | 'WARN' | 'SKIP';

export interface CopyTradeResult {
  decision: CopyDecision;
  approvedAmountUsd: number;
  reason: string;
  signal: LeaderSignal;
}

export interface CopiedPosition {
  id: string;
  leaderWallet: string;
  token: string;
  originalAllocationUsd: number;
  currentQuantity: number;
  costBasisUsd: number;
  copiedPercentage: number;
}

export interface TraderStrategy {
  preferredTokens: string;
  avgPositionSize: number;
  maxPositionSize: number;
}
