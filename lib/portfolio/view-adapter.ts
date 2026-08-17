/**
 * Adapts the `/api/v1/portfolio/:wallet` response into the flat shape the
 * portfolio view renders.
 *
 * Why an adapter rather than changing either side:
 *
 * The view was written against `/api/portfolio`, an unversioned route that ran
 * Birdeye holdings through a *synthesised* transaction (one fabricated BUY at
 * 90% of spot) and fell back to four hardcoded demo tokens whenever Birdeye was
 * rate-limited — which, with no API key configured, is always. Its output type
 * (`PortfolioSummary`/`PortfolioPosition`) is flat numbers.
 *
 * The real engine (`lib/portfolio/*`, reached via `/api/v1/portfolio/:wallet`)
 * models value as `MonetaryValue`: a number *plus* a status, because a price
 * that could not be determined is not zero. Its `Position` carries cost basis,
 * valuation, P&L and risk as separate sub-objects.
 *
 * Rewriting the view onto the richer types would be the larger change; this
 * mapper is the smaller one, and it keeps the honest-value semantics visible
 * rather than silently flattening them. Two rules it follows:
 *
 *  - `MonetaryValue.usd` is `number | null` and null means *unknown*, never 0.
 *    Where the view's type demands a number, null becomes 0 for layout only,
 *    and the field is named in `unknownFields` so the caller can mark it
 *    unavailable instead of showing a confident "$0.00".
 *  - `sharePct` on the wire is a 0–1 fraction; the view renders percentages.
 *    Converting is this file's job, done once, not at each call site.
 */

import type {
  MonetaryValue,
  PortfolioOverview,
  Position,
  RiskBand,
} from './types';
import type { PortfolioPosition, PortfolioSummary } from './pnl-types';

export interface AdaptedPortfolio {
  summary: PortfolioSummary;
  /**
   * Summary fields whose true value is unknown rather than zero. The view
   * should render these as "—" rather than a number.
   */
  unknownFields: string[];
  /** Engine-reported caveats (missing prices, unpriced positions, stale data). */
  limitations: string[];
}

/** Reads a MonetaryValue for display, recording the field when the value is unknown. */
function usd(value: MonetaryValue | undefined, field: string, unknown: string[]): number {
  if (!value || value.usd === null || value.usd === undefined) {
    unknown.push(field);
    return 0;
  }
  return value.usd;
}

/** The view's three-level concentration scale, from the largest single holding's share. */
function concentrationFrom(sharePctFraction: number | undefined): PortfolioSummary['concentrationRisk'] {
  if (sharePctFraction === undefined) return 'LOW';
  const pct = sharePctFraction * 100;
  if (pct >= 50) return 'HIGH';
  if (pct >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * The view's liquidity scale, from how many positions the engine flagged as
 * having an exitability problem. A portfolio with no positions is 'GOOD'
 * (nothing illiquid) rather than 'POOR' — an empty portfolio has no problem.
 */
function liquidityFrom(issueCount: number, positionCount: number): PortfolioSummary['liquidityHealth'] {
  if (positionCount === 0) return 'GOOD';
  const ratio = issueCount / positionCount;
  if (ratio >= 0.5) return 'POOR';
  if (ratio > 0) return 'MODERATE';
  return 'GOOD';
}

const HIGH_RISK_BANDS: RiskBand[] = ['HIGH', 'SEVERE'];

/** Fraction of mark value sitting in HIGH/SEVERE risk-band positions, as a percentage. */
function highRiskSharePct(positions: Position[]): number {
  let total = 0;
  let risky = 0;
  for (const position of positions) {
    const mark = position.valuation?.markValue?.usd;
    if (mark === null || mark === undefined) continue;
    total += mark;
    if (HIGH_RISK_BANDS.includes(position.risk?.band)) risky += mark;
  }
  return total > 0 ? (risky / total) * 100 : 0;
}

/**
 * Value-weighted exitability across positions, 0–100.
 *
 * Weighted rather than a plain mean because a 95%-of-portfolio position that
 * cannot be exited is not offset by nine dust positions that can.
 */
function weightedExitability(positions: Position[]): number | null {
  let weight = 0;
  let score = 0;
  for (const position of positions) {
    const mark = position.valuation?.markValue?.usd;
    const exit = position.exitability?.score;
    if (mark === null || mark === undefined || exit === undefined) continue;
    weight += mark;
    score += exit * mark;
  }
  return weight > 0 ? score / weight : null;
}

export function adaptPortfolioSummary(
  overview: PortfolioOverview,
  positions: Position[] = [],
  engineLimitations: string[] = [],
): AdaptedPortfolio {
  const unknownFields: string[] = [];
  const limitations = [...engineLimitations, ...(overview.limitations ?? [])];

  const exitability = weightedExitability(positions);
  if (exitability === null && positions.length > 0) {
    unknownFields.push('overallExitability');
  }

  const summary: PortfolioSummary = {
    totalReportedValueUsd: usd(overview.totalValue, 'totalReportedValueUsd', unknownFields),
    estimatedExecutableValueUsd: usd(
      overview.estimatedExitValue,
      'estimatedExecutableValueUsd',
      unknownFields,
    ),
    trueNetPnlUsd: usd(overview.netPnl, 'trueNetPnlUsd', unknownFields),
    realizedPnlUsd: usd(overview.realizedPnl, 'realizedPnlUsd', unknownFields),
    unrealizedPnlUsd: usd(overview.unrealizedPnl, 'unrealizedPnlUsd', unknownFields),
    knownCostsUsd: overview.fees?.totalUsd ?? 0,
    concentrationRisk: concentrationFrom(overview.exposureSummary?.largestToken?.sharePct),
    liquidityHealth: liquidityFrom(overview.exitabilityIssueCount ?? 0, overview.positionCount ?? 0),
    overallExitability: exitability ?? 0,
    // The engine has no insider-specific portfolio metric. The view labels this
    // "assets with high potential cluster risk", so it is fed the share of value
    // in HIGH/SEVERE risk-band positions — related, but not identical, which is
    // why it is called out here rather than left to look like a direct mapping.
    insiderExposurePct: Math.round(highRiskSharePct(positions) * 10) / 10,
  };

  if (overview.unvaluedPositionIds?.length) {
    limitations.push(
      `${overview.unvaluedPositionIds.length} position(s) could not be valued and are excluded from totals.`,
    );
  }

  return { summary, unknownFields, limitations };
}

/** Maps one engine `Position` onto the flat row the view's table renders. */
export function adaptPosition(position: Position): PortfolioPosition {
  const mark = position.valuation?.markValue?.usd ?? 0;
  const exit = position.valuation?.estimatedExitValue?.usd ?? mark;
  const fees = position.pnl?.fees;

  return {
    tokenId: position.tokenId,
    symbol: position.symbol,
    quantity: position.quantity,
    averageCostUsd: position.costBasis?.averageCostUsd?.usd ?? 0,
    currentPriceUsd: position.valuation?.price?.priceUsd ?? (position.quantity > 0 ? mark / position.quantity : 0),

    marketValueUsd: mark,
    estimatedExecutableValueUsd: exit,

    grossPnlUsd: position.pnl?.total?.usd ?? 0,
    realizedPnlUsd: position.pnl?.realized?.usd ?? 0,
    unrealizedPnlUsd: position.pnl?.unrealized?.usd ?? 0,

    totalFeesPaidUsd: fees?.tradingFeesUsd ?? 0,
    totalGasPaidUsd: fees?.networkFeesUsd ?? 0,
    totalSlippageUsd: fees?.dexFeesUsd ?? 0,

    trueNetPnlUsd: position.pnl?.net?.usd ?? 0,

    exitabilityScore: position.exitability?.score ?? 0,
    insiderRisk: mapRiskBand(position.risk?.band),
    organicVolumePct: 0,
    // allocationPct is 0–1 on the wire; the view renders a percentage.
    portfolioWeightPct: (position.allocationPct ?? 0) * 100,
  };
}

/**
 * The engine's five risk bands onto the view's four levels.
 * MODERATE and ELEVATED both land on MEDIUM — the view has no separate rung,
 * and rounding ELEVATED down to LOW would understate it.
 */
function mapRiskBand(band: RiskBand | undefined): PortfolioPosition['insiderRisk'] {
  switch (band) {
    case 'SEVERE':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'MODERATE':
    case 'ELEVATED':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}
