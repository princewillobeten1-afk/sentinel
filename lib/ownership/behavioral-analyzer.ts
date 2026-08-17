/**
 * Behavioral Correlation Analyzer
 * Sprint 6
 *
 * Detects coordinated wallet behavior using statistical methods.
 * Behavioral similarity alone NEVER proves shared ownership.
 * All correlation signals carry NEUTRAL polarity.
 *
 * Methods:
 * - Jaccard similarity for token set overlap
 * - Timing window analysis for entry/exit correlation
 * - Transaction pattern comparison
 *
 * Methodology version: behavioral-correlation-v1.0
 */

import type {
  BehavioralCorrelation,
  BehavioralSignalType,
  OwnershipEvidence,
  WalletRelationshipEdge,
} from './types';

const METHODOLOGY_VERSION = 'behavioral-correlation-v1.0';

/** Minimum observations needed to establish behavioral correlation */
const MIN_OBSERVATIONS = 3;

/** Time window in ms for "coordinated" entry/exit (5 minutes) */
const TIMING_WINDOW_MS = 5 * 60 * 1000;

// ────────────────────────────────────────────────────────────────────────────
// Input Types
// ────────────────────────────────────────────────────────────────────────────

export interface WalletActivity {
  wallet: string;
  /** Tokens this wallet has interacted with */
  tokenInteractions: string[];
  /** Buy timestamps per token */
  buyTimestamps: { token: string; timestamp: string }[];
  /** Sell timestamps per token */
  sellTimestamps: { token: string; timestamp: string }[];
  /** Transaction sizes (USD) */
  txSizesUsd: number[];
}

// ────────────────────────────────────────────────────────────────────────────
// Main Analysis
// ────────────────────────────────────────────────────────────────────────────

/**
 * Analyze behavioral correlation between all wallet pairs.
 * Returns correlations sorted by score descending.
 */
export function analyzeBehavioralCorrelation(
  activities: WalletActivity[],
  tokenContext?: string,
): BehavioralCorrelation[] {
  const correlations: BehavioralCorrelation[] = [];

  // Pairwise comparison
  for (let i = 0; i < activities.length; i++) {
    for (let j = i + 1; j < activities.length; j++) {
      const walletA = activities[i];
      const walletB = activities[j];

      // 1. Token selection similarity (Jaccard)
      const tokenSim = analyzeTokenSimilarity(walletA, walletB);
      if (tokenSim) correlations.push({ ...tokenSim, tokenContext });

      // 2. Entry timing correlation
      const entrySim = analyzeTimingCorrelation(
        walletA, walletB, 'buy', 'SIMILAR_ENTRY_TIMING',
      );
      if (entrySim) correlations.push({ ...entrySim, tokenContext });

      // 3. Exit timing correlation
      const exitSim = analyzeTimingCorrelation(
        walletA, walletB, 'sell', 'SIMILAR_EXIT_TIMING',
      );
      if (exitSim) correlations.push({ ...exitSim, tokenContext });

      // 4. Transaction pattern similarity
      const txSim = analyzeTxPatternSimilarity(walletA, walletB);
      if (txSim) correlations.push({ ...txSim, tokenContext });
    }
  }

  return correlations.sort((a, b) => b.correlationScore - a.correlationScore);
}

// ────────────────────────────────────────────────────────────────────────────
// Token Selection Similarity (Jaccard Index)
// ────────────────────────────────────────────────────────────────────────────

function analyzeTokenSimilarity(
  a: WalletActivity,
  b: WalletActivity,
): Omit<BehavioralCorrelation, 'tokenContext'> | null {
  const setA = new Set(a.tokenInteractions);
  const setB = new Set(b.tokenInteractions);

  if (setA.size === 0 || setB.size === 0) return null;

  const intersection = new Set([...setA].filter(t => setB.has(t)));
  const union = new Set([...setA, ...setB]);

  const jaccard = intersection.size / union.size;

  // Only report if >= 3 shared tokens and meaningful overlap
  if (intersection.size < MIN_OBSERVATIONS || jaccard < 0.3) return null;

  const evidence: OwnershipEvidence[] = [{
    fact: `${intersection.size} shared token interactions out of ${union.size} total unique tokens (Jaccard: ${(jaccard * 100).toFixed(1)}%)`,
    source: 'behavioral_analysis',
    observedAt: new Date().toISOString(),
    value: jaccard,
    confidence: Math.min(0.85, jaccard),
  }];

  return {
    walletA: a.wallet,
    walletB: b.wallet,
    signalType: 'SIMILAR_TOKEN_SELECTION',
    correlationScore: jaccard,
    observationCount: intersection.size,
    evidence,
    confidence: Math.min(0.80, jaccard * 0.9),
    methodologyVersion: METHODOLOGY_VERSION,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Timing Correlation
// ────────────────────────────────────────────────────────────────────────────

function analyzeTimingCorrelation(
  a: WalletActivity,
  b: WalletActivity,
  direction: 'buy' | 'sell',
  signalType: BehavioralSignalType,
): Omit<BehavioralCorrelation, 'tokenContext'> | null {
  const tsA = direction === 'buy' ? a.buyTimestamps : a.sellTimestamps;
  const tsB = direction === 'buy' ? b.buyTimestamps : b.sellTimestamps;

  if (tsA.length === 0 || tsB.length === 0) return null;

  // Find correlated events within TIMING_WINDOW_MS
  let correlatedCount = 0;
  const totalPairs = Math.min(tsA.length, tsB.length);

  for (const eventA of tsA) {
    for (const eventB of tsB) {
      if (eventA.token !== eventB.token) continue;
      const timeDiff = Math.abs(
        new Date(eventA.timestamp).getTime() - new Date(eventB.timestamp).getTime(),
      );
      if (timeDiff <= TIMING_WINDOW_MS) {
        correlatedCount++;
        break; // Count each A event only once
      }
    }
  }

  if (correlatedCount < MIN_OBSERVATIONS) return null;

  const correlationScore = totalPairs > 0 ? correlatedCount / totalPairs : 0;
  if (correlationScore < 0.3) return null;

  const label = direction === 'buy' ? 'acquisition' : 'disposal';
  const evidence: OwnershipEvidence[] = [{
    fact: `${correlatedCount} correlated ${label} events within ${TIMING_WINDOW_MS / 60000}-minute windows across ${totalPairs} comparable events`,
    source: 'behavioral_analysis',
    observedAt: new Date().toISOString(),
    value: correlationScore,
    confidence: Math.min(0.85, correlationScore * 0.95),
  }];

  return {
    walletA: a.wallet,
    walletB: b.wallet,
    signalType,
    correlationScore,
    observationCount: correlatedCount,
    evidence,
    confidence: Math.min(0.80, correlationScore * 0.85),
    methodologyVersion: METHODOLOGY_VERSION,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Transaction Pattern Similarity
// ────────────────────────────────────────────────────────────────────────────

function analyzeTxPatternSimilarity(
  a: WalletActivity,
  b: WalletActivity,
): Omit<BehavioralCorrelation, 'tokenContext'> | null {
  if (a.txSizesUsd.length < MIN_OBSERVATIONS || b.txSizesUsd.length < MIN_OBSERVATIONS) {
    return null;
  }

  // Compare transaction size distributions using coefficient of variation overlap
  const statsA = computeDistStats(a.txSizesUsd);
  const statsB = computeDistStats(b.txSizesUsd);

  if (statsA.mean === 0 || statsB.mean === 0) return null;

  // Overlap ratio: how similar are the means and standard deviations?
  const meanRatio = Math.min(statsA.mean, statsB.mean) / Math.max(statsA.mean, statsB.mean);
  const cvA = statsA.stddev / statsA.mean;
  const cvB = statsB.stddev / statsB.mean;
  const cvSimilarity = 1 - Math.abs(cvA - cvB);

  const similarity = (meanRatio * 0.6 + Math.max(0, cvSimilarity) * 0.4);

  if (similarity < 0.5) return null;

  const evidence: OwnershipEvidence[] = [{
    fact: `Transaction size distributions show ${(similarity * 100).toFixed(1)}% similarity (mean ratio: ${(meanRatio * 100).toFixed(1)}%, CV similarity: ${(Math.max(0, cvSimilarity) * 100).toFixed(1)}%)`,
    source: 'behavioral_analysis',
    observedAt: new Date().toISOString(),
    value: similarity,
    confidence: Math.min(0.75, similarity * 0.8),
  }];

  return {
    walletA: a.wallet,
    walletB: b.wallet,
    signalType: 'SIMILAR_TX_PATTERNS',
    correlationScore: similarity,
    observationCount: Math.min(a.txSizesUsd.length, b.txSizesUsd.length),
    evidence,
    confidence: Math.min(0.70, similarity * 0.75),
    methodologyVersion: METHODOLOGY_VERSION,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Behavioral Edge Conversion
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert a behavioral correlation into a wallet relationship edge.
 */
export function behavioralToEdge(corr: BehavioralCorrelation): WalletRelationshipEdge {
  return {
    id: `edge_behav_${corr.walletA.slice(0, 8)}_${corr.walletB.slice(0, 8)}_${corr.signalType}_${Date.now()}`,
    source: corr.walletA,
    target: corr.walletB,
    type: 'TEMPORAL_CORRELATION',
    strength: corr.correlationScore * 0.8, // Behavioral signals capped at 80% strength
    evidence: corr.evidence,
    firstObserved: corr.evidence[0]?.observedAt || new Date().toISOString(),
    lastObserved: corr.evidence[corr.evidence.length - 1]?.observedAt || new Date().toISOString(),
    confidence: corr.confidence,
    methodologyVersion: METHODOLOGY_VERSION,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

function computeDistStats(values: number[]) {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}
