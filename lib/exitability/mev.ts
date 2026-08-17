/**
 * MEV / Sandwich Awareness (spec §38)
 *
 * Foundation only. We surface a risk level from observable factors — we never
 * promise complete MEV protection.
 */

import type { MevRisk, PoolState, TradeSide } from './types';
import { adapterForPool } from './amm';

export interface MevInput {
  pools: PoolState[];
  side: TradeSide;
  inputUsd: number;
  chain: string;
}

export function assessMevRisk(input: MevInput): MevRisk {
  const factors: string[] = [];
  let score = 10;

  const usable = input.pools.reduce(
    (total, pool) => total + adapterForPool(pool).usableLiquidityUsd(pool),
    0,
  );
  const depthRatio = usable > 0 ? input.inputUsd / usable : 1;

  if (depthRatio > 0.1) {
    score += 30;
    factors.push('Order is large relative to usable liquidity, increasing sandwich profitability.');
  } else if (depthRatio > 0.03) {
    score += 15;
    factors.push('Order is moderately sized relative to usable liquidity.');
  }

  if (usable > 0 && usable < 50_000) {
    score += 25;
    factors.push('Thin liquidity makes price manipulation around the trade cheaper.');
  }

  if (input.pools.length === 1) {
    score += 10;
    factors.push('Single-pool routing offers no path diversity to mitigate MEV.');
  }

  if (input.chain === 'solana') {
    // Solana's leader-based ordering differs from public mempools; note it.
    factors.push('Chain uses leader-based ordering; public mempool sandwiching differs from EVM.');
  }

  const level = score >= 55 ? 'HIGH' : score >= 30 ? 'MODERATE' : 'LOW';
  return { level, score: Math.min(100, Math.round(score)), factors };
}
