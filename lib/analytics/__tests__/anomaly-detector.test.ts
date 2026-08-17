import { describe, it, expect } from 'vitest';
import { StatisticalAnomalyDetector } from '../anomaly-detector';

describe('Statistical Anomaly Detector (Sprint 38 §43-44)', () => {
  it('detects a high volume anomaly when observed volume deviates by >= 2.5 sigma from baseline', () => {
    const anomaly = StatisticalAnomalyDetector.evaluateMetric({
      tokenAddress: 'TokenAnomalyTest',
      metric: 'VOLUME',
      observedValue: 1_800_000,
      baseline: {
        metricName: 'VOLUME',
        mean: 210_000,
        standardDeviation: 150_000,
        sampleSize: 100,
      },
    });

    expect(anomaly).not.toBeNull();
    expect(anomaly?.zScore).toBeGreaterThanOrEqual(2.5);
    expect(anomaly?.severity).toBe('CRITICAL');
    expect(anomaly?.deviationPct).toBeGreaterThan(500);
  });

  it('returns null when metric is within normal statistical distribution (< 2.5 sigma)', () => {
    const normal = StatisticalAnomalyDetector.evaluateMetric({
      tokenAddress: 'TokenNormalTest',
      metric: 'VOLUME',
      observedValue: 250_000,
      baseline: {
        metricName: 'VOLUME',
        mean: 210_000,
        standardDeviation: 50_000,
        sampleSize: 100,
      },
    });

    expect(normal).toBeNull();
  });
});
