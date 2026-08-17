import { describe, it, expect } from 'vitest';
import { analyzeExitability } from '../exitability-engine';
import { processExitabilityPipeline } from '../pipeline';
import {
  getSentExitabilityContext,
  getQuantExitabilityContext,
  getAlphaExitabilityContext,
} from '@/lib/mocks/exitability-mocks';

describe('Sprint 8 — Exitability engine', () => {
  it('produces a 0–100 score, confidence, and an interpretation', () => {
    const report = analyzeExitability(getSentExitabilityContext());
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.confidence).toBeGreaterThan(0);
    expect(report.interpretation).toBeDefined();
    expect(report.explanation.length).toBeGreaterThan(20);
  });

  it('is position-specific: exitability decreases as position size grows', () => {
    const report = analyzeExitability(getSentExitabilityContext());
    const scores = report.curve.map((point) => point.exitabilityScore);
    // Monotonic non-increasing across ascending sizes.
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1] + 1);
    }
    // Small position should score meaningfully higher than the largest.
    expect(scores[0]).toBeGreaterThan(scores[scores.length - 1]);
  });

  it('healthy deep liquidity scores higher than thin declining liquidity', () => {
    const sent = analyzeExitability(getSentExitabilityContext());
    const quant = analyzeExitability(getQuantExitabilityContext());
    expect(sent.score).toBeGreaterThan(quant.score);
  });

  it('exposes exit depth increasing with the impact threshold', () => {
    const report = analyzeExitability(getSentExitabilityContext());
    const depth = report.exitDepth;
    expect(depth.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < depth.length; i++) {
      expect(depth[i].absorbableUsd).toBeGreaterThanOrEqual(depth[i - 1].absorbableUsd);
    }
  });

  it('reports stress exitability at or below normal exitability', () => {
    const result = processExitabilityPipeline({ context: getSentExitabilityContext() });
    expect(result.exitability.stressScore).toBeLessThanOrEqual(result.exitability.score);
    expect(result.stress.largeHolderScenarios.length).toBeGreaterThan(0);
    expect(result.stress.massExitScenarios.length).toBeGreaterThan(0);
  });

  it('flags fake liquidity: usable liquidity far below displayed TVL', () => {
    const report = analyzeExitability(getAlphaExitabilityContext());
    expect(report.liquidity.usableLiquidityUsd).toBeLessThan(report.liquidity.totalLiquidityUsd * 0.3);
    expect(report.liquidity.signals.some((s) => s.type === 'USABLE_LIQUIDITY_GAP')).toBe(true);
  });

  it('personalizes the reference position from the user holding', () => {
    const context = getSentExitabilityContext();
    const report = analyzeExitability(context);
    expect(report.referencePositionUsd).toBe(context.userPositionUsd);
    expect(report.referenceSimulation.isSimulation).toBe(true);
  });
});
