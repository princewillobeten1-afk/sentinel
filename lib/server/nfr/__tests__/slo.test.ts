import { describe, it, expect, beforeEach } from 'vitest';
import {
  SLO_TARGETS,
  recordServiceSample,
  computeServiceSli,
  computePlatformSloOverview,
  resetSliState,
} from '../slo';

describe('Service-Level Objectives (SLO) & SLI Telemetry', () => {
  beforeEach(() => {
    resetSliState();
  });

  it('defines targets for all critical and non-critical services', () => {
    expect(SLO_TARGETS.authentication.availabilityTarget).toBe(0.9999);
    expect(SLO_TARGETS.trading_api.availabilityTarget).toBe(0.9999);
    expect(SLO_TARGETS.market_data.availabilityTarget).toBe(0.9999);
    expect(SLO_TARGETS.portfolio.availabilityTarget).toBe(0.9995);
    expect(SLO_TARGETS.discovery.availabilityTarget).toBe(0.9995);
    expect(SLO_TARGETS.intelligence.availabilityTarget).toBe(0.999);
    expect(SLO_TARGETS.analytics.availabilityTarget).toBe(0.995);
  });

  it('returns perfect baseline when no samples recorded in window', () => {
    const report = computeServiceSli('trading_api', 3600_000);
    expect(report.currentAvailability).toBe(1.0);
    expect(report.sloMet).toBe(true);
    expect(report.totalRequests).toBe(0);
    expect(report.failedRequests).toBe(0);
  });

  it('computes availability, latencies, and error budget burn rate correctly', () => {
    const now = Date.now();

    // Record 99 successful samples and 1 failed sample for analytics (target 99.5%)
    for (let i = 0; i < 99; i++) {
      recordServiceSample({
        service: 'analytics',
        timestamp: now - 1000 * i,
        success: true,
        latencyMs: 50 + (i % 20),
      });
    }

    recordServiceSample({
      service: 'analytics',
      timestamp: now - 500,
      success: false,
      latencyMs: 1500,
      errorCode: 'TIMEOUT',
    });

    const report = computeServiceSli('analytics', 3600_000, now);
    expect(report.totalRequests).toBe(100);
    expect(report.successfulRequests).toBe(99);
    expect(report.failedRequests).toBe(1);
    expect(report.currentAvailability).toBe(0.99); // 99%
    expect(report.sloMet).toBe(false); // 99% is below 99.5% target
    expect(report.errorBudgetBurnRate).toBeGreaterThan(1.0); // burning faster than budget
  });

  it('evaluates platform-wide SLO compliance overview', () => {
    const overview = computePlatformSloOverview();
    expect(overview.services.authentication).toBeDefined();
    expect(overview.services.trading_api).toBeDefined();
    expect(overview.services.market_data).toBeDefined();
    expect(overview.allSloMet).toBe(true);
    expect(overview.criticalSloMet).toBe(true);
  });
});
