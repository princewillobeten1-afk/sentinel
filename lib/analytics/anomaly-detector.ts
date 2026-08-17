/**
 * Statistical Anomaly Detection Engine (Sprint 38 §43-44).
 *
 * Compares live metric feeds against rolling historical statistical baselines.
 * Calculates standard deviation z-scores ($z = \frac{X - \mu}{\sigma}$) to detect:
 *   - Volume Surges
 *   - Liquidity Drains
 *   - Sudden Holder Spikes
 *   - Abnormal Creator Balance Dumps
 */

import { StatisticalAnomalyEvent } from './types';

export interface RollingMetricBaseline {
  metricName: StatisticalAnomalyEvent['metric'];
  mean: number; // mu
  standardDeviation: number; // sigma
  sampleSize: number;
}

export class StatisticalAnomalyDetector {
  /**
   * Evaluates an observed metric against its rolling statistical baseline.
   */
  public static evaluateMetric(params: {
    tokenAddress: string;
    metric: StatisticalAnomalyEvent['metric'];
    observedValue: number;
    baseline: RollingMetricBaseline;
  }): StatisticalAnomalyEvent | null {
    const { tokenAddress, metric, observedValue, baseline } = params;

    if (baseline.standardDeviation <= 0 || baseline.sampleSize < 10) {
      return null; // Insufficient statistical power
    }

    const zScore = Number(((observedValue - baseline.mean) / baseline.standardDeviation).toFixed(2));
    const absZ = Math.abs(zScore);

    // Only flag statistically significant anomalies (|z| >= 2.5 sigma)
    if (absZ < 2.5) {
      return null;
    }

    const deviationPct = Number((((observedValue - baseline.mean) / baseline.mean) * 100).toFixed(1));

    let severity: StatisticalAnomalyEvent['severity'] = 'WATCH';
    if (absZ >= 4.5 || (metric === 'LIQUIDITY' && zScore <= -3.0)) {
      severity = 'CRITICAL';
    } else if (absZ >= 3.5) {
      severity = 'HIGH';
    } else if (absZ >= 2.5) {
      severity = 'WARNING';
    }

    return {
      id: `anom_${metric.toLowerCase()}_${Date.now().toString(36)}`,
      tokenAddress,
      metric,
      observedValue,
      baselineValue: baseline.mean,
      zScore,
      sampleSize: baseline.sampleSize,
      deviationPct,
      detectedAt: new Date().toISOString(),
      severity,
    };
  }
}
