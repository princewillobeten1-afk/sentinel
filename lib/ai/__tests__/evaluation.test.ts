import { describe, it, expect } from 'vitest';
import { EvaluationEngine } from '../evaluation-engine';

describe('AI Evaluation Engine & Golden Dataset Benchmarks (Sprint 37 §47-50, §76)', () => {
  it('executes golden evaluation suite and produces KPI scorecard', async () => {
    const results = await EvaluationEngine.runEvaluationSuite();

    expect(results.totalCases).toBeGreaterThanOrEqual(3);
    expect(results.passedCases).toBe(results.totalCases);
    expect(results.averageGroundingScore).toBeGreaterThanOrEqual(0.85);
    expect(results.hallucinationRatePct).toBe(0);
    expect(results.status).toBe('PASSED');
  });

  it('provides access to golden cases catalog', () => {
    const cases = EvaluationEngine.getGoldenCases();
    expect(cases.length).toBeGreaterThanOrEqual(3);
    expect(cases.some((c) => c.category === 'KNOWN_SAFE')).toBe(true);
    expect(cases.some((c) => c.category === 'KNOWN_LIQUIDITY_DRAIN')).toBe(true);
  });
});
