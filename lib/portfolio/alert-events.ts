/**
 * Portfolio Alerts Foundation (spec §31, §32, §63)
 *
 * Turns detected changes and portfolio-level conditions into structured alert
 * events for the Smart Alerts system, plus a rule evaluator so users can
 * express thresholds like "alert me when any position's exitability falls
 * below 50".
 *
 * Every event is an observation. `isAdvisory` is permanently false: the
 * intelligence layer surfaces "risk increased", never "sell this".
 */

import type {
  ExposureReport,
  PortfolioAlertEvent,
  PortfolioAlertRule,
  PortfolioAlertType,
  PortfolioRiskScore,
  Position,
  PositionChange,
} from './types';
import { evidence, hasValue, round } from './utils';

export interface AlertBuildInput {
  portfolioId: string;
  positions: Position[];
  changes: PositionChange[];
  exposure: ExposureReport;
  risk: PortfolioRiskScore;
  rules?: PortfolioAlertRule[];
  observedAt: string;
}

/**
 * Allocation at which a concentration warning is raised. A quarter of the
 * portfolio in one token is the point at which single-token risk starts to
 * dominate portfolio risk, so that is where the observation surfaces.
 */
export const CONCENTRATION_WARNING_PCT = 0.25;

export function buildPortfolioAlertEvents(input: AlertBuildInput): PortfolioAlertEvent[] {
  const events: PortfolioAlertEvent[] = [];
  const positionsById = new Map(input.positions.map((position) => [position.id, position]));

  // ── Change-driven alerts ──
  for (const detected of input.changes) {
    const type = mapChangeToAlert(detected.type);
    if (!type) continue;
    const position = positionsById.get(detected.positionId);
    events.push({
      type,
      portfolioId: input.portfolioId,
      positionId: detected.positionId,
      tokenId: detected.tokenId,
      symbol: detected.symbol,
      chain: position?.chain,
      severity: detected.severity,
      title: detected.title,
      isAdvisory: false,
      evidence: detected.evidence,
      confidence: detected.confidence,
      metadata: {
        detail: detected.detail,
        previousValue: detected.previousValue,
        currentValue: detected.currentValue,
        deltaPct: detected.deltaPct,
        allocationPct: position?.allocationPct ?? null,
      },
      occurredAt: detected.detectedAt,
    });
  }

  // ── Concentration warning (spec §18, §31) ──
  const largest = input.exposure.concentration.largestPositionPct;
  if (largest !== null && largest >= CONCENTRATION_WARNING_PCT) {
    const position = positionsById.get(input.exposure.concentration.largestPositionId ?? '');
    events.push({
      type: 'CONCENTRATION_WARNING',
      portfolioId: input.portfolioId,
      positionId: position?.id,
      tokenId: position?.tokenId,
      symbol: position?.symbol,
      chain: position?.chain,
      severity: largest >= 0.6 ? 'critical' : 'warning',
      title: `${round(largest * 100, 0)}% of the portfolio is concentrated in ${position?.symbol ?? 'a single token'}`,
      isAdvisory: false,
      evidence: [
        evidence(
          'Largest position share of measured portfolio value',
          'exposure_engine',
          input.observedAt,
          round(largest * 100, 1),
          0.9,
        ),
      ],
      confidence: 0.9,
      metadata: {
        largestPositionPct: largest,
        top3Pct: input.exposure.concentration.top3Pct,
        herfindahl: input.exposure.concentration.herfindahl,
      },
      occurredAt: input.observedAt,
    });
  }

  // ── Rule-driven alerts (spec §32) ──
  for (const rule of input.rules ?? []) {
    events.push(...evaluateRule(rule, input));
  }

  return dedupe(events).sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );
}

/**
 * Evaluates one user-configured rule against the current portfolio.
 *
 * Exposed separately so the Smart Alerts worker can evaluate rules on a
 * different cadence than the portfolio pipeline.
 */
export function evaluateRule(rule: PortfolioAlertRule, input: AlertBuildInput): PortfolioAlertEvent[] {
  if (!rule.enabled) return [];

  const events: PortfolioAlertEvent[] = [];

  if (rule.metric === 'PORTFOLIO_RISK') {
    if (compare(input.risk.score, rule.operator, rule.threshold)) {
      events.push(
        portfolioEvent(
          'POSITION_RISK_INCREASED',
          input,
          `Portfolio risk is ${input.risk.score}, which ${describe(rule.operator)} your threshold of ${rule.threshold}`,
          input.risk.drivers.flatMap((driver) => driver.evidence).slice(0, 3),
          input.risk.confidence,
          { ruleId: rule.id, metric: rule.metric, threshold: rule.threshold, value: input.risk.score },
        ),
      );
    }
    return events;
  }

  if (rule.metric === 'PORTFOLIO_CONCENTRATION_PCT') {
    const value = (input.exposure.concentration.largestPositionPct ?? 0) * 100;
    if (compare(value, rule.operator, rule.threshold)) {
      events.push(
        portfolioEvent(
          'CONCENTRATION_WARNING',
          input,
          `Largest position is ${round(value, 1)}% of the portfolio, which ${describe(rule.operator)} your threshold of ${rule.threshold}%`,
          [evidence('Largest position share', 'exposure_engine', input.observedAt, round(value, 1), 0.9)],
          0.9,
          { ruleId: rule.id, metric: rule.metric, threshold: rule.threshold, value },
        ),
      );
    }
    return events;
  }

  for (const position of input.positions) {
    if (rule.tokenId && position.tokenId !== rule.tokenId) continue;
    if (
      rule.minAllocationPct !== undefined &&
      (position.allocationPct === null || position.allocationPct * 100 < rule.minAllocationPct)
    ) {
      continue;
    }

    const value = positionMetric(position, rule.metric);
    if (value === null || !compare(value, rule.operator, rule.threshold)) continue;

    events.push({
      type: alertTypeForMetric(rule.metric),
      portfolioId: input.portfolioId,
      positionId: position.id,
      tokenId: position.tokenId,
      symbol: position.symbol,
      chain: position.chain,
      severity: 'warning',
      title: `${position.symbol} ${metricLabel(rule.metric)} is ${round(value, 1)}, which ${describe(rule.operator)} your threshold of ${rule.threshold}`,
      isAdvisory: false,
      evidence: [
        evidence(
          `${metricLabel(rule.metric)} for ${position.symbol}`,
          'portfolio_alert_rule',
          input.observedAt,
          round(value, 2),
          0.85,
        ),
      ],
      confidence: 0.85,
      metadata: {
        ruleId: rule.id,
        metric: rule.metric,
        operator: rule.operator,
        threshold: rule.threshold,
        value: round(value, 4),
        allocationPct: position.allocationPct,
      },
      occurredAt: input.observedAt,
    });
  }

  return events;
}

function positionMetric(position: Position, metric: PortfolioAlertRule['metric']): number | null {
  switch (metric) {
    case 'POSITION_EXITABILITY':
      return position.exitability?.score ?? null;
    case 'POSITION_RISK':
      return position.risk.score;
    case 'POSITION_ALLOCATION_PCT':
      return position.allocationPct !== null ? position.allocationPct * 100 : null;
    case 'POSITION_LIQUIDITY_RATIO':
      return position.liquidityAdjusted?.liquidityRatio ?? null;
    case 'POSITION_NET_PNL_PCT':
      return position.pnl.netReturnPct !== null ? position.pnl.netReturnPct * 100 : null;
    default:
      return null;
  }
}

function alertTypeForMetric(metric: PortfolioAlertRule['metric']): PortfolioAlertType {
  switch (metric) {
    case 'POSITION_EXITABILITY':
      return 'EXITABILITY_DROP';
    case 'POSITION_LIQUIDITY_RATIO':
      return 'LIQUIDITY_DROP';
    case 'POSITION_ALLOCATION_PCT':
    case 'PORTFOLIO_CONCENTRATION_PCT':
      return 'CONCENTRATION_WARNING';
    case 'POSITION_NET_PNL_PCT':
      return 'LARGE_PNL_MOVE';
    default:
      return 'POSITION_RISK_INCREASED';
  }
}

function metricLabel(metric: PortfolioAlertRule['metric']): string {
  switch (metric) {
    case 'POSITION_EXITABILITY':
      return 'exitability';
    case 'POSITION_RISK':
      return 'risk score';
    case 'POSITION_ALLOCATION_PCT':
      return 'allocation';
    case 'POSITION_LIQUIDITY_RATIO':
      return 'size vs usable liquidity';
    case 'POSITION_NET_PNL_PCT':
      return 'net return';
    case 'PORTFOLIO_RISK':
      return 'portfolio risk';
    default:
      return 'concentration';
  }
}

function portfolioEvent(
  type: PortfolioAlertType,
  input: AlertBuildInput,
  title: string,
  ev: PortfolioAlertEvent['evidence'],
  confidence: number,
  metadata: Record<string, unknown>,
): PortfolioAlertEvent {
  return {
    type,
    portfolioId: input.portfolioId,
    severity: 'warning',
    title,
    isAdvisory: false,
    evidence: ev,
    confidence,
    metadata,
    occurredAt: input.observedAt,
  };
}

function mapChangeToAlert(type: PositionChange['type']): PortfolioAlertType | null {
  switch (type) {
    case 'RISK_INCREASED':
      return 'POSITION_RISK_INCREASED';
    case 'RISK_DECREASED':
      return 'POSITION_RISK_DECREASED';
    case 'EXITABILITY_DROP':
      return 'EXITABILITY_DROP';
    case 'LIQUIDITY_DROP':
      return 'LIQUIDITY_DROP';
    case 'WHALE_EXIT':
      return 'WHALE_EXIT';
    case 'CREATOR_SELL':
      return 'CREATOR_SELL';
    case 'POTENTIAL_COORDINATION':
      return 'POTENTIAL_COORDINATION';
    case 'LARGE_PNL_MOVE':
      return 'LARGE_PNL_MOVE';
    default:
      return null;
  }
}

function compare(value: number, operator: PortfolioAlertRule['operator'], threshold: number): boolean {
  switch (operator) {
    case 'LT':
      return value < threshold;
    case 'LTE':
      return value <= threshold;
    case 'GT':
      return value > threshold;
    case 'GTE':
      return value >= threshold;
    default:
      return false;
  }
}

function describe(operator: PortfolioAlertRule['operator']): string {
  switch (operator) {
    case 'LT':
      return 'is below';
    case 'LTE':
      return 'is at or below';
    case 'GT':
      return 'is above';
    case 'GTE':
      return 'is at or above';
    default:
      return 'crosses';
  }
}

function dedupe(events: PortfolioAlertEvent[]): PortfolioAlertEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.type}|${event.positionId ?? 'portfolio'}|${event.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function severityRank(severity: PortfolioAlertEvent['severity']): number {
  return severity === 'critical' ? 3 : severity === 'warning' ? 2 : 1;
}

/** Positions whose value could not be established are worth flagging to the user. */
export function unvaluedPositionWarnings(positions: Position[]): string[] {
  return positions
    .filter((position) => !hasValue(position.valuation.markValue) && position.status !== 'CLOSED')
    .map(
      (position) =>
        `${position.symbol}: VALUE_UNAVAILABLE — ${position.valuation.price.priceSource === 'none' ? 'no price source served this token' : 'the available price failed the freshness check'}.`,
    );
}
