import { describe, it, expect } from 'vitest';
import {
  AiExplainabilityEngine,
  CURRENT_AI_MODEL_VERSION,
  CURRENT_PROMPT_VERSION,
} from '../explainability';

describe('AI Reliability, Model Versioning & Fact Explainability', () => {
  it('generates an explainable risk assessment separating verified facts from AI interpretations', () => {
    const assessment = AiExplainabilityEngine.generateAssessment({
      tokenMint: 'So11111111111111111111111111111111111111112',
      verifiedFacts: [
        {
          factId: 'f1',
          category: 'CREATOR_ACTIVITY',
          statement: 'Creator wallet sold 45% of allocated supply.',
          slot: 289104100,
          timestamp: new Date().toISOString(),
        },
        {
          factId: 'f2',
          category: 'LIQUIDITY_LOCK',
          statement: 'Pool liquidity is locked for 180 days.',
          slot: 289104050,
          timestamp: new Date().toISOString(),
        },
      ],
      isModelAvailable: true,
    });

    expect(assessment.available).toBe(true);
    expect(assessment.modelVersion).toBe(CURRENT_AI_MODEL_VERSION);
    expect(assessment.promptVersion).toBe(CURRENT_PROMPT_VERSION);
    expect(assessment.verifiedFacts.length).toBe(2);
    expect(assessment.aiInterpretations.contributingFactors.length).toBe(2);

    const warningFactor = assessment.aiInterpretations.contributingFactors.find((f) => f.type === 'WARNING');
    expect(warningFactor).toBeDefined();
    expect(warningFactor?.summary).toContain('Creator high-volume selloff');

    const positiveFactor = assessment.aiInterpretations.contributingFactors.find((f) => f.type === 'POSITIVE');
    expect(positiveFactor).toBeDefined();
    expect(positiveFactor?.summary).toContain('Liquidity is locked');
  });

  it('handles AI model unavailability without fabricating results', () => {
    const assessment = AiExplainabilityEngine.generateAssessment({
      tokenMint: 'So11111111111111111111111111111111111111112',
      verifiedFacts: [
        {
          factId: 'f1',
          category: 'MINT_AUTHORITY',
          statement: 'Mint authority revoked.',
          timestamp: new Date().toISOString(),
        },
      ],
      isModelAvailable: false, // Model unavailable!
    });

    expect(assessment.available).toBe(false);
    expect(assessment.confidencePct).toBe(0);
    expect(assessment.unavailableReason).toBe('AI Model Service Offline');
    expect(assessment.aiInterpretations.assessmentSummary).toContain('AI analysis unavailable');
    expect(assessment.verifiedFacts.length).toBe(1); // Verified facts preserved!
  });
});
