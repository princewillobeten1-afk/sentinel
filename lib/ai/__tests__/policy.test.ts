import { describe, expect, it } from 'vitest';
import { evaluateAiRecommendation, type AiRecommendation } from '../policy';

function buildRec(overrides: Partial<AiRecommendation> = {}): AiRecommendation {
  return {
    id: 'rec_1',
    kind: 'TRADE_SUGGESTION',
    summary: 'Consider taking profit on SENT.',
    confidence: 0.8,
    suggestedAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('evaluateAiRecommendation', () => {
  it('always requires human confirmation, even for a well-formed recommendation', () => {
    const decision = evaluateAiRecommendation(buildRec());
    expect(decision.requiresHumanConfirmation).toBe(true);
    expect(decision.allowed).toBe(true);
  });

  it('rejects an out-of-range confidence value', () => {
    const decision = evaluateAiRecommendation(buildRec({ confidence: 1.5 }));
    expect(decision.allowed).toBe(false);
    expect(decision.requiresHumanConfirmation).toBe(true);
  });

  it('rejects a negative confidence value', () => {
    const decision = evaluateAiRecommendation(buildRec({ confidence: -0.1 }));
    expect(decision.allowed).toBe(false);
    expect(decision.requiresHumanConfirmation).toBe(true);
  });

  it('every recommendation kind still requires human confirmation', () => {
    for (const kind of ['TRADE_SUGGESTION', 'RISK_FLAG', 'PORTFOLIO_ADVICE'] as const) {
      const decision = evaluateAiRecommendation(buildRec({ kind }));
      expect(decision.requiresHumanConfirmation).toBe(true);
    }
  });
});
