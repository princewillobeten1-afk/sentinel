/**
 * Score Aggregator
 *
 * Weighted aggregation of 7 risk dimensions into overall 0–100 score.
 * Missing dimensions reduce confidence, not score.
 */

import type { RiskCategory, RiskDimension, RiskLevel } from './types';

const METHODOLOGY_VERSION = 'score-aggregator-v1.0.0';

const DIMENSION_WEIGHTS: Record<RiskCategory, number> = {
  MARKET: 0.20,
  LIQUIDITY: 0.18,
  OWNERSHIP: 0.15,
  CREATOR: 0.10,
  ACTIVITY: 0.15,
  CONTRACT: 0.12,
  EXIT: 0.10,
};

export interface AggregationResult {
  overallScore: number;
  riskLevel: RiskLevel;
  weightedContributions: Record<string, number>;
  dimensionsCovered: number;
  dimensionsTotal: number;
  methodologyVersion: string;
}

/**
 * Aggregate risk dimensions into an overall intelligence score.
 *
 * Score interpretation:
 *   90–100  Strong observable profile
 *   75–89   Generally favorable observable profile
 *   60–74   Mixed profile
 *   40–59   Elevated concerns
 *   20–39   High concern
 *   0–19    Severe observable concerns
 */
export function aggregateScore(
  dimensions: Partial<Record<RiskCategory, RiskDimension>>,
): AggregationResult {
  const allCategories: RiskCategory[] = ['MARKET', 'LIQUIDITY', 'OWNERSHIP', 'CREATOR', 'ACTIVITY', 'CONTRACT', 'EXIT'];

  let weightedSum = 0;
  let totalWeight = 0;
  let dimensionsCovered = 0;
  const contributions: Record<string, number> = {};

  for (const cat of allCategories) {
    const dim = dimensions[cat];
    const weight = DIMENSION_WEIGHTS[cat];

    if (dim) {
      dimensionsCovered++;
      const contribution = dim.score * weight;
      weightedSum += contribution;
      totalWeight += weight;
      contributions[cat] = Math.round(contribution * 100) / 100;
    }
    // Missing dimensions: we skip them in weighting
    // This means the score is based only on available data
    // Confidence is separately reduced by the confidence engine
  }

  // Normalize: if only some dimensions are available, re-weight to 0–100 range
  const overallScore = totalWeight > 0
    ? Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight)))
    : 50; // Default neutral when no data

  const riskLevel = scoreToRiskLevel(overallScore);

  return {
    overallScore,
    riskLevel,
    weightedContributions: contributions,
    dimensionsCovered,
    dimensionsTotal: allCategories.length,
    methodologyVersion: METHODOLOGY_VERSION,
  };
}

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 90) return 'STRONG';
  if (score >= 75) return 'FAVORABLE';
  if (score >= 60) return 'MIXED';
  if (score >= 40) return 'ELEVATED';
  if (score >= 20) return 'HIGH_CONCERN';
  return 'SEVERE';
}

export function riskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'STRONG': return 'Strong Observable Profile';
    case 'FAVORABLE': return 'Generally Favorable';
    case 'MIXED': return 'Mixed Profile';
    case 'ELEVATED': return 'Elevated Concerns';
    case 'HIGH_CONCERN': return 'High Concern';
    case 'SEVERE': return 'Severe Observable Concerns';
  }
}

export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'STRONG': return '#12B574';
    case 'FAVORABLE': return '#22C489';
    case 'MIXED': return '#E5A23D';
    case 'ELEVATED': return '#C18430';
    case 'HIGH_CONCERN': return '#EC5A5F';
    case 'SEVERE': return '#D93E44';
  }
}
