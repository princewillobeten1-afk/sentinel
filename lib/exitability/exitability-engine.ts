/**
 * Exitability Score Engine (spec §3–6, §8, §21–22, §31)
 *
 * Answers "if I enter now, how realistically can I exit?" as a position-specific
 * score, an exitability curve across sizes, and an exit-depth table. Every score
 * is explainable from structured evidence.
 */

import type {
  ExitDepthPoint,
  ExitSimulationResult,
  ExitabilityContext,
  ExitabilityCurvePoint,
  ExitabilityReport,
  ExitabilitySignal,
  HolderPressure,
  LiquidityQuality,
  PoolState,
} from './types';
import { analyzeLiquidityQuality } from './liquidity-engine';
import { buildBestRoute } from './routing-engine';
import { estimateSlippage } from './slippage-engine';
import { analyzeHolderPressure } from './stress-engine';
import {
  EXITABILITY_VERSION,
  EXIT_DEPTH_THRESHOLDS,
  PRESET_POSITION_SIZES,
  clamp,
  evidence,
  formatUsd,
  interpretExitability,
  interpretationLabel,
  round,
  share,
} from './utils';

export interface ExitabilityEngineOptions {
  /** Position used for the headline score. Defaults to user position or $5K. */
  referencePositionUsd?: number;
  positionSizes?: number[];
}

export function analyzeExitability(
  context: ExitabilityContext,
  options: ExitabilityEngineOptions = {},
): ExitabilityReport {
  const observedAt = context.observedAt;
  const liquidity = analyzeLiquidityQuality(context);
  const holderPressure = analyzeHolderPressure(context, liquidity);

  const referencePositionUsd = options.referencePositionUsd
    ?? context.userPositionUsd
    ?? 5_000;

  const sizes = (options.positionSizes ?? PRESET_POSITION_SIZES)
    .filter((size) => size > 0)
    .sort((a, b) => a - b);

  const curve = sizes.map((size) => toCurvePoint(context, liquidity, size));
  const referenceSimulation = simulateExit(context, liquidity, referencePositionUsd);
  const exitDepth = computeExitDepth(context, liquidity);

  const signals = buildSignals(context, liquidity, holderPressure, referenceSimulation, observedAt);

  const score = referenceSimulation.exitabilityScore;
  const stressScore = computeStressScore(score, holderPressure, liquidity);
  const interpretation = interpretExitability(score);
  const confidence = computeConfidence(liquidity, holderPressure);
  const warnings = buildWarnings(liquidity, holderPressure, referenceSimulation);

  return {
    tokenId: context.tokenId,
    chain: context.chain,
    referencePositionUsd,
    score,
    interpretation,
    confidence,
    stressScore,
    liquidity,
    curve,
    exitDepth,
    referenceSimulation,
    holderPressure,
    signals,
    warnings,
    explanation: buildExplanation(score, interpretation, referencePositionUsd, liquidity, holderPressure, referenceSimulation),
    limitations: liquidity.limitations,
    exitabilityVersion: EXITABILITY_VERSION,
    generatedAt: observedAt,
  };
}

/** Position-specific exit simulation (spec §5). */
export function simulateExit(
  context: ExitabilityContext,
  liquidity: LiquidityQuality,
  positionUsd: number,
): ExitSimulationResult {
  const slippage = estimateSlippage({
    pools: context.pools,
    side: 'SELL',
    inputUsd: positionUsd,
    recentPriceVolatility: context.recentPriceVolatility,
    observedAt: context.observedAt,
  });

  const route = buildBestRoute({
    pools: context.pools,
    side: 'SELL',
    inputUsd: positionUsd,
    slippagePct: slippage.expectedSlippagePct,
  });

  const expectedProceedsUsd = route.outputUsd;
  const minimumProceedsUsd = round(expectedProceedsUsd * (1 - clamp(slippage.worstCaseSlippagePct, 0, 99) / 100), 2);
  const liquidityConsumedPct = round(share(positionUsd, Math.max(liquidity.usableLiquidityUsd, 1)), 4);

  const exitabilityScore = scorePosition({
    priceImpactPct: route.priceImpactPct,
    slippagePct: slippage.expectedSlippagePct,
    liquidityConsumedPct,
    liquidity,
    routeConfidence: route.confidence,
  });

  return {
    positionUsd: round(positionUsd, 2),
    expectedProceedsUsd,
    minimumProceedsUsd,
    priceImpactPct: route.priceImpactPct,
    slippagePct: slippage.expectedSlippagePct,
    liquidityConsumedPct,
    route,
    exitabilityScore,
    confidence: round(clamp(route.confidence * slippage.confidence, 0, 1), 3),
    isSimulation: true,
  };
}

/**
 * Position exitability score. Dominated by price impact and how much usable
 * liquidity the order consumes — a big order in a thin market scores low even
 * if displayed TVL looks large.
 */
function scorePosition(args: {
  priceImpactPct: number;
  slippagePct: number;
  liquidityConsumedPct: number;
  liquidity: LiquidityQuality;
  routeConfidence: number;
}): number {
  let score = 100;

  // Price impact is the primary driver.
  score -= Math.min(60, args.priceImpactPct * 3.2);
  // Slippage adds execution uncertainty.
  score -= Math.min(20, args.slippagePct * 1.4);
  // Consuming a large share of usable liquidity is penalized steeply.
  score -= Math.min(30, args.liquidityConsumedPct * 100 * 0.6);
  // Structural liquidity factors.
  score -= Math.min(12, args.liquidity.poolConcentration * 12);
  score -= Math.min(12, (100 - args.liquidity.stabilityScore) * 0.12);
  // Reliability bonus.
  score += (args.routeConfidence - 0.5) * 8;

  return Math.round(clamp(score));
}

function toCurvePoint(
  context: ExitabilityContext,
  liquidity: LiquidityQuality,
  positionUsd: number,
): ExitabilityCurvePoint {
  const simulation = simulateExit(context, liquidity, positionUsd);
  return {
    positionUsd,
    exitabilityScore: simulation.exitabilityScore,
    priceImpactPct: simulation.priceImpactPct,
    slippagePct: simulation.slippagePct,
    expectedProceedsUsd: simulation.expectedProceedsUsd,
  };
}

/** Exit depth: how much sell volume fits under each price-impact threshold (§21). */
function computeExitDepth(context: ExitabilityContext, liquidity: LiquidityQuality): ExitDepthPoint[] {
  return EXIT_DEPTH_THRESHOLDS.map((threshold) => {
    const absorbableUsd = solveAbsorbable(context.pools, threshold, liquidity.usableLiquidityUsd);
    return { impactPct: threshold, absorbableUsd: round(absorbableUsd, 2) };
  });
}

/** Binary search for the sell size that produces exactly `targetImpactPct`. */
function solveAbsorbable(pools: PoolState[], targetImpactPct: number, usableLiquidityUsd: number): number {
  if (pools.length === 0 || usableLiquidityUsd <= 0) return 0;
  let low = 0;
  let high = Math.max(usableLiquidityUsd * 2, 1_000);

  const impactAt = (size: number): number =>
    buildBestRoute({ pools, side: 'SELL', inputUsd: size, slippagePct: 0 }).priceImpactPct;

  // Expand high until it exceeds the target (bounded).
  let guard = 0;
  while (impactAt(high) < targetImpactPct && guard < 40) {
    high *= 2;
    guard++;
  }

  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (impactAt(mid) < targetImpactPct) low = mid;
    else high = mid;
  }
  return low;
}

function computeStressScore(
  normalScore: number,
  holderPressure: HolderPressure,
  liquidity: LiquidityQuality,
): number {
  let score = normalScore;
  // Under stress, elevated exit pressure and thin usable liquidity bite hardest.
  score -= Math.min(45, holderPressure.pressureRatio * 25);
  if (liquidity.topPoolShare >= 0.7) score -= 8;
  if (liquidity.stabilityScore < 50) score -= 10;
  return Math.round(clamp(score));
}

function computeConfidence(liquidity: LiquidityQuality, holderPressure: HolderPressure): number {
  let confidence = liquidity.confidence * 100;
  if (holderPressure.usableLiquidityUsd <= 0) confidence *= 0.5;
  if (liquidity.poolCount === 0) confidence *= 0.3;
  return Math.round(clamp(confidence));
}

function buildSignals(
  context: ExitabilityContext,
  liquidity: LiquidityQuality,
  holderPressure: HolderPressure,
  simulation: ExitSimulationResult,
  observedAt: string,
): ExitabilitySignal[] {
  const signals: ExitabilitySignal[] = [...liquidity.signals];

  signals.push({
    type: 'REFERENCE_EXIT_IMPACT',
    severity: simulation.priceImpactPct >= 10 ? 'HIGH' : simulation.priceImpactPct >= 5 ? 'MEDIUM' : 'INFO',
    polarity: simulation.priceImpactPct >= 5 ? 'NEGATIVE' : 'POSITIVE',
    value: round(simulation.priceImpactPct, 2),
    confidence: 0.85,
    evidence: [
      evidence(
        `A ${formatUsd(simulation.positionUsd)} sell produces approximately ${round(simulation.priceImpactPct, 1)}% price impact`,
        'exit_simulation',
        observedAt,
        simulation.priceImpactPct,
        0.85,
      ),
    ],
  });

  if (holderPressure.level === 'ELEVATED' || holderPressure.level === 'HIGH' || holderPressure.level === 'SEVERE') {
    signals.push({
      type: 'EXIT_PRESSURE',
      severity: holderPressure.level === 'SEVERE' ? 'CRITICAL' : holderPressure.level === 'HIGH' ? 'HIGH' : 'MEDIUM',
      polarity: 'NEGATIVE',
      value: holderPressure.level,
      confidence: 0.8,
      evidence: holderPressure.evidence,
    });
  }

  return signals;
}

function buildWarnings(
  liquidity: LiquidityQuality,
  holderPressure: HolderPressure,
  simulation: ExitSimulationResult,
): string[] {
  const warnings: string[] = [];
  if (simulation.priceImpactPct >= 10) warnings.push('Reference position incurs high price impact on exit.');
  if (liquidity.usableLiquidityUsd < liquidity.totalLiquidityUsd * 0.4) {
    warnings.push('A large share of displayed liquidity is not immediately usable.');
  }
  if (liquidity.topPoolShare >= 0.8) warnings.push('Usable liquidity is highly concentrated in one pool.');
  if (holderPressure.pressureRatio >= 2) warnings.push('Potentially movable supply greatly exceeds usable liquidity.');
  const worstDrop = Math.min(0, ...liquidity.liquidityChanges.map((change) => change.changePct));
  if (worstDrop <= -20) warnings.push(`Liquidity has recently declined ${round(Math.abs(worstDrop), 0)}%.`);
  return warnings;
}

function buildExplanation(
  score: number,
  interpretation: ExitabilityReport['interpretation'],
  positionUsd: number,
  liquidity: LiquidityQuality,
  holderPressure: HolderPressure,
  simulation: ExitSimulationResult,
): string {
  const parts: string[] = [];
  parts.push(`Exitability ${score}/100 (${interpretationLabel(interpretation)}) for a ${formatUsd(positionUsd)} position.`);
  parts.push(
    `This position represents ~${round(share(positionUsd, Math.max(liquidity.usableLiquidityUsd, 1)) * 100, 1)}% of immediately usable liquidity (${formatUsd(liquidity.usableLiquidityUsd)}).`,
  );
  parts.push(`Estimated exit impact is ${round(simulation.priceImpactPct, 1)}% with ~${round(simulation.slippagePct, 1)}% slippage.`);
  if (liquidity.topPoolShare >= 0.6) {
    parts.push(`${round(liquidity.topPoolShare * 100, 0)}% of usable liquidity is concentrated in the primary pool.`);
  }
  const worstDrop = Math.min(0, ...liquidity.liquidityChanges.map((change) => change.changePct));
  if (worstDrop <= -10) parts.push(`Liquidity has declined ${round(Math.abs(worstDrop), 0)}% recently.`);
  if (holderPressure.level !== 'LOW') {
    parts.push(`Potential exit pressure is ${holderPressure.level.toLowerCase()} — large holders could materially affect price if they exit.`);
  }
  return parts.join(' ');
}
