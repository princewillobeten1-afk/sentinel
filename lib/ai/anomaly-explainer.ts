/**
 * AI Statistical Anomaly Synthesizer (Sprint 37 §19-20).
 *
 * Consumes measurable statistical anomaly metrics and translates them
 * into human-readable explanations.
 *
 * SAFETY MANDATE (§20):
 *   AI MUST NOT invent anomalies without underlying statistical deviation evidence
 *   (e.g., standard deviations > 2.5 sigma from rolling baseline).
 */

import { AnomalyEvidence, AnomalyExplanation } from './types';

export class AnomalyExplainer {
  /**
   * Evaluates anomaly evidence and constructs a grounded plain-English synthesis.
   */
  public static explainAnomaly(evidenceList: AnomalyEvidence[]): AnomalyExplanation {
    if (!evidenceList || evidenceList.length === 0) {
      return {
        anomalyDetected: false,
        severity: 'INFO',
        evidence: [],
        statisticalSummary: 'All observed metrics are within normal baseline distributions (< 2.0σ).',
        plainEnglishExplanation: 'Trading patterns and liquidity metrics are consistent with standard historical parameters. No statistical anomalies identified.',
        confidence: 'HIGH',
      };
    }

    // Filter for meaningful deviations (>= 2.5 sigma)
    const significantDeviations = evidenceList.filter((e) => Math.abs(e.standardDeviations) >= 2.5);

    if (significantDeviations.length === 0) {
      return {
        anomalyDetected: false,
        severity: 'INFO',
        evidence: evidenceList,
        statisticalSummary: 'Deviations observed are minor (under 2.5 standard deviations).',
        plainEnglishExplanation: 'Fluctuations are within normal variance thresholds. No statistically actionable anomaly detected.',
        confidence: 'HIGH',
      };
    }

    // Identify primary anomaly category
    const primary = significantDeviations[0];
    let anomalyType: AnomalyExplanation['anomalyType'] = 'VOLUME_SPIKE';
    let severity: AnomalyExplanation['severity'] = 'WATCH';

    if (primary.metric.toLowerCase().includes('volume')) {
      anomalyType = 'VOLUME_SPIKE';
      severity = primary.standardDeviations > 4.0 ? 'HIGH' : 'WARNING';
    } else if (primary.metric.toLowerCase().includes('liquidity') || primary.metric.toLowerCase().includes('pool')) {
      anomalyType = 'LIQUIDITY_DRAIN';
      severity = 'CRITICAL';
    } else if (primary.metric.toLowerCase().includes('holder') || primary.metric.toLowerCase().includes('cluster')) {
      anomalyType = 'INSIDER_ACCUMULATION';
      severity = 'HIGH';
    }

    const statisticalSummary = `Metric '${primary.metric}' observed at ${primary.observedValue} (${primary.standardDeviations.toFixed(1)}σ deviation from baseline ${primary.expectedBaseline}, N=${primary.sampleSize}).`;

    const plainEnglishExplanation =
      anomalyType === 'VOLUME_SPIKE'
        ? `A sudden volume surge was detected that is ${primary.standardDeviations.toFixed(1)} standard deviations above normal trading patterns. This volume spike differs substantially from the token's historical baseline.`
        : anomalyType === 'LIQUIDITY_DRAIN'
          ? `Pool liquidity has shifted drastically (${primary.standardDeviations.toFixed(1)}σ below normal depth). This is a critical statistical anomaly indicating potential pool drainage.`
          : `Coordinated wallet balance accumulation (${primary.standardDeviations.toFixed(1)}σ divergence) deviates from organic distribution models.`;

    return {
      anomalyDetected: true,
      anomalyType,
      severity,
      evidence: significantDeviations,
      statisticalSummary,
      plainEnglishExplanation,
      confidence: primary.sampleSize > 50 ? 'HIGH' : 'MEDIUM',
    };
  }
}
