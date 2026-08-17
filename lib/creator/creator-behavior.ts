/**
 * Creator Behavior Analyzer
 * Sprint 6
 *
 * Analyzes creator wallet behavior across launches.
 * Detects cross-token patterns and recurring behaviors.
 *
 * Every pattern requires:
 * - Observation count
 * - Time period
 * - Evidence
 * - Confidence
 *
 * Uses factual descriptions: "sold X% of position" not "dumped tokens".
 * Methodology version: creator-behavior-v1.0
 */

import type {
  CreatorLaunchRecord,
  CreatorPattern,
  CreatorPatternType,
} from './types';
import type { OwnershipEvidence } from '../ownership/types';

const METHODOLOGY_VERSION = 'creator-behavior-v1.0';

/** Minimum launches to detect a pattern */
const MIN_PATTERN_OCCURRENCES = 2;

/** Threshold for "early" selling (within 7 days of launch) */
const EARLY_SELL_THRESHOLD_DAYS = 7;

/** Threshold for "early" liquidity withdrawal */
const EARLY_LIQ_WITHDRAWAL_DAYS = 14;

// ────────────────────────────────────────────────────────────────────────────
// Main Pattern Detection
// ────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a creator's launch history for recurring behavioral patterns.
 * Returns detected patterns sorted by confidence descending.
 */
export function analyzeCreatorBehavior(
  launches: CreatorLaunchRecord[],
): CreatorPattern[] {
  if (launches.length < MIN_PATTERN_OCCURRENCES) return [];

  const patterns: CreatorPattern[] = [];
  const now = new Date().toISOString();

  const timePeriod = getTimePeriod(launches);

  // 1. Repeated early selling
  const earlySellingPattern = detectEarlySelling(launches, timePeriod);
  if (earlySellingPattern) patterns.push(earlySellingPattern);

  // 2. Repeated liquidity withdrawal
  const liqWithdrawalPattern = detectLiquidityWithdrawal(launches, timePeriod);
  if (liqWithdrawalPattern) patterns.push(liqWithdrawalPattern);

  // 3. Repeated early distribution (large % sold quickly)
  const earlyDistPattern = detectEarlyDistribution(launches, timePeriod);
  if (earlyDistPattern) patterns.push(earlyDistPattern);

  // 4. Consistent retention (positive pattern)
  const retentionPattern = detectConsistentRetention(launches, timePeriod);
  if (retentionPattern) patterns.push(retentionPattern);

  // 5. Consistent liquidity provision (positive pattern)
  const liqProvisionPattern = detectConsistentLiquidityProvision(launches, timePeriod);
  if (liqProvisionPattern) patterns.push(liqProvisionPattern);

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

// ────────────────────────────────────────────────────────────────────────────
// Pattern Detectors
// ────────────────────────────────────────────────────────────────────────────

function detectEarlySelling(
  launches: CreatorLaunchRecord[],
  timePeriod: { from: string; to: string },
): CreatorPattern | null {
  let count = 0;
  const evidence: OwnershipEvidence[] = [];

  for (const launch of launches) {
    const earlyEvents = launch.sellingEvents.filter(e => {
      const daysSinceLaunch =
        (new Date(e.timestamp).getTime() - new Date(launch.launchedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      return daysSinceLaunch <= EARLY_SELL_THRESHOLD_DAYS;
    });

    if (earlyEvents.length > 0) {
      count++;
      const totalSoldPct = earlyEvents.reduce((s, e) => s + e.amountPct, 0);
      evidence.push({
        fact: `${launch.tokenSymbol}: Creator sold ${totalSoldPct.toFixed(1)}% within ${EARLY_SELL_THRESHOLD_DAYS} days of launch (${earlyEvents.length} events)`,
        source: 'creator_behavior',
        observedAt: launch.observedAt,
        value: totalSoldPct,
        confidence: 0.88,
      });
    }
  }

  if (count < MIN_PATTERN_OCCURRENCES) return null;

  return {
    type: 'REPEATED_CREATOR_SELLING',
    occurrenceCount: count,
    totalLaunches: launches.length,
    timePeriod,
    evidence,
    confidence: calculatePatternConfidence(count, launches.length),
  };
}

function detectLiquidityWithdrawal(
  launches: CreatorLaunchRecord[],
  timePeriod: { from: string; to: string },
): CreatorPattern | null {
  let count = 0;
  const evidence: OwnershipEvidence[] = [];

  for (const launch of launches) {
    if (launch.outcome === 'LIQUIDITY_WITHDRAWN') {
      count++;

      // Find timing of first withdrawal
      const removals = launch.liquidityEvents.filter(e => e.type === 'REMOVED');
      const firstRemoval = removals[0];
      const daysSinceLaunch = firstRemoval
        ? (new Date(firstRemoval.timestamp).getTime() - new Date(launch.launchedAt).getTime()) /
          (1000 * 60 * 60 * 24)
        : null;

      evidence.push({
        fact: `${launch.tokenSymbol}: Liquidity withdrawn${daysSinceLaunch != null ? ` after ${daysSinceLaunch.toFixed(1)} days` : ''}`,
        source: 'creator_behavior',
        observedAt: launch.observedAt,
        confidence: launch.outcomeConfidence,
      });
    }
  }

  if (count < MIN_PATTERN_OCCURRENCES) return null;

  return {
    type: 'REPEATED_LIQUIDITY_WITHDRAWAL',
    occurrenceCount: count,
    totalLaunches: launches.length,
    timePeriod,
    evidence,
    confidence: calculatePatternConfidence(count, launches.length),
  };
}

function detectEarlyDistribution(
  launches: CreatorLaunchRecord[],
  timePeriod: { from: string; to: string },
): CreatorPattern | null {
  let count = 0;
  const evidence: OwnershipEvidence[] = [];

  for (const launch of launches) {
    const earlyEvents = launch.sellingEvents.filter(e => {
      const daysSinceLaunch =
        (new Date(e.timestamp).getTime() - new Date(launch.launchedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      return daysSinceLaunch <= EARLY_SELL_THRESHOLD_DAYS && e.amountPct > 30;
    });

    if (earlyEvents.length > 0) {
      count++;
      const totalSoldPct = earlyEvents.reduce((s, e) => s + e.amountPct, 0);
      evidence.push({
        fact: `${launch.tokenSymbol}: ${totalSoldPct.toFixed(1)}% of creator position distributed within ${EARLY_SELL_THRESHOLD_DAYS} days`,
        source: 'creator_behavior',
        observedAt: launch.observedAt,
        value: totalSoldPct,
        confidence: 0.85,
      });
    }
  }

  if (count < MIN_PATTERN_OCCURRENCES) return null;

  return {
    type: 'REPEATED_EARLY_DISTRIBUTION',
    occurrenceCount: count,
    totalLaunches: launches.length,
    timePeriod,
    evidence,
    confidence: calculatePatternConfidence(count, launches.length),
  };
}

function detectConsistentRetention(
  launches: CreatorLaunchRecord[],
  timePeriod: { from: string; to: string },
): CreatorPattern | null {
  const retainedLaunches = launches.filter(
    l => l.creatorRetainedPct != null && l.creatorRetainedPct > 50,
  );

  if (retainedLaunches.length < MIN_PATTERN_OCCURRENCES) return null;

  const evidence: OwnershipEvidence[] = retainedLaunches.map(l => ({
    fact: `${l.tokenSymbol}: Creator retained ${l.creatorRetainedPct!.toFixed(1)}% of tokens`,
    source: 'creator_behavior',
    observedAt: l.observedAt,
    value: l.creatorRetainedPct!,
    confidence: 0.85,
  }));

  return {
    type: 'CONSISTENT_RETENTION',
    occurrenceCount: retainedLaunches.length,
    totalLaunches: launches.length,
    timePeriod,
    evidence,
    confidence: calculatePatternConfidence(retainedLaunches.length, launches.length),
  };
}

function detectConsistentLiquidityProvision(
  launches: CreatorLaunchRecord[],
  timePeriod: { from: string; to: string },
): CreatorPattern | null {
  const liqProvided = launches.filter(l => {
    const addEvents = l.liquidityEvents.filter(e => e.type === 'ADDED');
    return addEvents.length > 0 && l.outcome !== 'LIQUIDITY_WITHDRAWN';
  });

  if (liqProvided.length < MIN_PATTERN_OCCURRENCES) return null;

  const evidence: OwnershipEvidence[] = liqProvided.map(l => ({
    fact: `${l.tokenSymbol}: Creator provided liquidity that remains active (outcome: ${l.outcome})`,
    source: 'creator_behavior',
    observedAt: l.observedAt,
    confidence: 0.80,
  }));

  return {
    type: 'CONSISTENT_LIQUIDITY_PROVISION',
    occurrenceCount: liqProvided.length,
    totalLaunches: launches.length,
    timePeriod,
    evidence,
    confidence: calculatePatternConfidence(liqProvided.length, launches.length),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

function calculatePatternConfidence(occurrences: number, total: number): number {
  if (total === 0) return 0;
  const ratio = occurrences / total;
  // Confidence scales with both ratio and sample size
  const sampleFactor = Math.min(1.0, total / 5); // Low confidence below 5 samples
  return Math.min(0.95, ratio * 0.8 * sampleFactor + 0.1);
}

function getTimePeriod(launches: CreatorLaunchRecord[]): { from: string; to: string } {
  if (launches.length === 0) {
    const now = new Date().toISOString();
    return { from: now, to: now };
  }
  const sorted = [...launches].sort(
    (a, b) => new Date(a.launchedAt).getTime() - new Date(b.launchedAt).getTime(),
  );
  return {
    from: sorted[0].launchedAt,
    to: sorted[sorted.length - 1].launchedAt,
  };
}
