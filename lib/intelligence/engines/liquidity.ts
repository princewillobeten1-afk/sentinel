/**
 * Liquidity Intelligence Engine
 *
 * Analyzes total liquidity, liquidity changes, concentration, pool concentration,
 * volatility, sudden removal, and growth.
 *
 * A large liquidity number alone does not mean a token is easy to exit.
 * This engine feeds into the Exitability engine.
 */

import type {
  EngineResult,
  IntelligenceSignal,
  Evidence,
  MissingDataEntry,
  RiskDimension,
  DimensionStatus,
  LiquidityWithdrawalSeverity,
} from '../types';

const METHODOLOGY_VERSION = 'liquidity-v1.0.0';

export interface LiquidityInput {
  totalLiquidityUsd: number;
  liquidityChange1hPct: number;
  liquidityChange24hPct: number;
  pools: LiquidityPoolInput[];
  dataTimestamp: string;
}

export interface LiquidityPoolInput {
  id: string;
  dex: string;
  tvlUsd: number;
  feeTier: number;
  shareOfTotal: number; // 0.0 – 1.0
}

export interface LiquidityResult extends EngineResult {
  withdrawalSeverity: LiquidityWithdrawalSeverity;
}

export function analyzeLiquidity(input: LiquidityInput): LiquidityResult {
  const now = new Date().toISOString();
  const signals: IntelligenceSignal[] = [];
  const evidence: Evidence[] = [];
  const missingData: MissingDataEntry[] = [];
  let dataPoints = 0;
  let availablePoints = 0;

  const check = (val: number | undefined | null, label: string): boolean => {
    dataPoints++;
    if (val != null && !isNaN(val)) { availablePoints++; return true; }
    missingData.push({ category: 'LIQUIDITY', description: `${label} unavailable`, impact: 'REDUCES_CONFIDENCE' });
    return false;
  };

  // ── Total Liquidity ──
  if (check(input.totalLiquidityUsd, 'Total liquidity')) {
    evidence.push({
      fact: `Total liquidity: $${formatNum(input.totalLiquidityUsd)}`,
      source: 'pool_data',
      observedAt: input.dataTimestamp,
      value: input.totalLiquidityUsd,
      confidence: 0.94,
    });

    if (input.totalLiquidityUsd < 10_000) {
      signals.push(mkSig('VERY_LOW_LIQUIDITY', 'HIGH', 'NEGATIVE',
        `$${formatNum(input.totalLiquidityUsd)}`, 0.95,
        [{ fact: `Total liquidity is only $${formatNum(input.totalLiquidityUsd)} — extremely thin market`, source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.95 }], now));
    } else if (input.totalLiquidityUsd < 50_000) {
      signals.push(mkSig('LOW_LIQUIDITY', 'MEDIUM', 'NEGATIVE',
        `$${formatNum(input.totalLiquidityUsd)}`, 0.92,
        [{ fact: `Total liquidity $${formatNum(input.totalLiquidityUsd)} — limited depth`, source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.92 }], now));
    } else if (input.totalLiquidityUsd > 1_000_000) {
      signals.push(mkSig('STRONG_LIQUIDITY', 'INFO', 'POSITIVE',
        `$${formatNum(input.totalLiquidityUsd)}`, 0.93,
        [{ fact: `Liquidity pool depth: $${formatNum(input.totalLiquidityUsd)}`, source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.93 }], now));
    }
  }

  // ── Liquidity Changes ──
  let withdrawalSeverity: LiquidityWithdrawalSeverity = 'NORMAL';

  if (check(input.liquidityChange1hPct, 'Liquidity change 1h')) {
    evidence.push({
      fact: `Liquidity change (1h): ${input.liquidityChange1hPct >= 0 ? '+' : ''}${input.liquidityChange1hPct.toFixed(1)}%`,
      source: 'pool_data',
      observedAt: input.dataTimestamp,
      value: input.liquidityChange1hPct,
      confidence: 0.92,
    });

    // Withdrawal classification (Section 14)
    if (input.liquidityChange1hPct <= -60) {
      withdrawalSeverity = 'SEVERE';
      signals.push(mkSig('SEVERE_LIQUIDITY_WITHDRAWAL', 'CRITICAL', 'NEGATIVE',
        `${input.liquidityChange1hPct.toFixed(1)}%`, 0.95,
        [{
          fact: `Liquidity dropped ${Math.abs(input.liquidityChange1hPct).toFixed(1)}% in 1h — severe withdrawal detected`,
          source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.95,
        }], now));
    } else if (input.liquidityChange1hPct <= -30) {
      withdrawalSeverity = 'SIGNIFICANT';
      signals.push(mkSig('SIGNIFICANT_LIQUIDITY_WITHDRAWAL', 'HIGH', 'NEGATIVE',
        `${input.liquidityChange1hPct.toFixed(1)}%`, 0.93,
        [{
          fact: `Liquidity dropped ${Math.abs(input.liquidityChange1hPct).toFixed(1)}% in 1h — significant withdrawal`,
          source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.93,
        }], now));
    } else if (input.liquidityChange1hPct <= -15) {
      withdrawalSeverity = 'ELEVATED';
      signals.push(mkSig('ELEVATED_LIQUIDITY_WITHDRAWAL', 'MEDIUM', 'NEGATIVE',
        `${input.liquidityChange1hPct.toFixed(1)}%`, 0.90,
        [{
          fact: `Liquidity decreased ${Math.abs(input.liquidityChange1hPct).toFixed(1)}% in 1h — elevated withdrawal`,
          source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.90,
        }], now));
    }

    // Liquidity growth
    if (input.liquidityChange1hPct > 20) {
      signals.push(mkSig('LIQUIDITY_GROWTH', 'INFO', 'POSITIVE',
        `+${input.liquidityChange1hPct.toFixed(1)}%`, 0.90,
        [{ fact: `Liquidity grew ${input.liquidityChange1hPct.toFixed(1)}% in 1h`, source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.90 }], now));
    }
  }

  // ── 24h Liquidity Change ──
  if (check(input.liquidityChange24hPct, 'Liquidity change 24h')) {
    evidence.push({
      fact: `Liquidity change (24h): ${input.liquidityChange24hPct >= 0 ? '+' : ''}${input.liquidityChange24hPct.toFixed(1)}%`,
      source: 'pool_data',
      observedAt: input.dataTimestamp,
      value: input.liquidityChange24hPct,
      confidence: 0.90,
    });
  }

  // ── Pool Concentration ──
  if (input.pools.length > 0) {
    availablePoints++; dataPoints++;
    const topPoolShare = Math.max(...input.pools.map(p => p.shareOfTotal));
    evidence.push({
      fact: `${input.pools.length} pools, top pool share: ${(topPoolShare * 100).toFixed(1)}%`,
      source: 'pool_data',
      observedAt: input.dataTimestamp,
      value: topPoolShare,
      confidence: 0.91,
    });

    if (input.pools.length === 1) {
      signals.push(mkSig('SINGLE_POOL', 'MEDIUM', 'NEGATIVE',
        '1 pool', 0.95,
        [{ fact: 'Liquidity exists in a single pool — concentration risk', source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.95 }], now));
    } else if (topPoolShare > 0.9) {
      signals.push(mkSig('POOL_CONCENTRATION', 'LOW', 'NEGATIVE',
        `${(topPoolShare * 100).toFixed(0)}%`, 0.90,
        [{ fact: `Top pool holds ${(topPoolShare * 100).toFixed(0)}% of total liquidity`, source: 'pool_data', observedAt: input.dataTimestamp, confidence: 0.90 }], now));
    }
  } else {
    dataPoints++;
    missingData.push({ category: 'LIQUIDITY', description: 'Pool data unavailable', impact: 'LIMITS_ANALYSIS' });
  }

  // ── Score ──
  let score = 50;

  // Liquidity depth
  if (input.totalLiquidityUsd > 1_000_000) score += 20;
  else if (input.totalLiquidityUsd > 200_000) score += 12;
  else if (input.totalLiquidityUsd > 50_000) score += 5;
  else if (input.totalLiquidityUsd < 10_000) score -= 20;
  else if (input.totalLiquidityUsd < 50_000) score -= 10;

  // Change impact
  if (withdrawalSeverity === 'SEVERE') score -= 30;
  else if (withdrawalSeverity === 'SIGNIFICANT') score -= 18;
  else if (withdrawalSeverity === 'ELEVATED') score -= 10;
  else if (input.liquidityChange1hPct > 10) score += 5;

  // Pool diversity
  if (input.pools.length > 2) score += 5;
  else if (input.pools.length === 1) score -= 5;

  score = Math.max(0, Math.min(100, score));
  const confidence = (availablePoints / Math.max(1, dataPoints)) * 0.94;
  const level = scoreToStatus(score);

  return {
    dimension: { category: 'LIQUIDITY', score, level, confidence, evidence, signals, lastUpdated: now },
    signals,
    missingData,
    withdrawalSeverity,
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
    id: `sig_liq_${type.toLowerCase()}_${Date.now()}`,
    type, category: 'LIQUIDITY', severity, polarity, value, confidence,
    evidence, observedAt: now, methodologyVersion: METHODOLOGY_VERSION, metadata: {},
  };
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}
