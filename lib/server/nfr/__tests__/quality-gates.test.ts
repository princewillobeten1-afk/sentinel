import { describe, it, expect } from 'vitest';
import {
  evaluateServiceQuality,
  evaluatePlatformQualityGates,
} from '../quality-gates';
import { getServiceQualityProfile } from '../quality-matrix';

describe('Production Quality Gate & Weighted Score Engine', () => {
  it('computes 100/100 score for a service satisfying all 8 quality pillars', () => {
    const profile = getServiceQualityProfile('trading_execution')!;
    const evaluation = evaluateServiceQuality(profile, {
      sloMet: true,
      hasAuth: true,
      hasAuditLog: true,
      hasAutomatedTests: true,
      hasCircuitBreaker: true,
      hasRunbook: true,
      hasMetrics: true,
      hasA11y: true,
    });

    expect(evaluation.overallScore).toBe(100);
    expect(evaluation.passedReleaseGate).toBe(true);
    expect(evaluation.blockers.length).toBe(0);
  });

  it('blocks production release if security is missing on a P0 financial service', () => {
    const profile = getServiceQualityProfile('trading_execution')!;
    const evaluation = evaluateServiceQuality(profile, {
      hasAuth: false, // Security failure
      sloMet: true,
      hasAuditLog: true,
      hasAutomatedTests: true,
      hasCircuitBreaker: true,
      hasRunbook: true,
      hasMetrics: true,
      hasA11y: true,
    });

    expect(evaluation.passedReleaseGate).toBe(false);
    expect(evaluation.blockers).toContain('Security requirements (authentication/authorization) not satisfied.');
  });

  it('evaluates platform-wide readiness gates across all subsystems', async () => {
    const report = await evaluatePlatformQualityGates();
    expect(report.platformQualityScore).toBeGreaterThanOrEqual(90);
    expect(report.passedReleaseGate).toBe(true);
    expect(report.evaluatedServicesCount).toBeGreaterThanOrEqual(10);
    expect(report.failingServicesCount).toBe(0);
  });
});
