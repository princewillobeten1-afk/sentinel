/**
 * Explanation Generator
 *
 * Every score must answer:
 * - What happened? (Observable event)
 * - Why does it matter? (Context)
 * - How strong is the evidence? (Confidence)
 * - When was it observed? (Timestamp)
 * - What is missing? (Data limitations)
 *
 * Generates human-readable explanations from structured signals.
 * Does not generate explanations containing facts unavailable in the underlying data.
 */

import type {
  TokenIntelligenceReport,
  IntelligenceSignal,
  MissingDataEntry,
  RiskLevel,
} from './types';
import { riskLevelLabel } from './score-aggregator';

/**
 * Generate a structured explanation from the intelligence report.
 */
export function generateExplanation(report: TokenIntelligenceReport): string {
  const parts: string[] = [];

  // ── Overall Summary ──
  parts.push(
    `${report.token.symbol} has an overall intelligence score of ${report.overallScore}/100 (${riskLevelLabel(report.riskLevel)}). ` +
    `Confidence in this assessment: ${report.confidence.score}% (${report.confidence.level}).`
  );

  // ── Organic Activity & Insider Insights ──
  if (report.organicActivity) {
    parts.push(
      `Activity Quality: Organic activity score is ${report.organicActivity.score}/100 (${report.organicActivity.confidence}% confidence). ${report.organicActivity.interpretation}`
    );
  }

  if (report.insiderReport && report.insiderReport.candidates.length > 0) {
    const highest = report.insiderReport.highestConfidencePattern ?? report.insiderReport.candidates[0];
    parts.push(
      `Early / Coordinated Activity: ${report.insiderReport.candidates.length} candidate wallet(s) identified exhibiting early or coordinated characteristics. Highest-confidence pattern score: ${highest.score}/100 (${highest.confidence}% confidence). ${highest.explanation}`
    );
  }

  // ── Key Positives ──
  if (report.positives.length > 0) {
    const topPositives = report.positives.slice(0, 3);
    parts.push(
      `Positive indicators: ${topPositives.map(s => summarizeSignal(s)).join('; ')}.`
    );
  }

  // ── Key Warnings ──
  if (report.warnings.length > 0) {
    const topWarnings = report.warnings.slice(0, 3);
    parts.push(
      `Areas of concern: ${topWarnings.map(s => summarizeSignal(s)).join('; ')}.`
    );
  }

  // ── Missing Data ──
  if (report.missingData.length > 0) {
    const criticalMissing = report.missingData
      .filter(m => m.impact === 'REDUCES_CONFIDENCE')
      .slice(0, 3);
    if (criticalMissing.length > 0) {
      parts.push(
        `Data limitations: ${criticalMissing.map(m => m.description).join('; ')}.`
      );
    }
  }

  // ── Freshness Note ──
  if (report.dataFreshness.overall === 'STALE' || report.dataFreshness.overall === 'MISSING') {
    parts.push(
      `Note: Some data inputs are ${report.dataFreshness.overall.toLowerCase()}. This assessment may not reflect the most recent state.`
    );
  }

  // ── Disclaimer ──
  parts.push(
    'This assessment is based on observable data patterns and is not a financial recommendation.'
  );

  return parts.join(' ');

}

/**
 * Summarize a single signal into a short phrase.
 */
function summarizeSignal(signal: IntelligenceSignal): string {
  if (signal.evidence.length > 0) {
    return signal.evidence[0].fact;
  }
  return `${signal.type}: ${signal.value}`;
}

/**
 * Generate a per-dimension explanation.
 */
export function explainDimension(
  category: string,
  score: number,
  signals: IntelligenceSignal[],
  missingData: MissingDataEntry[],
): string {
  const parts: string[] = [];

  parts.push(`${category} dimension score: ${score}/100.`);

  const negatives = signals.filter(s => s.polarity === 'NEGATIVE');
  const positives = signals.filter(s => s.polarity === 'POSITIVE');

  if (positives.length > 0) {
    parts.push(`Positive: ${positives.map(s => summarizeSignal(s)).join('; ')}.`);
  }

  if (negatives.length > 0) {
    parts.push(`Concerns: ${negatives.map(s => summarizeSignal(s)).join('; ')}.`);
  }

  const catMissing = missingData.filter(m => m.category === category);
  if (catMissing.length > 0) {
    parts.push(`Missing: ${catMissing.map(m => m.description).join('; ')}.`);
  }

  if (signals.length === 0 && catMissing.length === 0) {
    parts.push('No significant signals detected in this dimension.');
  }

  return parts.join(' ');
}
