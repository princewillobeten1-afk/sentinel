import { describe, it, expect } from 'vitest';
import { evaluateRiskRules, getRiskRules } from '../risk-rules';
import type { RiskCategory, RiskDimension } from '../types';

const now = new Date().toISOString();

describe('Risk Rule Engine', () => {
  it('loads all defined risk rules', () => {
    const rules = getRiskRules();
    expect(rules.length).toBeGreaterThanOrEqual(8);
  });

  it('evaluates cross-dimension fragile market rule when low activity + low liquidity occur', () => {
    const mockDimensions: Partial<Record<RiskCategory, RiskDimension>> = {
      MARKET: {
        category: 'MARKET',
        score: 30,
        level: 'ELEVATED',
        confidence: 0.9,
        evidence: [],
        signals: [{
          id: 's1', type: 'LOW_ACTIVITY', category: 'MARKET', severity: 'LOW', polarity: 'NEGATIVE',
          value: 10, confidence: 0.9, evidence: [], observedAt: now, methodologyVersion: 'v1', metadata: {},
        }],
        lastUpdated: now,
      },
      LIQUIDITY: {
        category: 'LIQUIDITY',
        score: 25,
        level: 'ELEVATED',
        confidence: 0.9,
        evidence: [],
        signals: [{
          id: 's2', type: 'LOW_LIQUIDITY', category: 'LIQUIDITY', severity: 'MEDIUM', polarity: 'NEGATIVE',
          value: 5000, confidence: 0.9, evidence: [], observedAt: now, methodologyVersion: 'v1', metadata: {},
        }],
        lastUpdated: now,
      },
    };

    const ruleSignals = evaluateRiskRules(mockDimensions);
    expect(ruleSignals.some(s => s.type === 'FRAGILE_MARKET')).toBe(true);
  });

  it('evaluates full authority control rule when mint and freeze are active', () => {
    const mockDimensions: Partial<Record<RiskCategory, RiskDimension>> = {
      CONTRACT: {
        category: 'CONTRACT',
        score: 40,
        level: 'ELEVATED',
        confidence: 0.9,
        evidence: [],
        signals: [
          { id: 'c1', type: 'MINT_AUTHORITY_ACTIVE', category: 'CONTRACT', severity: 'INFO', polarity: 'NEUTRAL', value: 'Active', confidence: 0.9, evidence: [], observedAt: now, methodologyVersion: 'v1', metadata: {} },
          { id: 'c2', type: 'FREEZE_AUTHORITY_ACTIVE', category: 'CONTRACT', severity: 'LOW', polarity: 'NEUTRAL', value: 'Active', confidence: 0.9, evidence: [], observedAt: now, methodologyVersion: 'v1', metadata: {} },
        ],
        lastUpdated: now,
      },
    };

    const ruleSignals = evaluateRiskRules(mockDimensions);
    expect(ruleSignals.some(s => s.type === 'FULL_AUTHORITY_CONTROL')).toBe(true);
  });

  it('evaluates fully autonomous rule when mint and freeze are revoked', () => {
    const mockDimensions: Partial<Record<RiskCategory, RiskDimension>> = {
      CONTRACT: {
        category: 'CONTRACT',
        score: 85,
        level: 'STRONG',
        confidence: 0.95,
        evidence: [],
        signals: [
          { id: 'c1', type: 'MINT_AUTHORITY_REVOKED', category: 'CONTRACT', severity: 'INFO', polarity: 'POSITIVE', value: 'Revoked', confidence: 0.95, evidence: [], observedAt: now, methodologyVersion: 'v1', metadata: {} },
          { id: 'c2', type: 'FREEZE_AUTHORITY_REVOKED', category: 'CONTRACT', severity: 'INFO', polarity: 'POSITIVE', value: 'Revoked', confidence: 0.95, evidence: [], observedAt: now, methodologyVersion: 'v1', metadata: {} },
        ],
        lastUpdated: now,
      },
    };

    const ruleSignals = evaluateRiskRules(mockDimensions);
    expect(ruleSignals.some(s => s.type === 'FULLY_AUTONOMOUS')).toBe(true);
  });
});
