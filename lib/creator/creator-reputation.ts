/**
 * Creator Reputation Engine
 * Sprint 6
 *
 * Multi-dimensional reputation scoring with sample-size confidence gating.
 *
 * 8 weighted dimensions:
 *   Launch History (0.20), Liquidity Behavior (0.18), Token Retention (0.15),
 *   Observed Selling (0.12), Creator Transparency (0.10),
 *   Associated Wallet Behavior (0.10), Historical Anomalies (0.08), Data Confidence (0.07)
 *
 * Sample-size gating: <3 launches → confidence: INSUFFICIENT, no numeric score displayed prominently.
 *
 * Score interpretation: 0–100 with neutral bands matching Sprint 5 risk levels.
 *
 * Methodology version: creator-reputation-v1.0
 */

import type {
  CreatorReputation,
  ReputationLevel,
  ReputationConfidenceLevel,
  ReputationDimension,
  ReputationDimensionName,
  CreatorLaunchRecord,
  CreatorBehaviorProfile,
  CreatorPattern,
} from './types';
import type { OwnershipEvidence } from '../ownership/types';

const METHODOLOGY_VERSION = 'creator-reputation-v1.0';

/** Minimum launches for a numeric reputation score */
const MIN_LAUNCHES_FOR_SCORE = 3;

// ────────────────────────────────────────────────────────────────────────────
// Dimension Weights
// ────────────────────────────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<ReputationDimensionName, number> = {
  LAUNCH_HISTORY: 0.20,
  LIQUIDITY_BEHAVIOR: 0.18,
  TOKEN_RETENTION: 0.15,
  OBSERVED_SELLING: 0.12,
  CREATOR_TRANSPARENCY: 0.10,
  ASSOCIATED_WALLET_BEHAVIOR: 0.10,
  HISTORICAL_ANOMALIES: 0.08,
  DATA_CONFIDENCE: 0.07,
};

// ────────────────────────────────────────────────────────────────────────────
// Input Types
// ────────────────────────────────────────────────────────────────────────────

export interface ReputationInput {
  launches: CreatorLaunchRecord[];
  behaviorProfile: CreatorBehaviorProfile;
  patterns: CreatorPattern[];
  associatedWalletCount: number;
  /** Whether the creator address is known */
  creatorIdentified: boolean;
  /** Whether the creator has any on-chain activity besides token creation */
  hasOnChainHistory: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Reputation Calculator
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate creator reputation from launch history and behavior.
 *
 * Returns null score if sample size is insufficient (<3 launches).
 */
export function calculateReputation(input: ReputationInput): CreatorReputation {
  const now = new Date().toISOString();
  const sampleSize = input.launches.length;
  const limitations: string[] = [];

  // Sample-size gate
  if (sampleSize < MIN_LAUNCHES_FOR_SCORE) {
    limitations.push(
      `Only ${sampleSize} launch(es) available — minimum ${MIN_LAUNCHES_FOR_SCORE} required for a numeric reputation score`,
    );
  }

  if (!input.creatorIdentified) {
    limitations.push('Creator address unknown — reputation cannot be assessed');
    return {
      score: null,
      level: 'UNKNOWN',
      confidence: 0,
      confidenceLevel: 'INSUFFICIENT',
      dimensions: [],
      patterns: input.patterns,
      limitations,
      sampleSize,
      methodologyVersion: METHODOLOGY_VERSION,
      generatedAt: now,
    };
  }

  // Calculate each dimension
  const dimensions: ReputationDimension[] = [
    scoreLaunchHistory(input),
    scoreLiquidityBehavior(input),
    scoreTokenRetention(input),
    scoreObservedSelling(input),
    scoreCreatorTransparency(input),
    scoreAssociatedWalletBehavior(input),
    scoreHistoricalAnomalies(input),
    scoreDataConfidence(input),
  ];

  // Weighted aggregate score
  const rawScore = dimensions.reduce(
    (sum, d) => sum + d.score * d.weight,
    0,
  );

  // Confidence multiplier based on sample size
  const sampleConfidence = calculateSampleConfidence(sampleSize);
  const adjustedScore = sampleSize >= MIN_LAUNCHES_FOR_SCORE
    ? Math.round(rawScore * sampleConfidence)
    : null;

  const level = scoreToLevel(adjustedScore);
  const confidenceLevel = sampleToConfidenceLevel(sampleSize);

  if (sampleSize < MIN_LAUNCHES_FOR_SCORE) {
    limitations.push('Score is preliminary — limited launch history');
  }

  return {
    score: adjustedScore,
    level,
    confidence: sampleConfidence,
    confidenceLevel,
    dimensions,
    patterns: input.patterns,
    limitations,
    sampleSize,
    methodologyVersion: METHODOLOGY_VERSION,
    generatedAt: now,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Dimension Scorers
// ────────────────────────────────────────────────────────────────────────────

function scoreLaunchHistory(input: ReputationInput): ReputationDimension {
  const weight = DIMENSION_WEIGHTS.LAUNCH_HISTORY;
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  if (input.launches.length === 0) {
    return { name: 'LAUNCH_HISTORY', score: 50, weight, evidence: [{
      fact: 'No launch history available',
      source: 'reputation_engine', observedAt: now, confidence: 0.30,
    }], description: 'No launch data' };
  }

  // Score based on outcome distribution
  const active = input.launches.filter(l => l.outcome === 'ACTIVE').length;
  const inactive = input.launches.filter(l => l.outcome === 'INACTIVE').length;
  const withdrawn = input.launches.filter(l => l.outcome === 'LIQUIDITY_WITHDRAWN').length;
  const declined = input.launches.filter(l => l.outcome === 'SEVERE_ACTIVITY_DECLINE').length;

  const total = input.launches.length;
  const healthyRatio = (active + inactive * 0.5) / total;
  const problematicRatio = (withdrawn + declined * 0.5) / total;

  let score = 50 + (healthyRatio - problematicRatio) * 40;
  score = Math.max(0, Math.min(100, score));

  evidence.push({
    fact: `${total} launches: ${active} active, ${inactive} inactive, ${withdrawn} liquidity withdrawn, ${declined} severe decline`,
    source: 'reputation_engine',
    observedAt: now,
    value: total,
    confidence: Math.min(0.90, 0.5 + total * 0.08),
  });

  return {
    name: 'LAUNCH_HISTORY',
    score: Math.round(score),
    weight,
    evidence,
    description: `${total} launches analyzed — ${active} currently active`,
  };
}

function scoreLiquidityBehavior(input: ReputationInput): ReputationDimension {
  const weight = DIMENSION_WEIGHTS.LIQUIDITY_BEHAVIOR;
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  if (input.launches.length === 0) {
    return { name: 'LIQUIDITY_BEHAVIOR', score: 50, weight, evidence: [{
      fact: 'No liquidity data',
      source: 'reputation_engine', observedAt: now, confidence: 0.30,
    }], description: 'No liquidity data' };
  }

  const fullRemovals = input.behaviorProfile.fullLiquidityRemovals;
  const total = input.launches.length;
  const removalRatio = fullRemovals / total;

  let score = 80 - removalRatio * 70;

  // Bonus for average time to withdrawal being high
  if (input.behaviorProfile.avgDaysToLiquidityWithdrawal != null) {
    if (input.behaviorProfile.avgDaysToLiquidityWithdrawal > 90) score += 10;
    else if (input.behaviorProfile.avgDaysToLiquidityWithdrawal < 7) score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  evidence.push({
    fact: `${fullRemovals} out of ${total} launches had full liquidity removal`,
    source: 'reputation_engine',
    observedAt: now,
    value: fullRemovals,
    confidence: 0.88,
  });

  return {
    name: 'LIQUIDITY_BEHAVIOR',
    score: Math.round(score),
    weight,
    evidence,
    description: `${fullRemovals}/${total} launches with full liquidity removal`,
  };
}

function scoreTokenRetention(input: ReputationInput): ReputationDimension {
  const weight = DIMENSION_WEIGHTS.TOKEN_RETENTION;
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  const avgRetention = input.behaviorProfile.avgRetentionPct;

  let score: number;
  if (avgRetention >= 70) score = 85;
  else if (avgRetention >= 40) score = 65;
  else if (avgRetention >= 10) score = 40;
  else score = 20;

  if (input.launches.length === 0) score = 50;

  evidence.push({
    fact: `Average token retention: ${avgRetention.toFixed(1)}%`,
    source: 'reputation_engine',
    observedAt: now,
    value: avgRetention,
    confidence: 0.82,
  });

  return {
    name: 'TOKEN_RETENTION',
    score: Math.round(score),
    weight,
    evidence,
    description: `Average ${avgRetention.toFixed(1)}% token retention`,
  };
}

function scoreObservedSelling(input: ReputationInput): ReputationDimension {
  const weight = DIMENSION_WEIGHTS.OBSERVED_SELLING;
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  if (input.launches.length === 0) {
    return { name: 'OBSERVED_SELLING', score: 50, weight, evidence: [{
      fact: 'No selling data',
      source: 'reputation_engine', observedAt: now, confidence: 0.30,
    }], description: 'No selling data' };
  }

  const avgDaysToSell = input.behaviorProfile.avgDaysToFirstSell;
  const totalEvents = input.behaviorProfile.totalSellingEvents;

  let score = 70;

  // Fast selling is concerning
  if (avgDaysToSell != null) {
    if (avgDaysToSell < 1) score -= 30;
    else if (avgDaysToSell < 3) score -= 20;
    else if (avgDaysToSell < 7) score -= 10;
    else if (avgDaysToSell > 30) score += 10;
  }

  // High frequency selling across launches
  const eventsPerLaunch = totalEvents / input.launches.length;
  if (eventsPerLaunch > 5) score -= 10;

  score = Math.max(0, Math.min(100, score));

  evidence.push({
    fact: `${totalEvents} selling events across ${input.launches.length} launches${avgDaysToSell != null ? `, avg ${avgDaysToSell.toFixed(1)} days to first sell` : ''}`,
    source: 'reputation_engine',
    observedAt: now,
    value: totalEvents,
    confidence: 0.85,
  });

  return {
    name: 'OBSERVED_SELLING',
    score: Math.round(score),
    weight,
    evidence,
    description: avgDaysToSell != null ? `Avg ${avgDaysToSell.toFixed(1)} days to first sell` : 'Selling timing unknown',
  };
}

function scoreCreatorTransparency(input: ReputationInput): ReputationDimension {
  const weight = DIMENSION_WEIGHTS.CREATOR_TRANSPARENCY;
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  let score = 50;

  if (input.creatorIdentified) score += 15;
  if (input.hasOnChainHistory) score += 15;
  if (input.launches.length > 3) score += 10;

  score = Math.max(0, Math.min(100, score));

  evidence.push({
    fact: `Creator identified: ${input.creatorIdentified}, on-chain history: ${input.hasOnChainHistory}, launches: ${input.launches.length}`,
    source: 'reputation_engine',
    observedAt: now,
    confidence: 0.80,
  });

  return {
    name: 'CREATOR_TRANSPARENCY',
    score: Math.round(score),
    weight,
    evidence,
    description: input.creatorIdentified ? 'Creator address identified' : 'Creator address unknown',
  };
}

function scoreAssociatedWalletBehavior(input: ReputationInput): ReputationDimension {
  const weight = DIMENSION_WEIGHTS.ASSOCIATED_WALLET_BEHAVIOR;
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  // Start neutral — associated wallets don't automatically indicate risk
  let score = 60;

  // Many associated wallets may indicate complex structure
  if (input.associatedWalletCount > 10) score -= 10;
  else if (input.associatedWalletCount > 5) score -= 5;
  else if (input.associatedWalletCount <= 2) score += 10;

  score = Math.max(0, Math.min(100, score));

  evidence.push({
    fact: `${input.associatedWalletCount} wallets associated with creator`,
    source: 'reputation_engine',
    observedAt: now,
    value: input.associatedWalletCount,
    confidence: 0.75,
  });

  return {
    name: 'ASSOCIATED_WALLET_BEHAVIOR',
    score: Math.round(score),
    weight,
    evidence,
    description: `${input.associatedWalletCount} associated wallets`,
  };
}

function scoreHistoricalAnomalies(input: ReputationInput): ReputationDimension {
  const weight = DIMENSION_WEIGHTS.HISTORICAL_ANOMALIES;
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  let score = 70; // Start positive — no anomalies is the default

  // Check for concerning patterns
  const concerningPatterns = input.patterns.filter(p =>
    p.type === 'REPEATED_EARLY_DISTRIBUTION' ||
    p.type === 'REPEATED_LIQUIDITY_WITHDRAWAL' ||
    p.type === 'REPEATED_CREATOR_SELLING',
  );

  const positivePatterns = input.patterns.filter(p =>
    p.type === 'CONSISTENT_RETENTION' ||
    p.type === 'CONSISTENT_LIQUIDITY_PROVISION',
  );

  score -= concerningPatterns.length * 15;
  score += positivePatterns.length * 10;

  score = Math.max(0, Math.min(100, score));

  if (concerningPatterns.length > 0) {
    evidence.push({
      fact: `${concerningPatterns.length} concerning pattern(s) detected across launches`,
      source: 'reputation_engine',
      observedAt: now,
      value: concerningPatterns.length,
      confidence: 0.82,
    });
  }

  if (positivePatterns.length > 0) {
    evidence.push({
      fact: `${positivePatterns.length} positive pattern(s) detected across launches`,
      source: 'reputation_engine',
      observedAt: now,
      value: positivePatterns.length,
      confidence: 0.80,
    });
  }

  if (evidence.length === 0) {
    evidence.push({
      fact: 'No significant anomalies detected',
      source: 'reputation_engine',
      observedAt: now,
      confidence: 0.65,
    });
  }

  return {
    name: 'HISTORICAL_ANOMALIES',
    score: Math.round(score),
    weight,
    evidence,
    description: `${concerningPatterns.length} concerns, ${positivePatterns.length} positives`,
  };
}

function scoreDataConfidence(input: ReputationInput): ReputationDimension {
  const weight = DIMENSION_WEIGHTS.DATA_CONFIDENCE;
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  // How much data do we have?
  let score = 30; // Start low

  if (input.launches.length >= 5) score += 30;
  else if (input.launches.length >= 3) score += 20;
  else if (input.launches.length >= 1) score += 10;

  if (input.creatorIdentified) score += 15;
  if (input.hasOnChainHistory) score += 10;

  // Check data completeness of launches
  const withLiqData = input.launches.filter(
    l => l.initialLiquidityUsd != null,
  ).length;
  const dataRatio = input.launches.length > 0 ? withLiqData / input.launches.length : 0;
  score += dataRatio * 15;

  score = Math.max(0, Math.min(100, score));

  evidence.push({
    fact: `${input.launches.length} launches with ${(dataRatio * 100).toFixed(0)}% data completeness`,
    source: 'reputation_engine',
    observedAt: now,
    value: input.launches.length,
    confidence: 0.90,
  });

  return {
    name: 'DATA_CONFIDENCE',
    score: Math.round(score),
    weight,
    evidence,
    description: `${input.launches.length} launches, ${(dataRatio * 100).toFixed(0)}% data coverage`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

function calculateSampleConfidence(sampleSize: number): number {
  if (sampleSize === 0) return 0;
  if (sampleSize === 1) return 0.25;
  if (sampleSize === 2) return 0.40;
  if (sampleSize <= 5) return 0.60 + (sampleSize - 3) * 0.05;
  if (sampleSize <= 10) return 0.70 + (sampleSize - 5) * 0.03;
  return Math.min(0.95, 0.85 + (sampleSize - 10) * 0.01);
}

function scoreToLevel(score: number | null): ReputationLevel {
  if (score == null) return 'UNKNOWN';
  if (score >= 90) return 'STRONG';
  if (score >= 75) return 'FAVORABLE';
  if (score >= 60) return 'MIXED';
  if (score >= 40) return 'ELEVATED';
  if (score >= 20) return 'HIGH_CONCERN';
  return 'SEVERE';
}

function sampleToConfidenceLevel(sampleSize: number): ReputationConfidenceLevel {
  if (sampleSize < MIN_LAUNCHES_FOR_SCORE) return 'INSUFFICIENT';
  if (sampleSize >= 10) return 'HIGH';
  if (sampleSize >= 5) return 'MODERATE';
  return 'LOW';
}
