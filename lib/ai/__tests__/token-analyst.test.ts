import { describe, it, expect } from 'vitest';
import { TokenAiAnalyst } from '../token-analyst';
import { EvidenceBuilder } from '../evidence-builder';

describe('Token AI Analyst & Structured Report Generator (Sprint 37 §7-15, §60-62)', () => {
  const evidence = EvidenceBuilder.buildEvidencePackage({
    tokenAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'ABC',
    name: 'Alpha Beta Coin',
    liquidity: { totalLiquidityUsd: 420_000, liquidityChange24hPct: -31.0 },
    holders: { top10HoldersPct: 47.0, creatorLinkedWalletsPct: 8.4 },
    exitability: { exitabilityScore: 41, maxSafeSellSizeUsd: 3500 },
  });

  it('generates structured 12-section report with why-risky bullets and main concern', () => {
    const report = TokenAiAnalyst.generateReport(evidence, 'ADVANCED');

    expect(report.tokenAddress).toBe('So11111111111111111111111111111111111111112');
    expect(report.overallRisk).toBe('HIGH');
    expect(report.whyRiskyBullets.length).toBeGreaterThan(0);
    expect(report.mainConcern).toBeDefined();
    expect(report.sections.tokenOverview).toBeDefined();
    expect(report.sections.liquidity).toContain('$420,000');
    expect(report.sections.ownership).toContain('47%');
    expect(report.sections.exitability).toContain('41/100');
    expect(report.sections.whatToWatch.length).toBeGreaterThanOrEqual(3);
  });

  it('adapts explanation depth according to persona mode', () => {
    const beginnerReport = TokenAiAnalyst.generateReport(evidence, 'BEGINNER');
    expect(beginnerReport.sections.liquidity).toContain('Liquidity is the amount of money available');

    const quantReport = TokenAiAnalyst.generateReport(evidence, 'QUANT');
    expect(quantReport.sections.liquidity).toContain('Pool Depth:');
  });

  it('answers direct trader questions with evidence citations', async () => {
    const answer = await TokenAiAnalyst.answerTraderQuestion(
      'Is there anything suspicious here?',
      evidence
    );

    expect(answer.summary).toBeDefined();
    expect(answer.overallRiskLevel).toBe('HIGH');
    expect(answer.confidence).toBe('HIGH');
  });
});
