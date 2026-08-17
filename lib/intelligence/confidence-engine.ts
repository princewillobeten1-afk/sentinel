/**
 * Confidence Engine
 *
 * Calculates confidence based on:
 * - Data coverage (how many dimensions have data)
 * - Freshness (how recent is the data)
 * - Limitations (what's missing)
 *
 * A score based on complete recent data is not treated the same
 * as one based on sparse data.
 */

import type {
  Confidence,
  ConfidenceLevel,
  RiskCategory,
  RiskDimension,
  MissingDataEntry,
  DataFreshness,
  FreshnessLevel,
} from './types';

const ALL_CATEGORIES: RiskCategory[] = [
  'MARKET', 'LIQUIDITY', 'OWNERSHIP', 'CREATOR', 'ACTIVITY', 'CONTRACT', 'EXIT',
];

export function computeConfidence(
  dimensions: Partial<Record<RiskCategory, RiskDimension>>,
  missingData: MissingDataEntry[],
  freshness: DataFreshness,
): Confidence {
  // ── Data Coverage ──
  const coveredCount = ALL_CATEGORIES.filter(c => dimensions[c] != null).length;
  const dataCoverage = coveredCount / ALL_CATEGORIES.length;

  // ── Dimension Confidence Average ──
  const dimConfidences = ALL_CATEGORIES
    .map(c => dimensions[c]?.confidence ?? 0)
    .filter(c => c > 0);
  const avgDimConfidence = dimConfidences.length > 0
    ? dimConfidences.reduce((a, b) => a + b, 0) / dimConfidences.length
    : 0;

  // ── Freshness Penalty ──
  const freshnessFactor = freshnessToFactor(freshness.overall);

  // ── Missing Data Penalty ──
  const criticalMissing = missingData.filter(m => m.impact === 'REDUCES_CONFIDENCE').length;
  const limitingMissing = missingData.filter(m => m.impact === 'LIMITS_ANALYSIS').length;
  const missingPenalty = Math.min(0.4, criticalMissing * 0.05 + limitingMissing * 0.03);

  // ── Final Score ──
  const rawScore = (
    dataCoverage * 0.35 +
    avgDimConfidence * 0.35 +
    freshnessFactor * 0.30
  ) * 100;

  const score = Math.round(Math.max(0, Math.min(100, rawScore - missingPenalty * 100)));

  const level = scoreToConfidenceLevel(score);

  const limitations: string[] = [];
  if (dataCoverage < 0.5) {
    limitations.push(`Only ${coveredCount} of ${ALL_CATEGORIES.length} intelligence dimensions have data`);
  }
  if (freshness.overall === 'STALE' || freshness.overall === 'MISSING') {
    limitations.push('Some data sources are stale or unavailable');
  }
  for (const m of missingData.filter(md => md.impact === 'REDUCES_CONFIDENCE')) {
    limitations.push(m.description);
  }

  return {
    score,
    level,
    dataCoverage,
    freshness: freshness.overall,
    limitations,
  };
}

function freshnessToFactor(level: FreshnessLevel): number {
  switch (level) {
    case 'CURRENT': return 1.0;
    case 'RECENT': return 0.9;
    case 'DELAYED': return 0.7;
    case 'STALE': return 0.4;
    case 'MISSING': return 0.1;
  }
}

function scoreToConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MODERATE';
  if (score >= 25) return 'LOW';
  return 'INSUFFICIENT';
}
