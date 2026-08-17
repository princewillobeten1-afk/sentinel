/**
 * Exitability Smart Alert events (spec §16, §29, §51).
 * These feed the Smart Alerts system and Token Intelligence timeline.
 */

import type {
  ExitabilityAlertEvent,
  ExitabilityReport,
  LiquidityQuality,
  StressTestReport,
} from './types';
import { evidence, round } from './utils';

export function buildExitabilityAlertEvents(
  report: ExitabilityReport,
  stress: StressTestReport,
  previous?: ExitabilityReport,
): ExitabilityAlertEvent[] {
  const events: ExitabilityAlertEvent[] = [];
  const occurredAt = report.generatedAt;
  const liquidity = report.liquidity;

  // EXITABILITY_DROP (spec §50, §51)
  if (previous && previous.score - report.score >= 10) {
    events.push(event(
      'EXITABILITY_DROP',
      report,
      previous.score - report.score >= 20 ? 'critical' : 'warning',
      `Exitability dropped from ${previous.score} to ${report.score}`,
      report.signals.flatMap((signal) => signal.evidence).slice(0, 4),
      report.confidence / 100,
      { previousScore: previous.score, currentScore: report.score },
    ));
  }

  // LIQUIDITY_DROP / LARGE_LIQUIDITY_WITHDRAWAL (spec §16)
  const worstDrop = Math.min(0, ...liquidity.liquidityChanges.map((change) => change.changePct));
  if (worstDrop <= -20) {
    events.push(event(
      worstDrop <= -40 ? 'LARGE_LIQUIDITY_WITHDRAWAL' : 'LIQUIDITY_DROP',
      report,
      worstDrop <= -35 ? 'critical' : 'warning',
      `Liquidity declined ${round(Math.abs(worstDrop), 1)}% in a recent window`,
      liquidity.signals.filter((signal) => signal.type === 'LIQUIDITY_DECLINE').flatMap((signal) => signal.evidence),
      0.85,
      { worstDropPct: worstDrop },
    ));
  }

  // EXIT_DEPTH_COLLAPSE
  const fivePctDepth = report.exitDepth.find((point) => point.impactPct === 5);
  const prevFivePctDepth = previous?.exitDepth.find((point) => point.impactPct === 5);
  if (fivePctDepth && prevFivePctDepth && prevFivePctDepth.absorbableUsd > 0
    && fivePctDepth.absorbableUsd < prevFivePctDepth.absorbableUsd * 0.6) {
    events.push(event(
      'EXIT_DEPTH_COLLAPSE',
      report,
      'critical',
      `5% exit depth fell from ${Math.round(prevFivePctDepth.absorbableUsd)} to ${Math.round(fivePctDepth.absorbableUsd)}`,
      [evidence('Exit depth at the 5% impact threshold collapsed materially', 'exit_depth', occurredAt, fivePctDepth.absorbableUsd, 0.8)],
      0.8,
      { previousDepthUsd: prevFivePctDepth.absorbableUsd, currentDepthUsd: fivePctDepth.absorbableUsd },
    ));
  }

  // SLIPPAGE_SPIKE
  if (report.referenceSimulation.slippagePct >= 10) {
    events.push(event(
      'SLIPPAGE_SPIKE',
      report,
      report.referenceSimulation.slippagePct >= 20 ? 'critical' : 'warning',
      `Estimated slippage for the reference position is ${round(report.referenceSimulation.slippagePct, 1)}%`,
      [evidence(`Reference exit slippage ${round(report.referenceSimulation.slippagePct, 1)}%`, 'exit_simulation', occurredAt, report.referenceSimulation.slippagePct, 0.82)],
      0.82,
      { slippagePct: report.referenceSimulation.slippagePct },
    ));
  }

  // POOL_CONCENTRATION_CHANGE
  if (previous && report.liquidity.topPoolShare - previous.liquidity.topPoolShare >= 0.2) {
    events.push(event(
      'POOL_CONCENTRATION_CHANGE',
      report,
      'warning',
      `Usable liquidity concentration rose to ${round(report.liquidity.topPoolShare * 100, 0)}% in one pool`,
      liquidity.signals.filter((signal) => signal.type === 'POOL_CONCENTRATION').flatMap((signal) => signal.evidence),
      0.78,
      { previousTopPoolShare: previous.liquidity.topPoolShare, currentTopPoolShare: report.liquidity.topPoolShare },
    ));
  }

  // STRESS_EXITABILITY_DROP (spec §28)
  if (stress.normalExitability - stress.stressExitability >= 25) {
    events.push(event(
      'STRESS_EXITABILITY_DROP',
      report,
      stress.normalExitability - stress.stressExitability >= 40 ? 'critical' : 'warning',
      `Stress exitability (${stress.stressExitability}) is far below normal (${stress.normalExitability})`,
      stress.signals.flatMap((signal) => signal.evidence).slice(0, 4),
      0.76,
      { normalExitability: stress.normalExitability, stressExitability: stress.stressExitability },
    ));
  }

  return events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

function event(
  type: ExitabilityAlertEvent['type'],
  report: ExitabilityReport,
  severity: ExitabilityAlertEvent['severity'],
  title: string,
  ev: ExitabilityAlertEvent['evidence'],
  confidence: number,
  metadata: Record<string, unknown>,
): ExitabilityAlertEvent {
  return {
    type,
    tokenId: report.tokenId,
    chain: report.chain,
    severity,
    title,
    evidence: ev,
    confidence: round(Math.max(0, Math.min(1, confidence)), 3),
    metadata: { ...metadata, window: report.referencePositionUsd },
    occurredAt: report.generatedAt,
  };
}
