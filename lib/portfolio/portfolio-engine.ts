/**
 * Portfolio Engine (spec §3, §13, §20, §40, §41, §48)
 *
 * Assembles the finished `Position[]` and `PortfolioOverview` from position
 * drafts, prices, exitability and risk. Cross-chain aggregation happens here:
 * each chain contributes its native asset, token balances, fees and cost basis,
 * and nothing is merged across chains except at the value layer.
 *
 * Allocation is computed in two passes because position risk depends on
 * allocation and allocation depends on valuation.
 */

import type { ExitabilityReport } from '@/lib/exitability/types';
import type {
  ChainBreakdown,
  ExposureReport,
  MonetaryValue,
  PortfolioContext,
  PortfolioOverview,
  PortfolioRiskScore,
  Position,
  PositionEvent,
  TokenMetaInput,
  ValuePoint,
} from './types';
import type { PositionDraft } from './position-engine';
import { summarizeCostBasis, remainingQuantity } from './cost-basis';
import { computePositionPnl, aggregatePnl } from './pnl-engine';
import { scorePositionRisk } from './position-risk';
import { toPositionExitability, valuePosition } from './valuation';
import {
  DUST_VALUE_USD,
  QUANTITY_EPSILON,
  addValues,
  evidence,
  hasValue,
  known,
  liquidityExposureBand,
  round,
  safeDivide,
  sum,
  toTimestamp,
  unavailable,
  unknownValue,
  zero,
} from './utils';

export interface AssembleInput {
  context: PortfolioContext;
  drafts: PositionDraft[];
}

export function assemblePositions(input: AssembleInput): Position[] {
  const { context } = input;
  const observedAt = context.observedAt;

  // ── Pass 1: quantity + valuation, so allocation can be computed ──
  const staged = input.drafts.map((draft) => {
    const quantity = remainingQuantity(draft.book);
    const costBasis = summarizeCostBasis(draft.book);
    const exitabilityReport = context.exitability?.[draft.tokenId];

    const valuation = valuePosition({
      tokenId: draft.tokenId,
      chain: draft.chain,
      quantity,
      price: context.prices[draft.tokenId],
      exitability: exitabilityReport,
      freshnessSeconds: context.priceFreshnessSeconds,
      observedAt,
    });

    return { draft, quantity, costBasis, valuation, exitabilityReport };
  });

  const totalMarkValue = sum(
    staged
      .filter((entry) => entry.quantity > QUANTITY_EPSILON && hasValue(entry.valuation.markValue))
      .map((entry) => entry.valuation.markValue.usd as number),
  );

  // ── Pass 2: allocation-aware risk, P&L and timeline enrichment ──
  return staged.map((entry) => {
    const { draft, quantity, costBasis, valuation, exitabilityReport } = entry;

    const allocationPct =
      hasValue(valuation.markValue) && totalMarkValue > 0
        ? round((valuation.markValue.usd as number) / totalMarkValue, 6)
        : null;

    const usableLiquidityUsd = exitabilityReport?.liquidity.usableLiquidityUsd ?? null;
    const liquidityRatio =
      hasValue(valuation.markValue) && usableLiquidityUsd
        ? safeDivide(valuation.markValue.usd as number, usableLiquidityUsd)
        : null;

    const pnl = computePositionPnl({
      costBasis,
      valuation,
      realizedEntries: draft.realizedEntries,
      fees: draft.fees,
      quantity,
      symbol: draft.symbol,
    });

    const risk = scorePositionRisk({
      positionId: draft.id,
      tokenId: draft.tokenId,
      symbol: draft.symbol,
      token: context.tokens[draft.tokenId],
      exitability: exitabilityReport,
      allocationPct,
      liquidityRatio,
      observedAt,
    });

    const status =
      quantity <= QUANTITY_EPSILON
        ? 'CLOSED'
        : hasValue(valuation.markValue) && (valuation.markValue.usd as number) < DUST_VALUE_USD
          ? 'DUST'
          : 'OPEN';

    const limitations = buildPositionLimitations(draft, valuation, liquidityRatio, usableLiquidityUsd);

    const timeline = enrichTimeline(draft, valuation, observedAt);

    const position: Position = {
      id: draft.id,
      portfolioId: context.portfolioId,
      tokenId: draft.tokenId,
      symbol: draft.symbol,
      name: draft.name ?? context.tokens[draft.tokenId]?.name,
      chain: draft.chain,
      isNative: draft.isNative,
      wallets: draft.wallets,
      status,
      quantity,
      costBasis,
      valuation,
      pnl,
      realizedEntries: draft.realizedEntries,
      allocationPct,
      risk,
      exitability: exitabilityReport ? toPositionExitability(exitabilityReport) : undefined,
      liquidityAdjusted: buildPositionLiquidityView(draft, valuation, exitabilityReport, liquidityRatio),
      pending: draft.pending,
      timeline,
      executionCosts: draft.executionCosts,
      tradingVolumeUsd: draft.tradingVolumeUsd,
      firstAcquiredAt: draft.firstAcquiredAt,
      lastActivityAt: draft.lastActivityAt,
      averageHoldingHours: averageHoldingHours(draft, observedAt),
      strategyTags: draft.strategyTags,
      limitations,
    };

    return position;
  });
}

function buildPositionLiquidityView(
  draft: PositionDraft,
  valuation: Position['valuation'],
  report: ExitabilityReport | undefined,
  liquidityRatio: number | null,
): Position['liquidityAdjusted'] {
  if (!hasValue(valuation.markValue)) return undefined;

  const exitDepth5PctUsd = report?.exitDepth.find((point) => point.impactPct === 5)?.absorbableUsd ?? null;
  const depthRatio = exitDepth5PctUsd
    ? safeDivide(valuation.markValue.usd as number, exitDepth5PctUsd)
    : null;

  // The binding constraint is whichever is worse: size against total usable
  // liquidity, or size against the depth available before 5% impact.
  const worstRatio =
    liquidityRatio === null && depthRatio === null
      ? null
      : Math.max(liquidityRatio ?? 0, depthRatio ?? 0);

  return {
    positionId: draft.id,
    tokenId: draft.tokenId,
    positionValueUsd: round(valuation.markValue.usd as number, 2),
    usableLiquidityUsd: report?.liquidity.usableLiquidityUsd ?? null,
    liquidityRatio: liquidityRatio !== null ? round(liquidityRatio, 6) : null,
    exitDepth5PctUsd,
    depthRatio: depthRatio !== null ? round(depthRatio, 6) : null,
    band: liquidityExposureBand(worstRatio),
    note:
      liquidityRatio === null
        ? 'Usable liquidity is unknown for this token, so size cannot be compared against executable depth.'
        : liquidityRatio >= 0.5
          ? `This position is ${round(liquidityRatio * 100, 1)}% of usable liquidity. Exiting at the displayed price is not realistic.`
          : liquidityRatio >= 0.15
            ? `This position is ${round(liquidityRatio * 100, 1)}% of usable liquidity. Expect material impact on exit.`
            : `This position is ${round(liquidityRatio * 100, 1)}% of usable liquidity.`,
  };
}

function buildPositionLimitations(
  draft: PositionDraft,
  valuation: Position['valuation'],
  liquidityRatio: number | null,
  usableLiquidityUsd: number | null,
): string[] {
  const limitations = [...new Set(draft.limitations)];

  if (!hasValue(valuation.markValue)) {
    limitations.push(
      'VALUE_UNAVAILABLE — no usable price could be obtained. A stale value is deliberately not substituted.',
    );
  } else if (valuation.markValue.status === 'STALE') {
    limitations.push(
      `The price used for this position is ${Math.round(valuation.price.ageSeconds ?? 0)}s old and is marked stale.`,
    );
  }

  if (!hasValue(valuation.estimatedExitValue)) {
    limitations.push(
      'No executable exit value could be estimated for this position, so the marked value should not be read as realisable.',
    );
  }

  // spec §43: a large position in a thin market must never be shown unqualified.
  if (liquidityRatio !== null && liquidityRatio >= 0.25) {
    limitations.push(
      `Marked value is ${round(liquidityRatio * 100, 0)}% of the token's usable liquidity (${Math.round(usableLiquidityUsd ?? 0)} USD). The marked value is materially higher than what could realistically be executed.`,
    );
  }

  if (draft.pending.length > 0) {
    limitations.push(
      `${draft.pending.length} pending transaction(s) are not reflected as final in this position's quantity.`,
    );
  }

  return limitations;
}

function enrichTimeline(
  draft: PositionDraft,
  valuation: Position['valuation'],
  observedAt: string,
): PositionEvent[] {
  const timeline = [...draft.timeline];

  // A Sentinel-generated observation sits alongside the blockchain facts so
  // the position story reads end-to-end (spec §28).
  if (hasValue(valuation.markValue) && hasValue(valuation.estimatedExitValue)) {
    const discount = valuation.exitDiscountPct ?? 0;
    if (discount >= 0.08) {
      timeline.unshift({
        id: `${draft.id}_evt_exit_gap`,
        positionId: draft.id,
        type: 'EXITABILITY_DROP',
        origin: 'SENTINEL',
        title: 'Executable value is below marked value',
        detail: `Estimated exit value is ${round(discount * 100, 1)}% below the marked value for this position size.`,
        confidence: valuation.estimatedExitValue.confidence,
        evidence: [
          evidence(
            'Gap between marked value and estimated executable value',
            'exitability_engine',
            observedAt,
            round(discount * 100, 1),
            valuation.estimatedExitValue.confidence,
          ),
        ],
        occurredAt: observedAt,
      });
    }
  }

  return timeline.sort((a, b) => toTimestamp(b.occurredAt) - toTimestamp(a.occurredAt));
}

function averageHoldingHours(draft: PositionDraft, observedAt: string): number | null {
  const open = draft.book.lots.filter((lot) => lot.remainingQuantity > QUANTITY_EPSILON);
  if (open.length === 0) return null;
  const totalQuantity = sum(open.map((lot) => lot.remainingQuantity));
  if (totalQuantity <= 0) return null;
  const weighted = sum(
    open.map((lot) => {
      const hours = Math.max(0, (toTimestamp(observedAt) - toTimestamp(lot.timestamp)) / 3_600_000);
      return hours * lot.remainingQuantity;
    }),
  );
  return round(weighted / totalQuantity, 2);
}

// ────────────────────────────────────────────────────────────────────────────
// Overview
// ────────────────────────────────────────────────────────────────────────────

export interface OverviewInput {
  context: PortfolioContext;
  positions: Position[];
  exposure: ExposureReport;
  risk: PortfolioRiskScore;
  history: ValuePoint[];
}

export function buildOverview(input: OverviewInput): PortfolioOverview {
  const { context, positions, exposure, risk } = input;
  const open = positions.filter((position) => position.status !== 'CLOSED');

  const totalValue = addValues(open.map((position) => position.valuation.markValue), 'portfolio_engine');
  const estimatedExitValue = addValues(
    open.map((position) => position.valuation.estimatedExitValue),
    'portfolio_engine',
  );
  const stressExitValue = addValues(
    open.map((position) => position.valuation.stressExitValue),
    'portfolio_engine',
  );

  // Available balance = native + stable holdings that can be deployed now.
  const deployable = open.filter(
    (position) => position.isNative || context.tokens[position.tokenId]?.isStable,
  );
  const availableBalance = deployable.length
    ? addValues(deployable.map((position) => position.valuation.markValue), 'portfolio_engine')
    : zero('portfolio_engine');

  const investedCapital = addValues(
    open
      .filter((position) => !position.isNative && !context.tokens[position.tokenId]?.isStable)
      .map((position) => position.costBasis.remainingCostBasis),
    'portfolio_engine',
  );

  const pnl = aggregatePnl({ positions });

  const { todayChange, todayChangePct } = computeTodayChange(input.history, totalValue, context.observedAt);

  const highRisk = open.filter((position) => position.risk.score >= 65);
  const exitabilityIssues = open.filter(
    (position) => position.exitability !== undefined && position.exitability.score < 50,
  );
  const unvalued = open.filter((position) => !hasValue(position.valuation.markValue));

  const largestToken = exposure.byToken[0];
  const lowestExitability = [...open]
    .filter((position) => position.exitability !== undefined)
    .sort((a, b) => (a.exitability?.score ?? 100) - (b.exitability?.score ?? 100))[0];
  const highestRisk = [...open].sort((a, b) => b.risk.score - a.risk.score)[0];

  const limitations = [
    ...new Set([
      ...exposure.limitations,
      ...risk.limitations,
      ...open.flatMap((position) => position.limitations),
    ]),
  ];

  if (!hasValue(estimatedExitValue) || estimatedExitValue.status === 'ESTIMATED') {
    limitations.push(
      'Estimated exit value is a simulation based on current liquidity. It is not a guarantee of execution.',
    );
  }

  return {
    portfolioId: context.portfolioId,
    walletGroupId: context.walletGroupId,
    wallets: context.wallets.map((wallet) => wallet.address),
    chains: [...new Set(context.wallets.map((wallet) => wallet.chain))],
    totalValue,
    estimatedExitValue,
    stressExitValue,
    availableBalance,
    investedCapital,
    realizedPnl: pnl.realized,
    unrealizedPnl: pnl.unrealized,
    netPnl: pnl.net,
    fees: pnl.fees,
    todayChange,
    todayChangePct,
    positionCount: positions.length,
    openPositionCount: open.length,
    highRiskPositionCount: highRisk.length,
    exitabilityIssueCount: exitabilityIssues.length,
    pendingCount: sum(positions.map((position) => position.pending.length)),
    riskScore: risk.score,
    riskBand: risk.band,
    exposureSummary: {
      largestToken: largestToken
        ? { symbol: largestToken.label, sharePct: largestToken.sharePct }
        : undefined,
      lowestExitability: lowestExitability?.exitability
        ? { symbol: lowestExitability.symbol, score: lowestExitability.exitability.score }
        : undefined,
      highestRisk: highestRisk ? { symbol: highestRisk.symbol, score: highestRisk.risk.score } : undefined,
    },
    unvaluedPositionIds: unvalued.map((position) => position.id),
    limitations,
    generatedAt: context.observedAt,
  };
}

function computeTodayChange(
  history: ValuePoint[],
  totalValue: MonetaryValue,
  observedAt: string,
): { todayChange: MonetaryValue; todayChangePct: number | null } {
  if (!hasValue(totalValue)) {
    return {
      todayChange: unknownValue('Portfolio value is not available, so today’s change cannot be computed', 'portfolio_engine'),
      todayChangePct: null,
    };
  }

  const startOfDay = new Date(observedAt);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const cutoff = startOfDay.getTime();

  const baseline = [...history]
    .filter((point) => toTimestamp(point.at) <= cutoff && point.markValueUsd !== null)
    .sort((a, b) => toTimestamp(b.at) - toTimestamp(a.at))[0];

  if (!baseline || baseline.markValueUsd === null) {
    return {
      todayChange: unknownValue('No portfolio snapshot exists from before today', 'portfolio_snapshots'),
      todayChangePct: null,
    };
  }

  const delta = (totalValue.usd as number) - baseline.markValueUsd;
  return {
    todayChange: known(round(delta, 2), 'portfolio_snapshots', baseline.at, 0.85),
    todayChangePct: baseline.markValueUsd > 0 ? round(delta / baseline.markValueUsd, 6) : null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Cross-chain aggregation (spec §40, §41)
// ────────────────────────────────────────────────────────────────────────────

export function buildChainBreakdown(
  positions: Position[],
  tokens: Record<string, TokenMetaInput>,
): ChainBreakdown[] {
  const chains = [...new Set(positions.map((position) => position.chain))];

  return chains.map((chain) => {
    const chainPositions = positions.filter(
      (position) => position.chain === chain && position.status !== 'CLOSED',
    );
    const native = chainPositions.find((position) => position.isNative || tokens[position.tokenId]?.isNative);
    const unvalued = chainPositions.filter((position) => !hasValue(position.valuation.markValue));

    return {
      chain,
      markValue: addValues(chainPositions.map((position) => position.valuation.markValue), 'portfolio_engine'),
      estimatedExitValue: addValues(
        chainPositions.map((position) => position.valuation.estimatedExitValue),
        'portfolio_engine',
      ),
      nativeBalance: native
        ? { symbol: native.symbol, quantity: native.quantity, value: native.valuation.markValue }
        : null,
      positionCount: chainPositions.length,
      feesUsd: round(sum(chainPositions.map((position) => position.pnl.fees.totalUsd)), 2),
      status:
        chainPositions.length === 0
          ? 'UNAVAILABLE'
          : unvalued.length === 0
            ? 'OK'
            : unvalued.length === chainPositions.length
              ? 'UNAVAILABLE'
              : 'PARTIAL',
      note:
        unvalued.length > 0
          ? `${unvalued.length} position(s) on this chain could not be valued.`
          : undefined,
    };
  });
}

export { unavailable };
