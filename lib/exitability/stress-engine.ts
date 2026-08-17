/**
 * Exit Stress Testing Engine (spec §23–30)
 *
 * Models potential selling pressure and simulates hypothetical exits. These are
 * explicitly labelled simulations — never predictions that holders will sell.
 */

import type {
  ExitPressureLevel,
  ExitabilityContext,
  ExitabilitySignal,
  HolderPosition,
  HolderPressure,
  LiquidityQuality,
  PoolState,
  StressScenario,
  StressTestReport,
} from './types';
import { buildBestRoute } from './routing-engine';
import { clamp, evidence, formatUsd, round, share } from './utils';

const LARGE_HOLDER_FRACTIONS = [0.01, 0.05, 0.1];
const MASS_EXIT_FRACTIONS = [0.1, 0.2, 0.3, 0.5];

/** Potential exit pressure: movable supply relative to usable liquidity (§24). */
export function analyzeHolderPressure(
  context: ExitabilityContext,
  liquidity: LiquidityQuality,
): HolderPressure {
  const holders = context.holders ?? [];
  const observedAt = context.observedAt;
  const usableLiquidityUsd = liquidity.usableLiquidityUsd;

  const sorted = [...holders].sort((a, b) => b.balanceUsd - a.balanceUsd);
  const top10 = sorted.slice(0, 10);
  const top10SupplyPct = round(top10.reduce((total, holder) => total + holder.supplyPct, 0), 4);

  const clusterSupplyPct = round(
    sorted.filter((holder) => holder.clusterId).reduce((total, holder) => total + holder.supplyPct, 0),
    4,
  );
  const creatorSupplyPct = round(
    sorted.filter((holder) => holder.creatorAssociated).reduce((total, holder) => total + holder.supplyPct, 0),
    4,
  );

  // "Potentially movable" = notional held by significant holders (top 10 +
  // clusters + creator-associated), de-duplicated.
  const significant = new Map<string, HolderPosition>();
  for (const holder of [...top10, ...sorted.filter((h) => h.clusterId || h.creatorAssociated || h.earlyParticipant)]) {
    significant.set(holder.wallet, holder);
  }
  const potentiallyMovableUsd = round(
    Array.from(significant.values()).reduce((total, holder) => total + holder.balanceUsd, 0),
    2,
  );

  const pressureRatio = round(share(potentiallyMovableUsd, Math.max(usableLiquidityUsd, 1)), 4);
  const level = pressureLevel(pressureRatio);

  return {
    top10SupplyPct,
    clusterSupplyPct,
    creatorSupplyPct,
    potentiallyMovableUsd,
    usableLiquidityUsd,
    pressureRatio,
    level,
    evidence: [
      evidence(
        `Top 10 wallets hold ${round(top10SupplyPct * 100, 1)}% of supply; potentially movable supply ${formatUsd(potentiallyMovableUsd)} vs usable liquidity ${formatUsd(usableLiquidityUsd)}`,
        'holder_snapshot',
        observedAt,
        pressureRatio,
        0.8,
      ),
    ],
  };
}

function pressureLevel(ratio: number): ExitPressureLevel {
  if (ratio >= 5) return 'SEVERE';
  if (ratio >= 3) return 'HIGH';
  if (ratio >= 1.5) return 'ELEVATED';
  if (ratio >= 0.5) return 'MODERATE';
  return 'LOW';
}

export interface StressTestInput {
  context: ExitabilityContext;
  liquidity: LiquidityQuality;
  normalExitability: number;
}

export function runStressTests(input: StressTestInput): StressTestReport {
  const { context, liquidity, normalExitability } = input;
  const observedAt = context.observedAt;
  const holders = [...(context.holders ?? [])].sort((a, b) => b.balanceUsd - a.balanceUsd);
  const totalHeldUsd = holders.reduce((total, holder) => total + holder.balanceUsd, 0);
  const topHolderUsd = holders[0]?.balanceUsd ?? 0;

  // Large single-holder exits (spec §26): top holder sells X% of its position.
  const largeHolderScenarios: StressScenario[] = LARGE_HOLDER_FRACTIONS.map((fraction) =>
    simulateScenario(
      context.pools,
      liquidity,
      round(topHolderUsd * fraction, 2),
      `top_holder_${Math.round(fraction * 100)}pct`,
      `Top holder sells ${round(fraction * 100, 0)}% of position`,
    ),
  );

  // Mass simultaneous exits (spec §27).
  const massExitScenarios: StressScenario[] = MASS_EXIT_FRACTIONS.map((fraction) => {
    const count = Math.max(1, Math.ceil(holders.length * fraction));
    const sellUsd = round(holders.slice(0, count).reduce((total, holder) => total + holder.balanceUsd, 0), 2);
    return simulateScenario(
      context.pools,
      liquidity,
      sellUsd,
      `mass_exit_${Math.round(fraction * 100)}pct`,
      `${round(fraction * 100, 0)}% of holders exit simultaneously`,
    );
  });

  const worstMassImpact = Math.max(0, ...massExitScenarios.map((scenario) => scenario.priceImpactPct));
  const stressExitability = Math.round(clamp(normalExitability - Math.min(60, worstMassImpact * 1.2)));
  const liquidityShockDetected = worstMassImpact >= 25 || liquidity.stabilityScore < 40;

  const signals = buildStressSignals(massExitScenarios, normalExitability, stressExitability, observedAt);

  return {
    tokenId: context.tokenId,
    chain: context.chain,
    normalExitability,
    stressExitability,
    largeHolderScenarios,
    massExitScenarios,
    liquidityShockDetected,
    signals,
    limitations: totalHeldUsd <= 0 ? ['Holder balances unavailable; stress tests are limited.'] : [],
    generatedAt: observedAt,
  };
}

function simulateScenario(
  pools: PoolState[],
  liquidity: LiquidityQuality,
  sellUsd: number,
  id: string,
  label: string,
): StressScenario {
  const route = buildBestRoute({ pools, side: 'SELL', inputUsd: sellUsd, slippagePct: 0 });
  const remainingLiquidityUsd = round(Math.max(0, liquidity.usableLiquidityUsd - sellUsd), 2);
  const expectedExecutionPriceUsd = round(route.outputUsd / Math.max(sellUsd, 1e-9), 6);

  return {
    id,
    label,
    sellUsd: round(sellUsd, 2),
    expectedProceedsUsd: route.outputUsd,
    priceImpactPct: route.priceImpactPct,
    remainingLiquidityUsd,
    expectedExecutionPriceUsd,
    isSimulation: true,
  };
}

function buildStressSignals(
  massExitScenarios: StressScenario[],
  normalExitability: number,
  stressExitability: number,
  observedAt: string,
): ExitabilitySignal[] {
  const signals: ExitabilitySignal[] = [];
  const drop = normalExitability - stressExitability;

  if (drop >= 20) {
    signals.push({
      type: 'STRESS_EXITABILITY_GAP',
      severity: drop >= 40 ? 'CRITICAL' : 'HIGH',
      polarity: 'NEGATIVE',
      value: drop,
      confidence: 0.78,
      evidence: [
        evidence(
          `Exitability falls from ${normalExitability} to ${stressExitability} under simultaneous-exit stress`,
          'stress_simulation',
          observedAt,
          drop,
          0.78,
        ),
      ],
    });
  }

  const severe = massExitScenarios.find((scenario) => scenario.priceImpactPct >= 40);
  if (severe) {
    signals.push({
      type: 'MASS_EXIT_COLLAPSE',
      severity: 'CRITICAL',
      polarity: 'NEGATIVE',
      value: round(severe.priceImpactPct, 1),
      confidence: 0.75,
      evidence: [
        evidence(
          `${severe.label} would incur an estimated ${round(severe.priceImpactPct, 0)}% price impact`,
          'stress_simulation',
          observedAt,
          severe.priceImpactPct,
          0.75,
        ),
      ],
    });
  }

  return signals;
}

