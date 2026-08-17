/**
 * Slippage Prediction Engine (spec §36, §37)
 *
 * Slippage risk is not static — it rises with order size relative to usable
 * depth and with recent volatility / quote instability.
 */

import type { PoolState, SlippageEstimate, TradeSide } from './types';
import { adapterForPool } from './amm';
import { clamp, evidence, round } from './utils';

export interface SlippageInput {
  pools: PoolState[];
  side: TradeSide;
  inputUsd: number;
  /** Recent price move magnitude as a fraction (e.g. 0.15 = 15%). */
  recentPriceVolatility?: number;
  observedAt: string;
}

export function estimateSlippage(input: SlippageInput): SlippageEstimate {
  const usable = input.pools.reduce(
    (total, pool) => total + adapterForPool(pool).usableLiquidityUsd(pool),
    0,
  );
  const bestImpact = input.pools.length
    ? Math.min(
        ...input.pools.map((pool) => adapterForPool(pool).estimateImpact(pool, input.side, input.inputUsd)),
      )
    : 99;

  // Base slippage tracks price impact but adds a depth-scaled buffer: the more
  // of the pool an order consumes, the more execution can drift from the quote.
  const depthRatio = usable > 0 ? input.inputUsd / usable : 1;
  const depthBuffer = clamp(depthRatio * 100 * 0.25, 0, 40);

  const volatility = input.recentPriceVolatility ?? 0;
  const volatilityAdjustmentPct = round(volatility * 100 * 0.5, 2);

  const expectedSlippagePct = round(clamp(bestImpact + depthBuffer, 0, 99), 2);
  const worstCaseSlippagePct = round(
    clamp(expectedSlippagePct + volatilityAdjustmentPct + depthBuffer * 0.5, 0, 99),
    2,
  );

  let confidence = 0.85;
  if (usable <= 0) confidence = 0.3;
  if (volatility > 0.2) confidence -= 0.15;
  if (depthRatio > 0.5) confidence -= 0.1;

  return {
    expectedSlippagePct,
    worstCaseSlippagePct,
    confidence: round(clamp(confidence, 0, 1), 2),
    volatilityAdjustmentPct,
    evidence: [
      evidence(
        `Estimated slippage ${expectedSlippagePct}% for a ${input.side.toLowerCase()} of $${round(input.inputUsd, 2)} (worst case ${worstCaseSlippagePct}% under recent volatility)`,
        'slippage_model',
        input.observedAt,
        expectedSlippagePct,
        round(clamp(confidence, 0, 1), 2),
      ),
    ],
  };
}
