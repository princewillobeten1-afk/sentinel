/**
 * Portfolio Snapshots (spec §34, §35, §47)
 *
 * Historical analytics need a consistent series. These builders capture the
 * portfolio at a point in time so charts, drawdown and windowed P&L all read
 * from the same source rather than each recomputing from raw events.
 *
 * Snapshots record `null` where a value was not determinable. A chart that
 * silently interpolates over missing data would misrepresent history.
 */

import type {
  ExposureReport,
  ExposureSnapshot,
  PerformanceReport,
  PnlSnapshot,
  PortfolioOverview,
  PortfolioRiskScore,
  PortfolioSnapshot,
  Position,
  RiskClass,
  RiskSnapshot,
  ValuePoint,
} from './types';
import { hasValue, round } from './utils';

export function buildPortfolioSnapshot(
  overview: PortfolioOverview,
  positions: Position[],
): PortfolioSnapshot {
  return {
    portfolioId: overview.portfolioId,
    markValueUsd: hasValue(overview.totalValue) ? round(overview.totalValue.usd, 2) : null,
    estimatedExitValueUsd: hasValue(overview.estimatedExitValue)
      ? round(overview.estimatedExitValue.usd, 2)
      : null,
    stressExitValueUsd: hasValue(overview.stressExitValue) ? round(overview.stressExitValue.usd, 2) : null,
    investedCapitalUsd: hasValue(overview.investedCapital) ? round(overview.investedCapital.usd, 2) : null,
    positionCount: positions.filter((position) => position.status !== 'CLOSED').length,
    riskScore: overview.riskScore,
    confidence: round(overview.totalValue.confidence, 3),
    capturedAt: overview.generatedAt,
  };
}

export function buildPnlSnapshot(overview: PortfolioOverview): PnlSnapshot {
  return {
    portfolioId: overview.portfolioId,
    realizedUsd: hasValue(overview.realizedPnl) ? round(overview.realizedPnl.usd, 2) : null,
    unrealizedUsd: hasValue(overview.unrealizedPnl) ? round(overview.unrealizedPnl.usd, 2) : null,
    netUsd: hasValue(overview.netPnl) ? round(overview.netPnl.usd, 2) : null,
    feesUsd: round(overview.fees.totalUsd, 2),
    capturedAt: overview.generatedAt,
  };
}

export function buildRiskSnapshot(risk: PortfolioRiskScore): RiskSnapshot {
  return {
    portfolioId: risk.portfolioId,
    score: risk.score,
    band: risk.band,
    weightedPositionRisk: risk.weightedPositionRisk,
    concentrationPenalty: risk.concentrationPenalty,
    liquidityPenalty: risk.liquidityPenalty,
    correlationPenalty: risk.correlationPenalty,
    capturedAt: risk.generatedAt,
  };
}

export function buildExposureSnapshot(exposure: ExposureReport): ExposureSnapshot {
  return {
    portfolioId: exposure.portfolioId,
    largestPositionPct: exposure.concentration.largestPositionPct,
    top3Pct: exposure.concentration.top3Pct,
    top5Pct: exposure.concentration.top5Pct,
    herfindahl: exposure.concentration.herfindahl,
    byChain: exposure.byChain.map((bucket) => ({ chain: bucket.key, sharePct: bucket.sharePct })),
    byRiskClass: exposure.byRiskClass.map((bucket) => ({
      riskClass: bucket.key as RiskClass,
      sharePct: bucket.sharePct,
    })),
    capturedAt: exposure.generatedAt,
  };
}

/**
 * Appends the current state to the historical series used by the P&L chart
 * (spec §34). The caller owns persistence; this only produces the point.
 */
export function toValuePoint(overview: PortfolioOverview): ValuePoint {
  return {
    at: overview.generatedAt,
    markValueUsd: hasValue(overview.totalValue) ? round(overview.totalValue.usd, 2) : null,
    estimatedExitValueUsd: hasValue(overview.estimatedExitValue)
      ? round(overview.estimatedExitValue.usd, 2)
      : null,
    netPnlUsd: hasValue(overview.netPnl) ? round(overview.netPnl.usd, 2) : null,
  };
}

/**
 * Portfolio value and net P&L series for the chart (spec §34). Points with no
 * value stay null so the chart can render a gap rather than a fabricated line.
 */
export function buildValueSeries(history: ValuePoint[], current: ValuePoint): ValuePoint[] {
  const series = [...history, current].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const seen = new Set<string>();
  return series.filter((point) => {
    if (seen.has(point.at)) return false;
    seen.add(point.at);
    return true;
  });
}

export interface PerformanceMetricRow {
  portfolioId: string;
  window: string;
  metric: string;
  value: number | null;
  sampleCount: number;
  sampleAdequacy: string;
  capturedAt: string;
}

/**
 * Flattens the performance report into persistable metric rows. Sample size
 * travels with every row so a stored metric can never be read without it.
 */
export function buildPerformanceMetricRows(report: PerformanceReport): PerformanceMetricRow[] {
  const rows: PerformanceMetricRow[] = [];

  for (const window of report.windows) {
    const metrics: Array<[string, { value: number | null; sample: { count: number; adequacy: string } }]> = [
      ['WIN_RATE', window.trading.winRate],
      ['AVERAGE_RETURN_PCT', window.trading.averageReturnPct],
      ['MEDIAN_RETURN_PCT', window.trading.medianReturnPct],
      ['AVERAGE_WINNER_USD', window.trading.averageWinnerUsd],
      ['AVERAGE_LOSER_USD', window.trading.averageLoserUsd],
      ['PROFIT_FACTOR', window.trading.profitFactor],
      ['EXPECTANCY_USD', window.trading.expectancyUsd],
      ['SHARPE_LIKE', window.trading.sharpeLike],
      ['SORTINO_LIKE', window.trading.sortinoLike],
      ['AVERAGE_HOLDING_HOURS', window.holding.averageHours],
      ['MEDIAN_HOLDING_HOURS', window.holding.medianHours],
    ];

    for (const [metric, sampledMetric] of metrics) {
      rows.push({
        portfolioId: report.portfolioId,
        window: window.window,
        metric,
        value: sampledMetric.value,
        sampleCount: sampledMetric.sample.count,
        sampleAdequacy: sampledMetric.sample.adequacy,
        capturedAt: report.generatedAt,
      });
    }

    rows.push({
      portfolioId: report.portfolioId,
      window: window.window,
      metric: 'MAX_DRAWDOWN_PCT',
      value: window.drawdown.maxDrawdownPct,
      sampleCount: window.drawdown.sample.count,
      sampleAdequacy: window.drawdown.sample.adequacy,
      capturedAt: report.generatedAt,
    });
  }

  return rows;
}
