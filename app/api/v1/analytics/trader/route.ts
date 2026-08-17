import { NextResponse } from 'next/server';
import { TraderSelfAnalyticsEngine } from '@/lib/analytics';

export async function GET() {
  const mockTraderAnalytics = TraderSelfAnalyticsEngine.analyzeTrader({
    userId: 'user_sentinel_primary',
    trades: [
      {
        tradeId: 'tr_001',
        tokenMint: 'TokenSol1',
        entryTimestamp: Date.now() - 3600000 * 2,
        exitTimestamp: Date.now() - 3600000 * 1.5,
        poolCreationTimestamp: Date.now() - 3600000 * 2.1,
        tokenExitabilityScoreAtEntry: 82,
        pnlBreakdown: {
          tradeId: 'tr_001',
          tokenSymbol: 'SOLX',
          grossProfitUsd: 1250,
          dexTradingFeesUsd: 25,
          networkGasFeesUsd: 0.85,
          slippageCostUsd: 35,
          priceImpactCostUsd: 45,
          totalFrictionCostsUsd: 105.85,
          netPnlUsd: 1144.15,
          netPnlPct: 22.8,
          realizedAt: new Date().toISOString(),
        },
      },
      {
        tradeId: 'tr_002',
        tokenMint: 'TokenSol2',
        entryTimestamp: Date.now() - 3600000 * 5,
        exitTimestamp: Date.now() - 3600000 * 4,
        poolCreationTimestamp: Date.now() - 3600000 * 5.05,
        tokenExitabilityScoreAtEntry: 38,
        pnlBreakdown: {
          tradeId: 'tr_002',
          tokenSymbol: 'MEME',
          grossProfitUsd: -450,
          dexTradingFeesUsd: 15,
          networkGasFeesUsd: 0.85,
          slippageCostUsd: 65,
          priceImpactCostUsd: 80,
          totalFrictionCostsUsd: 160.85,
          netPnlUsd: -610.85,
          netPnlPct: -30.5,
          realizedAt: new Date().toISOString(),
        },
      },
    ],
  });

  return NextResponse.json({
    traderSelfAnalytics: mockTraderAnalytics,
    timestamp: new Date().toISOString(),
  });
}
