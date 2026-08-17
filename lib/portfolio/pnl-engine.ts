/**
 * True Net P&L Engine (spec §4, §5)
 *
 * The differentiator is that "P&L" here is not `current value − purchase value`.
 * It accounts for entry price, exit price, trading fees, network fees, DEX fees,
 * slippage/execution differences, transfers, and separates realized from
 * unrealized.
 *
 * The presentation contract is fixed and matches spec §5 exactly:
 *
 *   realized (gross) + unrealized (gross) − fees = net
 *
 * so fees are subtracted once and only once. Realized entries also carry their
 * own fully-loaded `netPnl` for per-trade analytics; the two views are
 * reconcilable because open-lot fees are the only difference.
 */

import type {
  CostBasisState,
  FeeBreakdown,
  MonetaryValue,
  PnlBreakdown,
  PositionValuation,
  RealizedPnlEntry,
} from './types';
import {
  addValues,
  emptyFees,
  hasValue,
  known,
  round,
  safeDivide,
  subtractValues,
  sum,
  unknownValue,
  zero,
} from './utils';

export interface PositionPnlInput {
  costBasis: CostBasisState;
  valuation: PositionValuation;
  realizedEntries: RealizedPnlEntry[];
  /** All fees ever paid on this position, both sides. */
  fees: FeeBreakdown;
  quantity: number;
  symbol: string;
}

export function computePositionPnl(input: PositionPnlInput): PnlBreakdown {
  const limitations: string[] = [];

  // ── Realized (gross, before fees) ──
  const realized = input.realizedEntries.length
    ? addValues(
        input.realizedEntries.map((entry) => entry.grossPnl),
        'pnl_engine',
      )
    : zero('pnl_engine');

  if (input.realizedEntries.some((entry) => !hasValue(entry.grossPnl))) {
    limitations.push('Some disposals had no observable proceeds or cost basis, so realized P&L is partial.');
  }

  // ── Unrealized (gross, before fees) ──
  const unrealized = computeUnrealized(input, limitations);

  const total = combine(realized, unrealized);
  const net = hasValue(total)
    ? known(round(total.usd - input.fees.totalUsd, 6), 'pnl_engine', undefined, total.confidence)
    : unknownValue('Net P&L requires both realized and unrealized components', 'pnl_engine');

  const investedCapital = hasValue(input.costBasis.remainingCostBasis)
    ? input.costBasis.remainingCostBasis.usd
    : null;
  const realizedCapital = hasValue(input.costBasis.realizedCostBasis)
    ? input.costBasis.realizedCostBasis.usd
    : 0;
  const capitalBase = investedCapital !== null ? investedCapital + realizedCapital : null;

  const netReturnPct =
    hasValue(net) && capitalBase !== null && capitalBase > 0 ? safeDivide(net.usd, capitalBase) : null;

  const hasUnknownBasis =
    input.costBasis.unknownBasisQuantity > 0 ||
    input.realizedEntries.some((entry) => entry.unknownBasisQuantity > 0);

  if (hasUnknownBasis) {
    limitations.push(
      `${round(input.costBasis.unknownBasisQuantity, 6)} ${input.symbol} is held with no known acquisition cost; P&L on that portion is reported as unknown rather than assumed.`,
    );
  }

  return {
    realized,
    unrealized,
    total,
    fees: input.fees,
    net,
    netReturnPct,
    hasUnknownBasis,
    limitations,
  };
}

function computeUnrealized(input: PositionPnlInput, limitations: string[]): MonetaryValue {
  if (input.quantity <= 0) return zero('pnl_engine');

  const { markValue } = input.valuation;
  if (!hasValue(markValue)) {
    limitations.push('Unrealized P&L is unavailable because this position has no usable market price.');
    return { ...markValue, note: 'Unrealized P&L requires a market value' };
  }

  const basis = input.costBasis.remainingCostBasis;
  if (!hasValue(basis)) {
    limitations.push('Unrealized P&L is unknown because the remaining cost basis could not be determined.');
    return unknownValue('Remaining cost basis is unknown for this position', 'pnl_engine');
  }

  // Only the portion of the holding with a known basis can produce a
  // meaningful unrealized number; the rest is reported separately.
  const knownQuantity = input.costBasis.remainingQuantity - input.costBasis.unknownBasisQuantity;
  if (knownQuantity <= 0) {
    limitations.push('The entire remaining holding has an unknown cost basis, so unrealized P&L cannot be computed.');
    return unknownValue('No held quantity has a known acquisition cost', 'pnl_engine');
  }

  const coveredFraction =
    input.costBasis.remainingQuantity > 0 ? knownQuantity / input.costBasis.remainingQuantity : 0;
  const coveredMark: MonetaryValue = {
    ...markValue,
    usd: round(markValue.usd * coveredFraction, 6),
  };

  const unrealized = subtractValues(coveredMark, basis, 'pnl_engine');

  if (coveredFraction < 0.999) {
    limitations.push(
      `Unrealized P&L covers ${round(coveredFraction * 100, 1)}% of the holding; the remainder has no known cost basis.`,
    );
    return { ...unrealized, status: 'ESTIMATED', confidence: Math.min(unrealized.confidence, coveredFraction) };
  }

  return unrealized;
}

function combine(realized: MonetaryValue, unrealized: MonetaryValue): MonetaryValue {
  if (!hasValue(realized) && !hasValue(unrealized)) {
    return unknownValue('Neither realized nor unrealized P&L could be determined', 'pnl_engine');
  }
  return addValues([realized, unrealized], 'pnl_engine');
}

// ────────────────────────────────────────────────────────────────────────────
// Portfolio roll-up
// ────────────────────────────────────────────────────────────────────────────

export interface PortfolioPnlInput {
  positions: Array<{ pnl: PnlBreakdown }>;
}

export function aggregatePnl(input: PortfolioPnlInput): PnlBreakdown {
  const realized = addValues(input.positions.map((p) => p.pnl.realized), 'pnl_engine');
  const unrealized = addValues(input.positions.map((p) => p.pnl.unrealized), 'pnl_engine');
  const fees = input.positions.reduce<FeeBreakdown>(
    (acc, p) => ({
      tradingFeesUsd: round(acc.tradingFeesUsd + p.pnl.fees.tradingFeesUsd, 6),
      networkFeesUsd: round(acc.networkFeesUsd + p.pnl.fees.networkFeesUsd, 6),
      dexFeesUsd: round(acc.dexFeesUsd + p.pnl.fees.dexFeesUsd, 6),
      totalUsd: round(acc.totalUsd + p.pnl.fees.totalUsd, 6),
    }),
    emptyFees(),
  );

  const total = addValues([realized, unrealized], 'pnl_engine');
  const net = hasValue(total)
    ? known(round(total.usd - fees.totalUsd, 6), 'pnl_engine', undefined, total.confidence)
    : unknownValue('Portfolio net P&L requires at least one valued position', 'pnl_engine');

  const limitations = Array.from(new Set(input.positions.flatMap((p) => p.pnl.limitations)));

  return {
    realized,
    unrealized,
    total,
    fees,
    net,
    netReturnPct: null,
    hasUnknownBasis: input.positions.some((p) => p.pnl.hasUnknownBasis),
    limitations,
  };
}

/** Sum of per-trade fully-loaded net P&L, used for trading analytics. */
export function realizedNetSum(entries: RealizedPnlEntry[]): number {
  return round(sum(entries.filter((e) => hasValue(e.netPnl)).map((e) => e.netPnl.usd as number)), 6);
}

export class PortfolioPnlEngine {
  public calculatePositionPnl(
    tokenId: string,
    symbol: string,
    txs: import('./pnl-types').PortfolioTransaction[],
    currentPriceUsd: number,
    exitabilityScore = 70,
    liquidityDepthUsd = 10000,
    insiderRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
  ): Omit<import('./pnl-types').PortfolioPosition, 'exitabilityScore' | 'insiderRisk' | 'organicVolumePct' | 'portfolioWeightPct'> {
    let quantity = 0;
    let totalCostUsd = 0;
    let realizedPnlUsd = 0;
    let totalFees = 0;
    let totalGas = 0;
    let totalSlippage = 0;

    for (const tx of txs) {
      totalFees += tx.feesUsd;
      totalGas += tx.gasUsd;
      totalSlippage += tx.estimatedSlippageUsd;

      if (tx.category === 'BUY') {
        quantity += tx.quantity;
        totalCostUsd += tx.quantity * tx.priceUsd;
      } else if (tx.category === 'SELL') {
        const avgCost = quantity > 0 ? totalCostUsd / quantity : 0;
        const grossDisposalPnl = tx.quantity * (tx.priceUsd - avgCost);
        realizedPnlUsd += grossDisposalPnl;
        quantity -= tx.quantity;
        totalCostUsd -= tx.quantity * avgCost;
      }
    }

    const averageCostUsd = quantity > 0 ? totalCostUsd / quantity : 0;
    const marketValueUsd = quantity * currentPriceUsd;
    const unrealizedPnlUsd = quantity * (currentPriceUsd - averageCostUsd);
    const grossPnlUsd = realizedPnlUsd + unrealizedPnlUsd;
    const totalCosts = totalFees + totalGas + totalSlippage;
    const trueNetPnlUsd = grossPnlUsd - totalCosts;

    // Estimate executable value based on exitability & liquidity depth
    const impactFactor = Math.max(0.7, 1 - (marketValueUsd / (liquidityDepthUsd * 2 + 1)));
    const estimatedExecutableValueUsd = marketValueUsd * impactFactor;

    return {
      tokenId,
      symbol,
      quantity,
      averageCostUsd: round(averageCostUsd, 4),
      currentPriceUsd,
      marketValueUsd: round(marketValueUsd, 2),
      estimatedExecutableValueUsd: round(estimatedExecutableValueUsd, 2),
      grossPnlUsd: round(grossPnlUsd, 2),
      realizedPnlUsd: round(realizedPnlUsd, 2),
      unrealizedPnlUsd: round(unrealizedPnlUsd, 2),
      totalFeesPaidUsd: round(totalFees, 2),
      totalGasPaidUsd: round(totalGas, 2),
      totalSlippageUsd: round(totalSlippage, 2),
      trueNetPnlUsd: round(trueNetPnlUsd, 2)
    };
  }
}
