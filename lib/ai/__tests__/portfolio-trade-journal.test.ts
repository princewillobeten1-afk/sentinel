import { describe, it, expect } from 'vitest';
import { PortfolioAiAnalyst } from '../portfolio-analyst';
import { TradeJournalEngine } from '../trade-journal';

describe('Portfolio Analyst & Post-Trade Journal (Sprint 37 §63-66)', () => {
  it('analyzes portfolio risk and calculates low-liquidity exposure percentage', () => {
    const positions = [
      {
        tokenAddress: 'TokenA111111111111111111111111111111111',
        symbol: 'ABC',
        valueUsd: 5000,
        allocationPct: 50,
        liquidityUsd: 25_000, // < $50k low liquidity
        exitabilityScore: 35,
        hasLiquidityDrainWarning: true,
      },
      {
        tokenAddress: 'TokenB222222222222222222222222222222222',
        symbol: 'SOL',
        valueUsd: 5000,
        allocationPct: 50,
        liquidityUsd: 10_000_000,
        exitabilityScore: 98,
        hasLiquidityDrainWarning: false,
      },
    ];

    const analysis = PortfolioAiAnalyst.analyzePortfolio(positions);
    expect(analysis.portfolioRiskRating).toBe('HIGH');
    expect(analysis.lowLiquidityExposurePct).toBe(50);
    expect(analysis.deterioratingExitabilityCount).toBe(1);
    expect(analysis.topRiskContributors[0].symbol).toBe('ABC');
  });

  it('generates post-trade review with net P&L and actionable improvements', () => {
    const review = TradeJournalEngine.reviewTrade({
      tradeId: 'tr_123',
      tokenSymbol: 'MEME',
      entryPriceUsd: 0.002,
      exitPriceUsd: 0.0025,
      positionSizeUsd: 1000,
      feesPaidUsd: 15,
      holdDurationMinutes: 45,
      entryOrganicVolumePct: 75,
      exitExitabilityScore: 38,
      hadLiquidityDropDuringHold: true,
    });

    expect(review.tradeId).toBe('tr_123');
    expect(review.pnlPct).toBe(25);
    expect(review.netPnlUsd).toBe(235); // (0.25 * 1000) - 15
    expect(review.whatWentWell.some((w) => w.includes('organic volume'))).toBe(true);
    expect(review.whatCouldImprove.some((w) => w.includes('liquidity reduction'))).toBe(true);
  });
});
