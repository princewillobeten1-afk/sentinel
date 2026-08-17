/**
 * AI Portfolio Assistant Interface (spec §62, §63)
 *
 * Produces the structured, bounded view of a portfolio that the AI layer is
 * allowed to reason over. The AI must answer from these facts, never from its
 * own arithmetic on raw numbers, and it must never fabricate performance.
 *
 * Two properties make that enforceable:
 *  1. Every figure arrives pre-computed with an explicit status and confidence,
 *     so "unknown" is representable and cannot be smoothed into a number.
 *  2. `answerableQuestions` and `refusalGuidance` state the boundary in-band,
 *     so the prompt layer does not have to re-derive it.
 */

import type {
  PortfolioResult,
  Position,
  ValueStatus,
} from './types';
import { formatUsd, hasValue, round } from './utils';

export interface AiMonetaryFact {
  usd: number | null;
  status: ValueStatus;
  display: string;
  confidence: number;
}

export interface AiPositionFact {
  positionId: string;
  symbol: string;
  chain: string;
  quantity: number;
  markValue: AiMonetaryFact;
  estimatedExitValue: AiMonetaryFact;
  netPnl: AiMonetaryFact;
  realizedPnl: AiMonetaryFact;
  unrealizedPnl: AiMonetaryFact;
  feesUsd: number;
  allocationPct: number | null;
  riskScore: number;
  riskBand: string;
  riskConfidence: number;
  riskDrivers: string[];
  exitabilityScore: number | null;
  usableLiquidityUsd: number | null;
  liquidityRatio: number | null;
  hasUnknownCostBasis: boolean;
  pendingTransactions: number;
  limitations: string[];
}

export interface AiPortfolioView {
  portfolioId: string;
  generatedAt: string;
  totals: {
    markValue: AiMonetaryFact;
    estimatedExitValue: AiMonetaryFact;
    stressExitValue: AiMonetaryFact;
    netPnl: AiMonetaryFact;
    realizedPnl: AiMonetaryFact;
    unrealizedPnl: AiMonetaryFact;
    feesUsd: number;
    todayChange: AiMonetaryFact;
  };
  risk: {
    score: number;
    band: string;
    confidence: number;
    drivers: Array<{ label: string; contribution: number; detail: string }>;
  };
  exposure: {
    largestPositionPct: number | null;
    top3Pct: number | null;
    byChain: Array<{ chain: string; sharePct: number }>;
    byRiskClass: Array<{ riskClass: string; sharePct: number }>;
    illiquidSharePct: number;
    observations: string[];
  };
  performance: {
    window: string;
    netPnlUsd: number | null;
    winRate: { value: number | null; sampleCount: number; adequacy: string };
    maxDrawdownPct: number | null;
    tradeCount: number;
  }[];
  attribution: {
    gains: Array<{ symbol: string; netPnlUsd: number }>;
    losses: Array<{ symbol: string; netPnlUsd: number }>;
    costCentres: Array<{ label: string; netPnlUsd: number }>;
  };
  positions: AiPositionFact[];
  changes: Array<{ symbol: string; type: string; severity: string; detail: string; confidence: number }>;
  /** Facts the assistant is permitted to state. */
  answerableQuestions: string[];
  /** Things the assistant must decline or qualify. */
  refusalGuidance: string[];
  limitations: string[];
}

export function buildAiPortfolioView(result: PortfolioResult): AiPortfolioView {
  const { overview, positions, exposure, risk, performance, changes } = result;

  return {
    portfolioId: overview.portfolioId,
    generatedAt: overview.generatedAt,
    totals: {
      markValue: fact(overview.totalValue),
      estimatedExitValue: fact(overview.estimatedExitValue),
      stressExitValue: fact(overview.stressExitValue),
      netPnl: fact(overview.netPnl),
      realizedPnl: fact(overview.realizedPnl),
      unrealizedPnl: fact(overview.unrealizedPnl),
      feesUsd: round(overview.fees.totalUsd, 2),
      todayChange: fact(overview.todayChange),
    },
    risk: {
      score: risk.score,
      band: risk.band,
      confidence: risk.confidence,
      drivers: risk.drivers.map((driver) => ({
        label: driver.label,
        contribution: driver.contribution,
        detail: driver.detail,
      })),
    },
    exposure: {
      largestPositionPct: exposure.concentration.largestPositionPct,
      top3Pct: exposure.concentration.top3Pct,
      byChain: exposure.byChain.map((bucket) => ({ chain: bucket.key, sharePct: bucket.sharePct })),
      byRiskClass: exposure.byRiskClass.map((bucket) => ({
        riskClass: bucket.key,
        sharePct: bucket.sharePct,
      })),
      illiquidSharePct: exposure.illiquidSharePct,
      observations: exposure.concentration.observations,
    },
    performance: performance.windows.map((window) => ({
      window: window.window,
      netPnlUsd: hasValue(window.netPnl) ? round(window.netPnl.usd, 2) : null,
      winRate: {
        value: window.trading.winRate.value,
        sampleCount: window.trading.winRate.sample.count,
        adequacy: window.trading.winRate.sample.adequacy,
      },
      maxDrawdownPct: window.drawdown.maxDrawdownPct,
      tradeCount: window.trading.totalTrades,
    })),
    attribution: {
      gains: performance.attribution.gains.map((entry) => ({
        symbol: entry.label,
        netPnlUsd: entry.netPnlUsd,
      })),
      losses: performance.attribution.losses.map((entry) => ({
        symbol: entry.label,
        netPnlUsd: entry.netPnlUsd,
      })),
      costCentres: performance.attribution.costCentres.map((entry) => ({
        label: entry.label,
        netPnlUsd: entry.netPnlUsd,
      })),
    },
    positions: positions
      .filter((position) => position.status !== 'CLOSED')
      .map(toPositionFact),
    changes: changes.map((change) => ({
      symbol: change.symbol,
      type: change.type,
      severity: change.severity,
      detail: change.detail,
      confidence: change.confidence,
    })),
    answerableQuestions: [
      'Why is my portfolio up or down today, in terms of which positions moved.',
      'Which position has the worst liquidity or exitability.',
      'What contributed most to gains and losses, described as coincidence rather than cause.',
      'Which positions have deteriorating risk, and which components drove the change.',
      'How concentrated the portfolio is, and where.',
      'Which figures are unknown or unavailable, and why.',
    ],
    refusalGuidance: [
      'Never state a performance figure that is not present in this payload. If a value is UNKNOWN or UNAVAILABLE, say so.',
      'Never present an estimated exit value as a guaranteed execution outcome.',
      'Never report a win rate, expectancy or risk-adjusted ratio without its sample size, and never report one whose value is null.',
      'Never recommend buying, selling or holding. Surface the observation and let the user decide.',
      'Never infer causality for a P&L move beyond what the change detection payload states.',
    ],
    limitations: result.limitations,
  };
}

function toPositionFact(position: Position): AiPositionFact {
  return {
    positionId: position.id,
    symbol: position.symbol,
    chain: position.chain,
    quantity: position.quantity,
    markValue: fact(position.valuation.markValue),
    estimatedExitValue: fact(position.valuation.estimatedExitValue),
    netPnl: fact(position.pnl.net),
    realizedPnl: fact(position.pnl.realized),
    unrealizedPnl: fact(position.pnl.unrealized),
    feesUsd: round(position.pnl.fees.totalUsd, 2),
    allocationPct: position.allocationPct,
    riskScore: position.risk.score,
    riskBand: position.risk.band,
    riskConfidence: position.risk.confidence,
    riskDrivers: position.risk.drivers,
    exitabilityScore: position.exitability?.score ?? null,
    usableLiquidityUsd: position.exitability?.usableLiquidityUsd ?? null,
    liquidityRatio: position.liquidityAdjusted?.liquidityRatio ?? null,
    hasUnknownCostBasis: position.pnl.hasUnknownBasis,
    pendingTransactions: position.pending.length,
    limitations: position.limitations,
  };
}

function fact(value: { usd: number | null; status: ValueStatus; confidence: number }): AiMonetaryFact {
  return {
    usd: value.usd,
    status: value.status,
    display:
      value.status === 'UNKNOWN'
        ? 'Unknown'
        : value.status === 'UNAVAILABLE'
          ? 'Unavailable'
          : formatUsd(value.usd),
    confidence: round(value.confidence, 3),
  };
}

/**
 * Narrative summary matching the Definition of Done layout (spec §65).
 * Kept here so the AI and the UI read from one text generator.
 */
export function buildPortfolioNarrative(result: PortfolioResult): {
  headline: string[];
  whatChanged: string[];
  why: string[];
} {
  const { overview, risk, changes } = result;

  const headline = [
    `Market value: ${displayOf(overview.totalValue)}`,
    `Estimated exit value: ${displayOf(overview.estimatedExitValue)}`,
    `Net P&L: ${displayOf(overview.netPnl)}`,
    `Risk: ${risk.score} / 100`,
  ];

  if (overview.exposureSummary.largestToken) {
    headline.push(
      `Largest exposure: ${overview.exposureSummary.largestToken.symbol} — ${round(overview.exposureSummary.largestToken.sharePct * 100, 0)}%`,
    );
  }
  if (overview.exposureSummary.lowestExitability) {
    headline.push(
      `Lowest exitability: ${overview.exposureSummary.lowestExitability.symbol} — ${overview.exposureSummary.lowestExitability.score}`,
    );
  }
  if (overview.exposureSummary.highestRisk) {
    headline.push(
      `Highest risk: ${overview.exposureSummary.highestRisk.symbol} — ${overview.exposureSummary.highestRisk.score}`,
    );
  }
  headline.push(`Today's change: ${displayOf(overview.todayChange)}`);

  return {
    headline,
    whatChanged: changes.slice(0, 5).map((change) => change.title),
    why: changes.slice(0, 5).map((change) => change.detail),
  };
}

function displayOf(value: { usd: number | null; status: ValueStatus }): string {
  if (value.status === 'UNKNOWN') return 'Unknown';
  if (value.status === 'UNAVAILABLE') return 'Unavailable';
  return formatUsd(value.usd);
}
