import { describe, it, expect } from 'vitest';
import { AnomalyExplainer } from '../anomaly-explainer';
import { AnomalyEvidence } from '../types';

describe('AI Anomaly Explainer Engine (Sprint 37 §19-20)', () => {
  it('identifies and explains statistically significant anomalies (>= 2.5 sigma)', () => {
    const evidenceList: AnomalyEvidence[] = [
      {
        metric: '24h_volume_surge',
        expectedBaseline: 150_000,
        observedValue: 850_000,
        standardDeviations: 4.2,
        sampleSize: 120,
      },
    ];

    const result = AnomalyExplainer.explainAnomaly(evidenceList);
    expect(result.anomalyDetected).toBe(true);
    expect(result.anomalyType).toBe('VOLUME_SPIKE');
    expect(result.severity).toBe('HIGH');
    expect(result.plainEnglishExplanation).toContain('volume surge');
    expect(result.statisticalSummary).toContain('4.2σ');
  });

  it('refuses to invent anomalies when metrics are within normal baseline (< 2.5 sigma)', () => {
    const evidenceList: AnomalyEvidence[] = [
      {
        metric: '24h_volume_surge',
        expectedBaseline: 150_000,
        observedValue: 165_000,
        standardDeviations: 0.8,
        sampleSize: 120,
      },
    ];

    const result = AnomalyExplainer.explainAnomaly(evidenceList);
    expect(result.anomalyDetected).toBe(false);
    expect(result.plainEnglishExplanation).toContain('No statistically actionable anomaly detected');
  });
});
