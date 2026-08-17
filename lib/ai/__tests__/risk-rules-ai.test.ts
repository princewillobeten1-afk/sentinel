import { describe, it, expect } from 'vitest';
import { PersonalizedRiskEngine } from '../risk-rules-ai';
import { EvidenceBuilder } from '../evidence-builder';

describe('Personalized Risk Profiles & NL Rule Engine (Sprint 37 §25-29)', () => {
  it('detects violations against Conservative risk profile', () => {
    const conservativeProfile = PersonalizedRiskEngine.getProfileParameters('CONSERVATIVE');
    const riskyEvidence = EvidenceBuilder.buildEvidencePackage({
      tokenAddress: 'RiskyToken111111111111111111111111111111111',
      exitability: { exitabilityScore: 42 },
      holders: { top10HoldersPct: 55.0 },
    });

    const evalResult = PersonalizedRiskEngine.evaluateAssetAgainstProfile(riskyEvidence, conservativeProfile);
    expect(evalResult.passes).toBe(false);
    expect(evalResult.violations.length).toBeGreaterThanOrEqual(2);
    expect(evalResult.violations.some((v) => v.includes('Exitability'))).toBe(true);
  });

  it('translates natural language alert rules into deterministic trigger conditions', () => {
    const rule1 = 'Tell me when a token I am holding has a 25% liquidity drop';
    const cond1 = PersonalizedRiskEngine.translateAlertRule(rule1);
    expect(cond1.metric).toBe('liquidity_drop');
    expect(cond1.thresholdPct).toBe(25);
    expect(cond1.triggerEvent).toBe('pool_liquidity_change_24h <= -25%');

    const rule2 = 'Alert me if exitability falls below 40';
    const cond2 = PersonalizedRiskEngine.translateAlertRule(rule2);
    expect(cond2.metric).toBe('exitability_drop');
    expect(cond2.thresholdScore).toBe(40);
  });
});
