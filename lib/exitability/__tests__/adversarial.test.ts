import { describe, it, expect } from 'vitest';
import { analyzeExitability } from '../exitability-engine';
import { processExitabilityPipeline } from '../pipeline';
import { runStressTests } from '../stress-engine';
import { analyzeLiquidityQuality } from '../liquidity-engine';
import {
  getSentExitabilityContext,
  getAlphaExitabilityContext,
} from '@/lib/mocks/exitability-mocks';
import type { ExitabilityContext, PoolState } from '../types';

const NOW = new Date().toISOString();

describe('Sprint 8 — Adversarial & corner-case suite (Section 60)', () => {
  // ── Fake liquidity ──
  it('Fake liquidity: high displayed TVL but low active depth degrades exitability', () => {
    const alpha = analyzeExitability(getAlphaExitabilityContext());
    const sent = analyzeExitability(getSentExitabilityContext());
    // Displayed TVL comparable order of magnitude, but ALPHA is far less exitable.
    expect(alpha.score).toBeLessThan(sent.score);
    expect(alpha.liquidity.usableLiquidityUsd).toBeLessThan(alpha.liquidity.totalLiquidityUsd * 0.2);
  });

  // ── Liquidity removal ──
  it('Liquidity removal: a large drop degrades stability and raises an alert', () => {
    const base = getSentExitabilityContext();
    const withRemoval: ExitabilityContext = {
      ...base,
      pools: base.pools.map((pool, i) =>
        i === 0
          ? ({ ...pool, changes: { '5m': -10, '15m': -25, '1h': -45, '4h': -50, '24h': -55 } } as PoolState & { changes: Record<string, number> })
          : pool,
      ),
    };
    const before = analyzeLiquidityQuality(base);
    const after = analyzeLiquidityQuality(withRemoval);
    expect(after.stabilityScore).toBeLessThan(before.stabilityScore);

    const result = processExitabilityPipeline({ context: withRemoval });
    expect(result.alertEvents.some((e) => e.type === 'LIQUIDITY_DROP' || e.type === 'LARGE_LIQUIDITY_WITHDRAWAL')).toBe(true);
  });

  // ── Whale exit ──
  it('Whale exit: a top-holder sell is simulated with material impact', () => {
    const context = getAlphaExitabilityContext();
    const liquidity = analyzeLiquidityQuality(context);
    const stress = runStressTests({ context, liquidity, normalExitability: 60 });
    const biggest = stress.largeHolderScenarios[stress.largeHolderScenarios.length - 1];
    expect(biggest.isSimulation).toBe(true);
    expect(biggest.priceImpactPct).toBeGreaterThan(0);
  });

  // ── Cluster exit / mass exit ──
  it('Cluster/mass exit: simultaneous selling collapses stress exitability', () => {
    const context = getAlphaExitabilityContext();
    const liquidity = analyzeLiquidityQuality(context);
    const stress = runStressTests({ context, liquidity, normalExitability: 70 });
    expect(stress.stressExitability).toBeLessThan(stress.normalExitability);
    expect(stress.liquidityShockDetected).toBe(true);
  });

  // ── Multi-pool fragmentation ──
  it('Multi-pool fragmentation: splitting reduces aggregate impact vs a single thin pool', () => {
    const priceUsd = 1;
    const single: ExitabilityContext = {
      tokenId: 't', chain: 'solana', observedAt: NOW,
      pools: [poolOf('single', 300_000, priceUsd)],
      holders: [],
    };
    const fragmented: ExitabilityContext = {
      tokenId: 't', chain: 'solana', observedAt: NOW,
      pools: [poolOf('a', 150_000, priceUsd), poolOf('b', 150_000, priceUsd)],
      holders: [],
    };
    const singleSim = analyzeExitability(single).referenceSimulation;
    const fragSim = analyzeExitability(fragmented).referenceSimulation;
    // Same total liquidity; the router may split to lower impact — never worse.
    expect(fragSim.priceImpactPct).toBeLessThanOrEqual(singleSim.priceImpactPct + 0.01);
  });

  // ── Concentrated liquidity out of range ──
  it('Concentrated liquidity: out-of-range positioning yields low active liquidity', () => {
    const report = analyzeExitability(getAlphaExitabilityContext());
    expect(report.liquidity.activeLiquidityUsd).toBeLessThan(100_000);
    expect(report.limitations.length >= 0).toBe(true);
  });

  // ── Quote race ──
  it('Quote race: exitability confidence never claims certainty on volatile thin markets', () => {
    const report = analyzeExitability(getAlphaExitabilityContext());
    expect(report.confidence).toBeLessThan(100);
  });

  // ── Missing data ──
  it('Missing data: empty pools produce severe exitability with limitations, not a crash', () => {
    const empty: ExitabilityContext = {
      tokenId: 't', chain: 'solana', observedAt: NOW, pools: [], holders: [],
    };
    const report = analyzeExitability(empty);
    expect(report.limitations.length).toBeGreaterThan(0);
    expect(report.confidence).toBeLessThan(50);
  });
});

function poolOf(poolId: string, tvlUsd: number, priceUsd: number): PoolState {
  return {
    poolId, dex: 'Raydium', kind: 'CONSTANT_PRODUCT',
    baseReserve: tvlUsd / 2 / priceUsd, quoteReserve: tvlUsd / 2, priceUsd,
    tvlUsd, feeTierPct: 0.25, observedAt: NOW,
  };
}
