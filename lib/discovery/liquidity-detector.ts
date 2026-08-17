export type LiquidityEventType =
  | 'ADDITION'
  | 'NORMAL_GROWTH'
  | 'STABLE'
  | 'CONTRACTION'
  | 'RAPID_WITHDRAWAL';

export interface LiquidityChangeInput {
  currentLiquidityUsd: number;
  previousLiquidityUsd: number;
  liquidityChange1hPct: number;
}

export interface LiquidityChangeResult {
  changePct: number;
  eventType: LiquidityEventType;
  riskSeverity: 'low' | 'med' | 'high' | 'critical';
  formattedChange: string;
  isRapidWithdrawal: boolean;
  explanation: string;
}

/**
 * Liquidity Change Detector — Detects additions, contractions, and rapid liquidity withdrawals.
 */
export function detectLiquidityChanges(input: LiquidityChangeInput): LiquidityChangeResult {
  const changePct = input.liquidityChange1hPct;

  let eventType: LiquidityEventType = 'STABLE';
  let riskSeverity: LiquidityChangeResult['riskSeverity'] = 'low';
  let isRapidWithdrawal = false;

  if (changePct >= 50.0) {
    eventType = 'ADDITION';
    riskSeverity = 'low';
  } else if (changePct > 5.0) {
    eventType = 'NORMAL_GROWTH';
    riskSeverity = 'low';
  } else if (changePct >= -10.0) {
    eventType = 'STABLE';
    riskSeverity = 'low';
  } else if (changePct >= -30.0) {
    eventType = 'CONTRACTION';
    riskSeverity = 'med';
  } else {
    eventType = 'RAPID_WITHDRAWAL';
    riskSeverity = 'critical';
    isRapidWithdrawal = true;
  }

  const sign = changePct >= 0 ? '+' : '';
  const formattedChange = `Liquidity ${sign}${changePct.toFixed(1)}%`;

  let explanation = `${formattedChange} in last 1h`;
  if (isRapidWithdrawal) {
    explanation = `RAPID LIQUIDITY WITHDRAWAL WARNING: Pool liquidity dropped ${Math.abs(changePct).toFixed(1)}%`;
  } else if (eventType === 'ADDITION') {
    explanation = `Major liquidity injection: Depth expanded ${formattedChange}`;
  }

  return {
    changePct: Number(changePct.toFixed(1)),
    eventType,
    riskSeverity,
    formattedChange,
    isRapidWithdrawal,
    explanation,
  };
}
