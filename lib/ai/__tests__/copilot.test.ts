import { describe, it, expect } from 'vitest';
import { TraderCopilot } from '../copilot';
import { EvidenceBuilder } from '../evidence-builder';

describe('Trader Copilot, Trade Check & Discovery Search (Sprint 37 §21-24, §30-31)', () => {
  const evidence = EvidenceBuilder.buildEvidencePackage({
    tokenAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'ABC',
    liquidity: { totalLiquidityUsd: 100_000, liquidityChange24hPct: -25.0 },
    exitability: { exitabilityScore: 42 },
    holders: { top10HoldersPct: 48.0 },
  });

  it('performs advisory pre-trade check and strictly requires human confirmation', () => {
    const result = TraderCopilot.evaluateTradeCheck(
      {
        tokenAddress: 'So11111111111111111111111111111111111111112',
        tradeType: 'BUY',
        orderSizeUsd: 500,
        maxSlippagePct: 3.0,
        userProfile: 'CONSERVATIVE',
      },
      evidence
    );

    expect(result.riskLevel).toBe('HIGH');
    expect(result.exitabilityScore).toBe(42);
    expect(result.conflictsWithPersonalRule).toBe(true);
    expect(result.requiresExplicitConfirmation).toBe(true); // Structural safety guarantee
  });

  it('translates natural language search queries into deterministic database filters', () => {
    const query = 'Find newly launched tokens with growing organic volume, low insider concentration and at least $100k liquidity';
    const translation = TraderCopilot.translateSearchQuery(query);

    expect(translation.filters.minLiquidityUsd).toBe(100_000);
    expect(translation.filters.maxAgeHours).toBe(24);
    expect(translation.filters.minOrganicVolumePct).toBe(60);
    expect(translation.filters.maxInsiderConcentrationPct).toBe(30);
    expect(translation.confidence).toBe('HIGH');
  });

  it('handles contextual queries using screen context', async () => {
    const res = await TraderCopilot.handleContextualQuery({
      query: 'Why is this token risky?',
      context: { activePage: 'trade', activeTokenAddress: 'So11111111111111111111111111111111111111112' },
      evidenceOverride: evidence,
    });

    expect(res.summary).toBeDefined();
    expect(res.overallRiskLevel).toBe('HIGH');
  });
});
