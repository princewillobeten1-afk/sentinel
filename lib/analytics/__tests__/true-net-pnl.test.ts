import { describe, it, expect } from 'vitest';
import { TrueNetPnlEngine } from '../true-net-pnl';

describe('True Net P&L & Friction Attribution Engine (Sprint 38 §32-33)', () => {
  it('deducts DEX swap fees, gas fees, slippage, and price impact from gross profit', () => {
    const result = TrueNetPnlEngine.calculateTrueNetPnl({
      tradeId: 'trade_101',
      tokenSymbol: 'SOLX',
      entryPriceUsd: 1.0,
      exitPriceUsd: 1.25, // +25% gross price gain
      positionSizeUsd: 10000,
      dexFeeBps: 25, // 0.25% each side = $50 total
      networkGasSol: 0.0001,
      solPriceUsd: 150,
      realizedSlippagePct: 0.8, // $80
      realizedPriceImpactPct: 1.2, // $120
    });

    expect(result.grossProfitUsd).toBe(2500); // 25% of $10,000
    expect(result.totalFrictionCostsUsd).toBeGreaterThan(200);
    expect(result.netPnlUsd).toBeLessThan(result.grossProfitUsd);
    expect(result.netPnlUsd).toBe(result.grossProfitUsd - result.totalFrictionCostsUsd);
  });
});
