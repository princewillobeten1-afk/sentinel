/**
 * Portfolio Performance Engine (spec §21–§26, §35, §36, §37)
 *
 * Produces windowed P&L, trading statistics, holding-period analysis,
 * drawdown, performance/loss attribution and execution-cost analysis.
 *
 * Two rules run through the whole file:
 *  - Every metric carries its sample size, and metrics that are statistically
 *    meaningless at the observed sample are suppressed rather than displayed
 *    with a footnote (spec §36, §37).
 *  - Attribution is descriptive. We report what coincided with gains and
 *    losses; we do not assert causality the data cannot support (spec §23).
 */

import type {
  AttributionEntry,
  AttributionReport,
  DrawdownAnalysis,
  ExecutionCostRecord,
  ExecutionCostSummary,
  FeeBreakdown,
  HoldingPeriodStats,
  HoldingThresholds,
  PerformanceReport,
  PerformanceWindow,
  Position,
  RealizedPnlEntry,
  StrategyTag,
  TradingPerformance,
  ValuePoint,
  WindowPerformance,
} from './types';
import {
  DEFAULT_HOLDING_THRESHOLDS,
  PERFORMANCE_VERSION,
  SAMPLE_GATES,
  addFees,
  downsideDeviation,
  emptyFees,
  hasValue,
  holdingBucket,
  known,
  mean,
  median,
  round,
  safeDivide,
  sampleSize,
  sampled,
  stdev,
  suppressedBelow,
  sum,
  toTimestamp,
  unknownValue,
  zero,
} from './utils';

export interface PerformanceInput {
  portfolioId: string;
  positions: Position[];
  history: ValuePoint[];
  holdingThresholds?: HoldingThresholds;
  observedAt: string;
}

const WINDOWS: PerformanceWindow[] = ['TODAY', '7D', '30D', 'ALL'];

export function buildPerformance(input: PerformanceInput): PerformanceReport {
  const thresholds = input.holdingThresholds ?? DEFAULT_HOLDING_THRESHOLDS;
  const now = toTimestamp(input.observedAt);

  const allEntries = input.positions.flatMap((position) =>
    position.realizedEntries.map((entry) => ({ entry, position })),
  );

  const windows = WINDOWS.map((window) =>
    buildWindow(window, allEntries, input, thresholds, now),
  );

  const executionCosts = summarizeExecutionCosts(
    input.positions.flatMap((position) => position.executionCosts ?? []),
  );

  return {
    portfolioId: input.portfolioId,
    windows,
    attribution: buildAttribution(input.positions, executionCosts),
    executionCosts,
    limitations: buildLimitations(input, windows),
    version: PERFORMANCE_VERSION,
    generatedAt: input.observedAt,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Windows
// ────────────────────────────────────────────────────────────────────────────

function windowStart(window: PerformanceWindow, now: number): number {
  switch (window) {
    case 'TODAY': {
      const date = new Date(now);
      date.setUTCHours(0, 0, 0, 0);
      return date.getTime();
    }
    case '7D':
      return now - 7 * 86_400_000;
    case '30D':
      return now - 30 * 86_400_000;
    case 'ALL':
    default:
      return 0;
  }
}

interface EntryWithPosition {
  entry: RealizedPnlEntry;
  position: Position;
}

function buildWindow(
  window: PerformanceWindow,
  allEntries: EntryWithPosition[],
  input: PerformanceInput,
  thresholds: HoldingThresholds,
  now: number,
): WindowPerformance {
  const from = windowStart(window, now);
  const inWindow = allEntries.filter(({ entry }) => toTimestamp(entry.timestamp) >= from);
  const entries = inWindow.map(({ entry }) => entry);

  const realized = entries.length
    ? known(
        round(sum(entries.filter((e) => hasValue(e.grossPnl)).map((e) => e.grossPnl.usd as number)), 2),
        'performance_engine',
        input.observedAt,
        0.9,
      )
    : zero('performance_engine');

  const fees = entries.reduce<FeeBreakdown>((acc, entry) => addFees(acc, entry.fees), emptyFees());

  // Unrealized is a point-in-time property of open positions and is only
  // meaningful for the ALL window; shorter windows use snapshot deltas.
  const unrealized =
    window === 'ALL'
      ? aggregateUnrealized(input.positions)
      : unrealizedFromHistory(input.history, from, now);

  const netUsd =
    hasValue(realized) && hasValue(unrealized)
      ? round(realized.usd + unrealized.usd - fees.totalUsd, 2)
      : null;

  const netPnl =
    netUsd === null
      ? unknownValue('Net P&L for this window needs both realized and unrealized components', 'performance_engine')
      : known(netUsd, 'performance_engine', input.observedAt, 0.85);

  const tradingVolumeUsd = round(
    sum(
      entries.map((entry) => (hasValue(entry.proceeds) ? Math.abs(entry.proceeds.usd as number) : 0)),
    ),
    2,
  );

  return {
    window,
    from: new Date(from).toISOString(),
    to: input.observedAt,
    netPnl,
    realizedPnl: realized,
    unrealizedPnl: unrealized,
    fees,
    tradingVolumeUsd,
    trading: buildTradingPerformance(entries),
    holding: buildHoldingStats(entries, thresholds),
    drawdown: buildDrawdown(input.history, from, now),
    sample: sampleSize(entries.length, SAMPLE_GATES.winRate),
  };
}

function aggregateUnrealized(positions: Position[]) {
  const usable = positions.filter((position) => hasValue(position.pnl.unrealized));
  if (usable.length === 0) {
    return unknownValue('No open position has a computable unrealized P&L', 'performance_engine');
  }
  return known(
    round(sum(usable.map((position) => position.pnl.unrealized.usd as number)), 2),
    'performance_engine',
    undefined,
    0.85,
  );
}

/**
 * For bounded windows, unrealized change is derived from snapshot history so
 * "P&L in the last 7 days" reflects mark movement, not lifetime unrealized.
 */
function unrealizedFromHistory(history: ValuePoint[], from: number, now: number) {
  const inWindow = history
    .filter((point) => toTimestamp(point.at) >= from && toTimestamp(point.at) <= now)
    .sort((a, b) => toTimestamp(a.at) - toTimestamp(b.at));

  if (inWindow.length < 2) {
    return unknownValue(
      'Not enough historical snapshots in this window to measure unrealized change',
      'performance_engine',
    );
  }

  const first = inWindow[0].markValueUsd;
  const last = inWindow[inWindow.length - 1].markValueUsd;
  if (first === null || last === null) {
    return unknownValue('Historical snapshots in this window have no usable value', 'performance_engine');
  }

  return known(round(last - first, 2), 'portfolio_snapshots', inWindow[inWindow.length - 1].at, 0.7);
}

// ────────────────────────────────────────────────────────────────────────────
// Trading performance (spec §25)
// ────────────────────────────────────────────────────────────────────────────

function buildTradingPerformance(entries: RealizedPnlEntry[]): TradingPerformance {
  const usable = entries.filter((entry) => hasValue(entry.netPnl));
  const nets = usable.map((entry) => entry.netPnl.usd as number);
  const n = nets.length;

  const winners = nets.filter((value) => value > 0);
  const losers = nets.filter((value) => value < 0);
  const breakeven = nets.filter((value) => value === 0);

  const returns = usable
    .map((entry) => {
      if (!hasValue(entry.costBasis) || (entry.costBasis.usd as number) <= 0) return null;
      return (entry.netPnl.usd as number) / (entry.costBasis.usd as number);
    })
    .filter((value): value is number => value !== null);

  const grossProfit = sum(winners);
  const grossLoss = Math.abs(sum(losers));

  const returnStdev = stdev(returns);
  const returnMean = mean(returns);
  const downside = downsideDeviation(returns);

  return {
    totalTrades: entries.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    breakevenTrades: breakeven.length,
    winRate: sampled(n > 0 ? winners.length / n : null, n, SAMPLE_GATES.winRate, 'PCT'),
    averageReturnPct: sampled(returnMean, returns.length, SAMPLE_GATES.averageReturn, 'PCT'),
    medianReturnPct: sampled(median(returns), returns.length, SAMPLE_GATES.averageReturn, 'PCT'),
    averageWinnerUsd: sampled(mean(winners), winners.length, Math.ceil(SAMPLE_GATES.winRate / 2), 'USD'),
    averageLoserUsd: sampled(mean(losers), losers.length, Math.ceil(SAMPLE_GATES.winRate / 2), 'USD'),
    bestTradeUsd: nets.length ? round(Math.max(...nets), 2) : null,
    worstTradeUsd: nets.length ? round(Math.min(...nets), 2) : null,
    profitFactor: suppressedBelow(
      grossLoss > 0 ? grossProfit / grossLoss : null,
      n,
      SAMPLE_GATES.profitFactor,
      'RATIO',
    ),
    expectancyUsd: suppressedBelow(mean(nets), n, SAMPLE_GATES.expectancy, 'USD'),
    sharpeLike: suppressedBelow(
      returnStdev && returnStdev > 0 && returnMean !== null ? returnMean / returnStdev : null,
      returns.length,
      SAMPLE_GATES.sharpe,
      'RATIO',
    ),
    sortinoLike: suppressedBelow(
      downside && downside > 0 && returnMean !== null ? returnMean / downside : null,
      returns.length,
      SAMPLE_GATES.sortino,
      'RATIO',
    ),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Holding period (spec §26)
// ────────────────────────────────────────────────────────────────────────────

function buildHoldingStats(entries: RealizedPnlEntry[], thresholds: HoldingThresholds): HoldingPeriodStats {
  const hours = entries.map((entry) => entry.holdingHours).filter((value) => value > 0);
  const buckets = (['SCALP', 'INTRADAY', 'SWING', 'LONG_TERM'] as const).map((bucket) => {
    const inBucket = entries.filter((entry) => holdingBucket(entry.holdingHours, thresholds) === bucket);
    const nets = inBucket.filter((entry) => hasValue(entry.netPnl)).map((entry) => entry.netPnl.usd as number);
    const wins = nets.filter((value) => value > 0).length;
    return {
      bucket,
      trades: inBucket.length,
      netPnlUsd: round(sum(nets), 2),
      winRate: sampled(nets.length > 0 ? wins / nets.length : null, nets.length, SAMPLE_GATES.winRate, 'PCT'),
    };
  });

  const bestEntry = entries
    .filter((entry) => hasValue(entry.netPnl))
    .sort((a, b) => (b.netPnl.usd as number) - (a.netPnl.usd as number))[0];
  const worstEntry = entries
    .filter((entry) => hasValue(entry.netPnl))
    .sort((a, b) => (a.netPnl.usd as number) - (b.netPnl.usd as number))[0];

  return {
    averageHours: sampled(mean(hours), hours.length, SAMPLE_GATES.holdingPeriod, 'HOURS'),
    medianHours: sampled(median(hours), hours.length, SAMPLE_GATES.holdingPeriod, 'HOURS'),
    bestHours: bestEntry ? round(bestEntry.holdingHours, 2) : null,
    worstHours: worstEntry ? round(worstEntry.holdingHours, 2) : null,
    buckets,
    thresholds,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Drawdown (spec §35)
// ────────────────────────────────────────────────────────────────────────────

export function buildDrawdown(history: ValuePoint[], from: number, now: number): DrawdownAnalysis {
  const points = history
    .filter((point) => {
      const at = toTimestamp(point.at);
      return at >= from && at <= now && point.markValueUsd !== null;
    })
    .sort((a, b) => toTimestamp(a.at) - toTimestamp(b.at));

  const sample = sampleSize(points.length, SAMPLE_GATES.drawdown);

  if (points.length < 2) {
    return {
      peakValueUsd: points[0]?.markValueUsd ?? null,
      currentValueUsd: points[points.length - 1]?.markValueUsd ?? null,
      maxDrawdownPct: null,
      maxDrawdownUsd: null,
      currentDrawdownPct: null,
      sample: { ...sample, note: 'Not enough portfolio snapshots to measure drawdown' },
    };
  }

  let peak = points[0].markValueUsd as number;
  let peakAt = points[0].at;
  let maxDrawdownPct = 0;
  let maxDrawdownUsd = 0;
  let maxDrawdownAt = points[0].at;
  let globalPeak = peak;
  let globalPeakAt = peakAt;

  for (const point of points) {
    const value = point.markValueUsd as number;
    if (value > peak) {
      peak = value;
      peakAt = point.at;
    }
    if (value > globalPeak) {
      globalPeak = value;
      globalPeakAt = point.at;
    }
    if (peak > 0) {
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdownPct) {
        maxDrawdownPct = drawdown;
        maxDrawdownUsd = peak - value;
        maxDrawdownAt = point.at;
      }
    }
  }

  const current = points[points.length - 1].markValueUsd as number;
  const currentDrawdownPct = globalPeak > 0 ? (globalPeak - current) / globalPeak : null;

  return {
    peakValueUsd: round(globalPeak, 2),
    peakAt: globalPeakAt,
    currentValueUsd: round(current, 2),
    maxDrawdownPct: round(maxDrawdownPct, 6),
    maxDrawdownUsd: round(maxDrawdownUsd, 2),
    maxDrawdownAt,
    currentDrawdownPct: currentDrawdownPct !== null ? round(currentDrawdownPct, 6) : null,
    sample,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Attribution (spec §22, §23)
// ────────────────────────────────────────────────────────────────────────────

function buildAttribution(positions: Position[], execution: ExecutionCostSummary): AttributionReport {
  const perPosition: AttributionEntry[] = positions.map((position) => {
    const realized = hasValue(position.pnl.realized) ? (position.pnl.realized.usd as number) : 0;
    const unrealized = hasValue(position.pnl.unrealized) ? (position.pnl.unrealized.usd as number) : 0;
    const fees = position.pnl.fees.totalUsd;
    const net = hasValue(position.pnl.net) ? (position.pnl.net.usd as number) : realized + unrealized - fees;

    return {
      key: position.tokenId,
      label: position.symbol,
      netPnlUsd: round(net, 2),
      realizedUsd: round(realized, 2),
      unrealizedUsd: round(unrealized, 2),
      feesUsd: round(fees, 2),
      trades: position.realizedEntries.length,
      sharePct: 0,
      confidence: hasValue(position.pnl.net) ? 0.9 : 0.4,
      note: !hasValue(position.pnl.net)
        ? 'Net P&L is unavailable for this position, so only its observed fees are counted here.'
        : position.pnl.hasUnknownBasis
          ? 'Part of this position has an unknown cost basis, so its contribution is partial.'
          : undefined,
    };
  });

  const gains = withShares(perPosition.filter((entry) => entry.netPnlUsd > 0));
  const losses = withShares(perPosition.filter((entry) => entry.netPnlUsd < 0));

  const byStrategy = withShares(aggregateByStrategy(positions));

  const totalFees = round(sum(positions.map((position) => position.pnl.fees.totalUsd)), 2);
  const slippageCost = round(
    sum(
      execution.records
        .filter((record) => record.slippagePct !== null && record.slippagePct < 0 && record.executedPriceUsd !== null)
        .map((record) => Math.abs((record.slippagePct as number) * (record.executedPriceUsd as number) * record.quantity)),
    ),
    2,
  );

  const costCentres: AttributionEntry[] = [
    {
      key: 'FEES',
      label: 'Fees',
      netPnlUsd: -totalFees,
      realizedUsd: 0,
      unrealizedUsd: 0,
      feesUsd: totalFees,
      trades: positions.reduce((count, position) => count + position.realizedEntries.length, 0),
      sharePct: 0,
      confidence: 0.95,
      note: 'Trading, network and DEX fees observed on executed transactions.',
    },
    {
      key: 'SLIPPAGE',
      label: 'Slippage vs quote',
      netPnlUsd: -slippageCost,
      realizedUsd: 0,
      unrealizedUsd: 0,
      feesUsd: 0,
      trades: execution.records.filter((record) => record.slippagePct !== null).length,
      sharePct: 0,
      confidence: execution.records.some((record) => record.status === 'KNOWN') ? 0.75 : 0.3,
      note: 'Difference between quoted and executed prices. Already embedded in the position P&L above — shown here to isolate execution quality, not to be added to it.',
    },
  ];

  return {
    gains,
    losses,
    byStrategy,
    costCentres: withShares(costCentres),
    limitations: [
      'Attribution shows what coincided with gains and losses. It does not establish that any single factor caused them.',
      'Positions with unknown cost basis contribute partially and are flagged individually.',
    ],
  };
}

function aggregateByStrategy(positions: Position[]): AttributionEntry[] {
  const byStrategy = new Map<StrategyTag, AttributionEntry>();

  for (const position of positions) {
    for (const entry of position.realizedEntries) {
      const strategy = entry.strategy;
      const net = hasValue(entry.netPnl) ? (entry.netPnl.usd as number) : 0;
      const existing = byStrategy.get(strategy);
      if (existing) {
        existing.netPnlUsd = round(existing.netPnlUsd + net, 2);
        existing.realizedUsd = round(existing.realizedUsd + net, 2);
        existing.feesUsd = round(existing.feesUsd + entry.fees.totalUsd, 2);
        existing.trades += 1;
      } else {
        byStrategy.set(strategy, {
          key: strategy,
          label: strategyLabel(strategy),
          netPnlUsd: round(net, 2),
          realizedUsd: round(net, 2),
          unrealizedUsd: 0,
          feesUsd: round(entry.fees.totalUsd, 2),
          trades: 1,
          sharePct: 0,
          confidence: hasValue(entry.netPnl) ? 0.85 : 0.4,
        });
      }
    }
  }

  return [...byStrategy.values()].sort((a, b) => b.netPnlUsd - a.netPnlUsd);
}

function withShares(entries: AttributionEntry[]): AttributionEntry[] {
  const pool = sum(entries.map((entry) => Math.abs(entry.netPnlUsd)));
  return entries
    .map((entry) => ({
      ...entry,
      sharePct: pool > 0 ? round(Math.abs(entry.netPnlUsd) / pool, 6) : 0,
    }))
    .sort((a, b) => Math.abs(b.netPnlUsd) - Math.abs(a.netPnlUsd));
}

function strategyLabel(strategy: StrategyTag): string {
  switch (strategy) {
    case 'MANUAL':
      return 'Manual';
    case 'COPY_TRADE':
      return 'Copy trade';
    case 'LIMIT_ORDER':
      return 'Limit order';
    case 'STOP_LOSS':
      return 'Stop loss';
    case 'MARKET_ORDER':
      return 'Market order';
    case 'LAUNCH_PARTICIPATION':
      return 'Launch participation';
    default:
      return 'Untagged';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Execution cost analysis (spec §24)
// ────────────────────────────────────────────────────────────────────────────

export function summarizeExecutionCosts(records: ExecutionCostRecord[]): ExecutionCostSummary {
  const priced = records.filter((record) => hasValue(record.executionCostUsd));
  const slippages = records
    .map((record) => record.slippagePct)
    .filter((value): value is number => value !== null);

  const totalExecutionCostUsd = priced.length
    ? known(
        round(sum(priced.map((record) => record.executionCostUsd.usd as number)), 2),
        'execution_cost_engine',
        undefined,
        0.85,
      )
    : unknownValue('No execution had both a quoted and an executed price', 'execution_cost_engine');

  const totalFeesUsd = round(sum(records.map((record) => record.fees.totalUsd)), 2);
  const negativeSlippage = slippages.filter((value) => value < 0);

  const observations: string[] = [];
  if (slippages.length >= 5) {
    const share = negativeSlippage.length / slippages.length;
    if (share >= 0.7) {
      observations.push(
        `${Math.round(share * 100)}% of measured executions filled worse than quoted. This pattern is consistent across ${slippages.length} trades.`,
      );
    } else if (share <= 0.3) {
      observations.push(
        `${Math.round((1 - share) * 100)}% of measured executions filled at or better than quoted.`,
      );
    }
  } else if (slippages.length > 0) {
    observations.push(
      `Only ${slippages.length} execution(s) had both a quote and a fill price — too few to judge execution quality.`,
    );
  } else {
    observations.push('No execution had a recorded quote, so execution quality cannot be assessed.');
  }

  const partialFills = records.filter((record) => record.fillRatio !== null && record.fillRatio < 0.99);
  if (partialFills.length > 0) {
    observations.push(`${partialFills.length} order(s) filled partially; realized quantities differ from requested.`);
  }

  return {
    records,
    totalExecutionCostUsd,
    averageSlippagePct: sampled(mean(slippages), slippages.length, SAMPLE_GATES.averageReturn, 'PCT'),
    worstSlippagePct: slippages.length ? round(Math.min(...slippages), 6) : null,
    totalFeesUsd,
    observations,
  };
}

// ────────────────────────────────────────────────────────────────────────────

function buildLimitations(input: PerformanceInput, windows: WindowPerformance[]): string[] {
  const limitations: string[] = [];
  const allWindow = windows.find((window) => window.window === 'ALL');

  if (allWindow && allWindow.trading.totalTrades < SAMPLE_GATES.winRate) {
    limitations.push(
      `Only ${allWindow.trading.totalTrades} closed trade(s) exist. Win rate, expectancy and risk-adjusted ratios are either suppressed or flagged as low-confidence.`,
    );
  }
  if (input.history.length < SAMPLE_GATES.drawdown) {
    limitations.push(
      `Only ${input.history.length} portfolio snapshot(s) exist, which is not enough to characterise drawdown.`,
    );
  }
  if (input.positions.some((position) => position.pnl.hasUnknownBasis)) {
    limitations.push('Some positions include quantity with unknown cost basis; their return percentages are partial.');
  }
  return limitations;
}

/** Convenience accessor used by the API layer and the UI. */
export function getWindow(report: PerformanceReport, window: PerformanceWindow): WindowPerformance | undefined {
  return report.windows.find((entry) => entry.window === window);
}

export { safeDivide };
