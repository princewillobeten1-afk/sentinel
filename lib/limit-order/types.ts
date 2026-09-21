export type LimitOrderStatus = 
  | 'OPEN'
  | 'MONITORING'
  | 'TRIGGERED'
  | 'WAITING_FOR_SAFETY'
  | 'EXECUTING'
  | 'FILLED'
  | 'PARTIALLY_FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'INVALID';

export type LimitOrderHealth = 'HEALTHY' | 'WARNING' | 'BLOCKED' | 'INVALID';

export interface LimitOrderConditions {
  minLiquidityUsd?: number;
  minExitabilityScore?: number;
  maxInsiderRiskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  minOrganicVolumeRatio?: number;
  minCreatorRepScore?: number;
  maxPriceImpactPct?: number;
}

export interface ConditionEvaluationItem {
  id: string;
  label: string;
  required: string | number;
  current: string | number;
  status: 'PASSED' | 'FAILED' | 'UNKNOWN';
  message: string;
}

export interface ConditionEvaluationReport {
  passed: boolean;
  hasUnknown: boolean;
  items: ConditionEvaluationItem[];
}

export interface LimitOrder {
  id: string;
  userId: string;
  walletId: string;
  chainId: string;
  tokenIn: string;
  tokenOut: string;
  /**
   * The real mint address of the token being traded.
   *
   * `tokenIn`/`tokenOut` were display strings only ("SOL" / "SENT"), and
   * nothing in the system ever recorded which actual token an order was for
   * -- every order silently defaulted to a nonexistent "SENT" token
   * regardless of which token's trade page created it. This is what the
   * order is actually scoped and filtered by.
   */
  tokenMint: string;
  side: 'buy' | 'sell';
  targetPrice: number;
  amountIn: number;
  filledAmount: number;
  slippageBps: number;
  status: LimitOrderStatus;
  health: LimitOrderHealth;
  version: number;
  conditions: LimitOrderConditions;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  // Computed helpers for UI
  distancePct?: number; // e.g. -15.2%
}

export interface LimitOrderReservation {
  id: string;
  limitOrderId: string;
  walletId: string;
  token: string;
  amount: number;
  status: 'ACTIVE' | 'RELEASED' | 'CONSUMED';
  createdAt: string;
}

export interface LimitOrderVersion {
  id: string;
  limitOrderId: string;
  version: number;
  targetPrice: number;
  amountIn: number;
  conditionsSnapshot: LimitOrderConditions;
  createdAt: string;
}
