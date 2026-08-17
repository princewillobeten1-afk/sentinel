/**
 * Ownership Intelligence Engine
 *
 * Calculates holder count, top-holder concentration, growth, and distribution.
 * Clearly distinguishes known holders from attributed entities.
 * Does NOT assume multiple addresses belong to the same person without evidence.
 */

import type {
  EngineResult,
  IntelligenceSignal,
  Evidence,
  MissingDataEntry,
  RiskDimension,
  DimensionStatus,
  HolderSnapshot,
} from '../types';

const METHODOLOGY_VERSION = 'ownership-v1.0.0';

export interface OwnershipInput {
  holdersCount: number;
  top1HolderPct: number;
  top5HolderPct: number;
  top10HolderPct: number;
  holderGrowthPct: number;
  distribution?: { label: string; count: number; totalSharePct: number }[];
  dataTimestamp: string;
  dataCompleteness: number; // 0.0 – 1.0
}

export interface OwnershipResult extends EngineResult {
  holderSnapshot: HolderSnapshot;
}

export function analyzeOwnership(input: OwnershipInput, tokenId: string): OwnershipResult {
  const now = new Date().toISOString();
  const signals: IntelligenceSignal[] = [];
  const evidence: Evidence[] = [];
  const missingData: MissingDataEntry[] = [];

  // ── Holder Count ──
  if (input.holdersCount > 0) {
    evidence.push({
      fact: `${input.holdersCount.toLocaleString()} holders`,
      source: 'holder_data',
      observedAt: input.dataTimestamp,
      value: input.holdersCount,
      confidence: input.dataCompleteness,
    });

    if (input.holdersCount > 10_000) {
      signals.push(mkSig('BROAD_HOLDER_BASE', 'INFO', 'POSITIVE',
        input.holdersCount, 0.88,
        [{ fact: `${input.holdersCount.toLocaleString()} holders — broad distribution`, source: 'holder_data', observedAt: input.dataTimestamp, confidence: 0.88 }], now));
    } else if (input.holdersCount < 100) {
      signals.push(mkSig('FEW_HOLDERS', 'LOW', 'NEGATIVE',
        input.holdersCount, 0.90,
        [{ fact: `Only ${input.holdersCount} holders — very narrow base`, source: 'holder_data', observedAt: input.dataTimestamp, confidence: 0.90 }], now));
    }
  } else {
    missingData.push({ category: 'OWNERSHIP', description: 'Holder count unavailable', impact: 'REDUCES_CONFIDENCE' });
  }

  // ── Top Holder Concentration ──
  if (input.top1HolderPct > 0) {
    evidence.push({
      fact: `Top holder owns ${input.top1HolderPct.toFixed(1)}%`,
      source: 'holder_data',
      observedAt: input.dataTimestamp,
      value: input.top1HolderPct,
      confidence: input.dataCompleteness * 0.95,
    });

    if (input.top1HolderPct > 50) {
      signals.push(mkSig('EXTREME_CONCENTRATION', 'HIGH', 'NEGATIVE',
        `${input.top1HolderPct.toFixed(1)}%`, 0.93,
        [{ fact: `Single holder controls ${input.top1HolderPct.toFixed(1)}% of supply — extreme concentration`, source: 'holder_data', observedAt: input.dataTimestamp, confidence: 0.93 }], now));
    } else if (input.top1HolderPct > 20) {
      signals.push(mkSig('HIGH_SINGLE_HOLDER', 'MEDIUM', 'NEGATIVE',
        `${input.top1HolderPct.toFixed(1)}%`, 0.90,
        [{ fact: `Largest holder controls ${input.top1HolderPct.toFixed(1)}%`, source: 'holder_data', observedAt: input.dataTimestamp, confidence: 0.90 }], now));
    }
  }

  if (input.top5HolderPct > 0) {
    evidence.push({
      fact: `Top 5 holders own ${input.top5HolderPct.toFixed(1)}%`,
      source: 'holder_data',
      observedAt: input.dataTimestamp,
      value: input.top5HolderPct,
      confidence: input.dataCompleteness * 0.92,
    });

    if (input.top5HolderPct > 70) {
      signals.push(mkSig('HIGH_TOP5_CONCENTRATION', 'MEDIUM', 'NEGATIVE',
        `${input.top5HolderPct.toFixed(1)}%`, 0.90,
        [{ fact: `Top 5 holders control ${input.top5HolderPct.toFixed(1)}% — high concentration`, source: 'holder_data', observedAt: input.dataTimestamp, confidence: 0.90 }], now));
    }
  }

  if (input.top10HolderPct > 0) {
    evidence.push({
      fact: `Top 10 holders own ${input.top10HolderPct.toFixed(1)}%`,
      source: 'holder_data',
      observedAt: input.dataTimestamp,
      value: input.top10HolderPct,
      confidence: input.dataCompleteness * 0.90,
    });
  }

  // ── Holder Growth ──
  if (input.holderGrowthPct !== 0) {
    evidence.push({
      fact: `Holder growth: ${input.holderGrowthPct >= 0 ? '+' : ''}${input.holderGrowthPct.toFixed(1)}%`,
      source: 'holder_data',
      observedAt: input.dataTimestamp,
      value: input.holderGrowthPct,
      confidence: 0.85,
    });

    if (input.holderGrowthPct > 20) {
      signals.push(mkSig('HOLDER_GROWTH', 'INFO', 'POSITIVE',
        `+${input.holderGrowthPct.toFixed(1)}%`, 0.85,
        [{ fact: `Holder base growing ${input.holderGrowthPct.toFixed(1)}% — broadening ownership`, source: 'holder_data', observedAt: input.dataTimestamp, confidence: 0.85 }], now));
    } else if (input.holderGrowthPct < -10) {
      signals.push(mkSig('HOLDER_DECLINE', 'LOW', 'NEGATIVE',
        `${input.holderGrowthPct.toFixed(1)}%`, 0.85,
        [{ fact: `Holder base shrinking ${input.holderGrowthPct.toFixed(1)}%`, source: 'holder_data', observedAt: input.dataTimestamp, confidence: 0.85 }], now));
    }
  }

  // ── Data Completeness ──
  if (input.dataCompleteness < 0.5) {
    missingData.push({ category: 'OWNERSHIP', description: 'Holder distribution data is incomplete', impact: 'REDUCES_CONFIDENCE' });
  }

  // ── Score ──
  let score = 50;

  // Holder count
  if (input.holdersCount > 50_000) score += 15;
  else if (input.holdersCount > 10_000) score += 10;
  else if (input.holdersCount > 1_000) score += 5;
  else if (input.holdersCount < 50) score -= 15;
  else if (input.holdersCount < 200) score -= 8;

  // Concentration
  if (input.top1HolderPct > 50) score -= 25;
  else if (input.top1HolderPct > 30) score -= 15;
  else if (input.top1HolderPct > 15) score -= 5;
  else if (input.top1HolderPct < 5 && input.top1HolderPct > 0) score += 10;

  if (input.top5HolderPct > 70) score -= 10;
  else if (input.top5HolderPct < 30 && input.top5HolderPct > 0) score += 5;

  // Growth
  if (input.holderGrowthPct > 20) score += 5;
  else if (input.holderGrowthPct < -10) score -= 5;

  score = Math.max(0, Math.min(100, score));
  const confidence = input.dataCompleteness * 0.92;
  const level = scoreToStatus(score);

  const holderSnapshot: HolderSnapshot = {
    tokenId,
    holderCount: input.holdersCount,
    top1Pct: input.top1HolderPct,
    top5Pct: input.top5HolderPct,
    top10Pct: input.top10HolderPct,
    holderGrowthPct: input.holderGrowthPct,
    distribution: input.distribution || [],
    snapshotAt: now,
    dataCompleteness: input.dataCompleteness,
  };

  return {
    dimension: { category: 'OWNERSHIP', score, level, confidence, evidence, signals, lastUpdated: now },
    signals,
    missingData,
    holderSnapshot,
  };
}

function scoreToStatus(s: number): DimensionStatus {
  if (s >= 75) return 'STRONG';
  if (s >= 55) return 'MODERATE';
  if (s >= 35) return 'ELEVATED';
  return 'UNKNOWN';
}

function mkSig(
  type: string, severity: IntelligenceSignal['severity'],
  polarity: IntelligenceSignal['polarity'], value: string | number,
  confidence: number, evidence: Evidence[], now: string,
): IntelligenceSignal {
  return {
    id: `sig_own_${type.toLowerCase()}_${Date.now()}`,
    type, category: 'OWNERSHIP', severity, polarity, value, confidence,
    evidence, observedAt: now, methodologyVersion: METHODOLOGY_VERSION, metadata: {},
  };
}
