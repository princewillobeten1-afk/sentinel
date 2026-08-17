import { describe, it, expect } from 'vitest';
import { TraderSelfAnalyticsEngine } from '../trader-self-analytics';

describe('Trader Behavioral Self-Analytics (Sprint 38 §36-37)', () => {
  it('diagnoses trading patterns, entry timing, and loss sources from historical trade record', () => {
    const analysis = TraderSelfAnalyticsEngine.analyzeTrader({
      userId: 'trader_user_42',
      trades: [
        {
          tradeId: 't1',
          tokenMint: 'MintGood',
          entryTimestamp: 1000000 + 120000,
          exitTimestamp: 1000000 + 1800000,
          poolCreationTimestamp: 1000000,
          tokenExitabilityScoreAtEntry: 85,
          pnlBreakdown: {
            tradeId: 't1',
            tokenSymbol: 'GOOD',
            grossProfitUsd: 1500,
            dexTradingFeesUsd: 25,
            networkGasFeesUsd: 0.85,
            slippageCostUsd: 30,
            priceImpactCostUsd: 40,
            totalFrictionCostsUsd: 95.85,
            netPnlUsd: 1404.15,
            netPnlPct: 28.0,
            realizedAt: new Date().toISOString(),
          },
        },
        {
          tradeId: 't2',
          tokenMint: 'MintBadTrap',
          entryTimestamp: 2000000 + 60000,
          exitTimestamp: 2000000 + 900000,
          poolCreationTimestamp: 2000000,
          tokenExitabilityScoreAtEntry: 30, // Low exitability trap
          pnlBreakdown: {
            tradeId: 't2',
            tokenSymbol: 'BAD',
            grossProfitUsd: -800,
            dexTradingFeesUsd: 20,
            networkGasFeesUsd: 0.85,
            slippageCostUsd: 80,
            priceImpactCostUsd: 120,
            totalFrictionCostsUsd: 220.85,
            netPnlUsd: -1020.85,
            netPnlPct: -35.0,
            realizedAt: new Date().toISOString(),
          },
        },
      ],
    });

    expect(analysis.totalTradesExecuted).toBe(2);
    expect(analysis.winRatePct).toBe(50);
    expect(analysis.lossAttribution.lowExitabilityTrapsPct).toBeGreaterThan(0);
    expect(analysis.behavioralHabitObservations.length).toBeGreaterThan(0);
  });
});
