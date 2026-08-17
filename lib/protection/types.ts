export type ProtectionMode = 'BEST_EXECUTION' | 'BALANCED' | 'EMERGENCY';
export type ProtectionHealth = 'HEALTHY' | 'WARNING' | 'BLOCKED' | 'INVALID';

export type StopLossType = 'FIXED' | 'PERCENTAGE' | 'TRAILING' | 'BREAK_EVEN';

export interface StopLossConfig {
  id?: string;
  type: StopLossType;
  stopPrice: number;
  percentage?: number; // e.g. 15 for 15% below entry
  trailPct?: number; // e.g. 10 for 10% trailing
  highestObservedPrice?: number;
  portionPct: number; // e.g. 100 for 100% of remaining position
  isTriggered?: boolean;
}

export interface TakeProfitTarget {
  id?: string;
  level: number; // 1, 2, 3...
  targetPrice: number;
  portionPct: number; // e.g. 25.0 for 25% of position
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  executedAt?: string;
}

export interface PositionProtection {
  id: string;
  positionId: string;
  walletId: string;
  tokenId: string;
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  positionTokens: number;
  protectionMode: ProtectionMode;
  health: ProtectionHealth;
  autoBreakEven: boolean;
  stopLoss?: StopLossConfig;
  takeProfits: TakeProfitTarget[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProtectionExecutionRecord {
  id: string;
  protectionId: string;
  triggerType: 'STOP_LOSS' | 'TAKE_PROFIT' | 'EMERGENCY_EXIT';
  executedPrice: number;
  actualOutput: number;
  grossPnlUsd: number;
  netPnlUsd: number;
  feesPaidUsd: number;
  txHash: string;
  executedAt: string;
}

export interface NetPnlEstimate {
  grossPnlPct: number;
  estimatedFeePct: number;
  estimatedGasPct: number;
  estimatedSlippagePct: number;
  netPnlPct: number;
  netPnlUsd: number;
}
