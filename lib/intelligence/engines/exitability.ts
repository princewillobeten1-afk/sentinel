/**
 * Exitability Intelligence Engine (Foundation)
 *
 * Basic exitability analysis using liquidity, pool depth, recent volume,
 * and price impact estimates. Simulates sell sizes ($100–$10K).
 *
 * The final Exitability Score Engine comes in a future sprint.
 * For now: data availability + basic liquidity-based observations.
 */

import type {
  EngineResult,
  IntelligenceSignal,
  Evidence,
  MissingDataEntry,
  RiskDimension,
  DimensionStatus,
  PriceImpactEstimate,
} from '../types';

const METHODOLOGY_VERSION = 'exitability-v1.0.0';

const SELL_SIZES = [100, 500, 1_000, 5_000, 10_000];

export interface ExitabilityInput {
  liquidityUsd: number;
  poolDepthUsd: number;
  volume24hUsd: number;
  volume1hUsd: number;
  priceUsd: number;
  feeTierPct: number;
  dataTimestamp: string;
}

export interface ExitabilityResult extends EngineResult {
  priceImpactEstimates: PriceImpactEstimate[];
}

export function analyzeExitability(input: ExitabilityInput): ExitabilityResult {
  const now = new Date().toISOString();
  const signals: IntelligenceSignal[] = [];
  const evidence: Evidence[] = [];
  const missingData: MissingDataEntry[] = [];
  let dataAvail = 0;
  const totalChecks = 5;

  const chk = (v: number | undefined, label: string): boolean => {
    if (v != null && !isNaN(v) && v > 0) { dataAvail++; return true; }
    missingData.push({ category: 'EXIT', description: `${label} unavailable`, impact: 'REDUCES_CONFIDENCE' });
    return false;
  };

  chk(input.liquidityUsd, 'Liquidity');
  chk(input.poolDepthUsd, 'Pool depth');
  chk(input.volume24hUsd, '24h volume');
  chk(input.volume1hUsd, '1h volume');
  chk(input.priceUsd, 'Token price');

  evidence.push({
    fact: `Available liquidity: $${fmtNum(input.liquidityUsd)}`,
    source: 'pool_data',
    observedAt: input.dataTimestamp,
    value: input.liquidityUsd,
    confidence: 0.92,
  });

  evidence.push({
    fact: `Pool depth: $${fmtNum(input.poolDepthUsd)}`,
    source: 'pool_data',
    observedAt: input.dataTimestamp,
    value: input.poolDepthUsd,
    confidence: 0.90,
  });

  // ── Price Impact Simulation ──
  // Simplified constant-product model: impact ≈ sellAmount / (2 * poolDepth)
  // This is a simulation, not a guarantee.
  const priceImpactEstimates: PriceImpactEstimate[] = SELL_SIZES.map((sellAmount) => {
    const effectiveDepth = Math.max(input.poolDepthUsd, 1);
    const priceImpactPct = (sellAmount / (2 * effectiveDepth)) * 100;
    const clampedImpact = Math.min(priceImpactPct, 99);
    const feeDeduction = sellAmount * (input.feeTierPct / 100);
    const estimatedOutputUsd = sellAmount * (1 - clampedImpact / 100) - feeDeduction;
    const liquidityConsumedPct = (sellAmount / Math.max(input.liquidityUsd, 1)) * 100;

    return {
      sellAmountUsd: sellAmount,
      estimatedOutputUsd: Math.max(0, estimatedOutputUsd),
      priceImpactPct: Math.round(clampedImpact * 100) / 100,
      liquidityConsumedPct: Math.round(Math.min(liquidityConsumedPct, 100) * 100) / 100,
      isSimulation: true as const,
    };
  });

  // ── Generate Signals Based on Impact ──
  const mediumSell = priceImpactEstimates.find(e => e.sellAmountUsd === 1_000);
  const largeSell = priceImpactEstimates.find(e => e.sellAmountUsd === 10_000);

  if (mediumSell && mediumSell.priceImpactPct > 10) {
    signals.push(mkSig('HIGH_IMPACT_MEDIUM_SELL', 'MEDIUM', 'NEGATIVE',
      `${mediumSell.priceImpactPct.toFixed(1)}%`, 0.82,
      [{
        fact: `A $1,000 sell would have an estimated ${mediumSell.priceImpactPct.toFixed(1)}% price impact`,
        source: 'simulation', observedAt: now, confidence: 0.82,
      }], now));
  } else if (mediumSell && mediumSell.priceImpactPct < 1) {
    signals.push(mkSig('LOW_IMPACT_MEDIUM_SELL', 'INFO', 'POSITIVE',
      `${mediumSell.priceImpactPct.toFixed(2)}%`, 0.85,
      [{
        fact: `A $1,000 sell would have minimal estimated price impact (${mediumSell.priceImpactPct.toFixed(2)}%)`,
        source: 'simulation', observedAt: now, confidence: 0.85,
      }], now));
  }

  if (largeSell && largeSell.priceImpactPct > 20) {
    signals.push(mkSig('SEVERE_IMPACT_LARGE_SELL', 'HIGH', 'NEGATIVE',
      `${largeSell.priceImpactPct.toFixed(1)}%`, 0.80,
      [{
        fact: `A $10,000 sell would have an estimated ${largeSell.priceImpactPct.toFixed(1)}% price impact — difficult exit at this size`,
        source: 'simulation', observedAt: now, confidence: 0.80,
      }], now));
  }

  // Volume relative to sell size
  if (input.volume1hUsd > 0 && input.volume1hUsd < 1_000) {
    signals.push(mkSig('LOW_RECENT_VOLUME', 'LOW', 'NEGATIVE',
      `$${fmtNum(input.volume1hUsd)}`, 0.85,
      [{
        fact: `1h volume is only $${fmtNum(input.volume1hUsd)} — limited recent trading activity for exits`,
        source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.85,
      }], now));
  }

  // ── Score ──
  let score = 50;

  // Pool depth impact
  if (input.poolDepthUsd > 500_000) score += 20;
  else if (input.poolDepthUsd > 100_000) score += 12;
  else if (input.poolDepthUsd > 50_000) score += 5;
  else if (input.poolDepthUsd < 10_000) score -= 20;
  else if (input.poolDepthUsd < 25_000) score -= 10;

  // Price impact for $1K sell
  if (mediumSell) {
    if (mediumSell.priceImpactPct < 1) score += 10;
    else if (mediumSell.priceImpactPct > 10) score -= 15;
    else if (mediumSell.priceImpactPct > 5) score -= 8;
  }

  // Volume adequacy
  if (input.volume24hUsd > 1_000_000) score += 5;
  else if (input.volume24hUsd < 10_000) score -= 5;

  score = Math.max(0, Math.min(100, score));
  const confidence = (dataAvail / totalChecks) * 0.82; // Lower confidence for simulated values
  const level = sToStatus(score);

  return {
    dimension: { category: 'EXIT', score, level, confidence, evidence, signals, lastUpdated: now },
    signals,
    missingData,
    priceImpactEstimates,
  };
}

function sToStatus(s: number): DimensionStatus {
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
    id: `sig_exit_${type.toLowerCase()}_${Date.now()}`,
    type, category: 'EXIT', severity, polarity, value, confidence,
    evidence, observedAt: now, methodologyVersion: METHODOLOGY_VERSION, metadata: {},
  };
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}
