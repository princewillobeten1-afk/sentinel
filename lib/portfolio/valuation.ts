/**
 * Position Valuation (spec §12, §13, §20, §42, §43)
 *
 * Three different numbers, never conflated:
 *   markValue           — quantity × price. What every other app shows.
 *   estimatedExitValue  — what Sprint 8's Exitability Engine says you could
 *                         realistically get out for right now.
 *   stressExitValue     — what you could get out for if everyone left at once.
 *
 * A displayed value that cannot be executed is not a portfolio value. When
 * liquidity cannot support the position, we surface the gap instead of quietly
 * showing a headline number that is not achievable (spec §43).
 */

import type { ExitabilityReport } from '@/lib/exitability/types';
import type {
  MonetaryValue,
  PositionExitability,
  PositionValuation,
  PriceQuote,
} from './types';
import {
  DEFAULT_PRICE_FRESHNESS_SECONDS,
  estimated,
  known,
  round,
  safeDivide,
  stale,
  unavailable,
} from './utils';

export interface ValuationInput {
  tokenId: string;
  chain: string;
  quantity: number;
  price?: PriceQuote;
  exitability?: ExitabilityReport;
  freshnessSeconds?: number;
  observedAt: string;
}

/**
 * Normalises an incoming price quote against the freshness budget. A stale
 * price is reported as STALE rather than used silently (spec §42).
 */
export function resolvePriceQuote(
  tokenId: string,
  chain: string,
  quote: PriceQuote | undefined,
  observedAt: string,
  freshnessSeconds = DEFAULT_PRICE_FRESHNESS_SECONDS,
): PriceQuote {
  if (!quote || quote.priceUsd === null || !Number.isFinite(quote.priceUsd)) {
    return {
      tokenId,
      chain,
      priceUsd: null,
      priceSource: quote?.priceSource ?? 'none',
      priceTimestamp: quote?.priceTimestamp ?? observedAt,
      confidence: 0,
      status: 'UNAVAILABLE',
    };
  }

  const ageSeconds = Math.max(0, (Date.parse(observedAt) - Date.parse(quote.priceTimestamp)) / 1000);
  const isStale = Number.isFinite(ageSeconds) && ageSeconds > freshnessSeconds;

  return {
    ...quote,
    tokenId,
    chain,
    ageSeconds: round(ageSeconds, 2),
    status: isStale ? 'STALE' : quote.status === 'ESTIMATED' ? 'ESTIMATED' : 'KNOWN',
    confidence: isStale ? Math.min(quote.confidence, 0.4) : quote.confidence,
  };
}

export function valuePosition(input: ValuationInput): PositionValuation {
  const price = resolvePriceQuote(
    input.tokenId,
    input.chain,
    input.price,
    input.observedAt,
    input.freshnessSeconds,
  );

  const markValue = buildMarkValue(price, input.quantity);
  const { estimatedExitValue, stressExitValue } = buildExitValues(markValue, input.exitability, input.observedAt);

  const exitDiscountPct =
    markValue.usd !== null && markValue.usd > 0 && estimatedExitValue.usd !== null
      ? round((markValue.usd - estimatedExitValue.usd) / markValue.usd, 6)
      : null;

  return { price, markValue, estimatedExitValue, stressExitValue, exitDiscountPct, isEstimate: true };
}

function buildMarkValue(price: PriceQuote, quantity: number): MonetaryValue {
  if (price.priceUsd === null) {
    return unavailable(
      'VALUE_UNAVAILABLE — no price source could serve this token, and a stale value is not substituted',
      price.priceSource,
    );
  }
  const value = price.priceUsd * quantity;
  if (price.status === 'STALE') {
    return stale(value, price.priceSource, price.priceTimestamp, price.confidence);
  }
  return known(value, price.priceSource, price.priceTimestamp, price.confidence);
}

function buildExitValues(
  markValue: MonetaryValue,
  report: ExitabilityReport | undefined,
  observedAt: string,
): { estimatedExitValue: MonetaryValue; stressExitValue: MonetaryValue } {
  if (markValue.usd === null) {
    return {
      estimatedExitValue: unavailable('Exit value cannot be estimated without a market value', 'exitability_engine'),
      stressExitValue: unavailable('Stress exit value cannot be estimated without a market value', 'exitability_engine'),
    };
  }

  if (!report) {
    // No exitability data: we do not pretend the mark is executable.
    return {
      estimatedExitValue: unavailable(
        'No exitability analysis is available for this token, so an executable value cannot be estimated',
        'exitability_engine',
      ),
      stressExitValue: unavailable(
        'No exitability analysis is available for this token',
        'exitability_engine',
      ),
    };
  }

  const recovery = recoveryRatio(report, markValue.usd);
  const stressRecovery = recovery * stressFactor(report);

  return {
    estimatedExitValue: estimated(
      markValue.usd * recovery,
      'exitability_engine',
      observedAt,
      report.confidence / 100,
    ),
    stressExitValue: estimated(
      markValue.usd * stressRecovery,
      'exitability_engine',
      observedAt,
      Math.max(0.2, (report.confidence / 100) * 0.8),
    ),
  };
}

/**
 * Fraction of mark value recoverable on exit, read off Sprint 8's exitability
 * curve at *this* position's size.
 *
 * Sprint 8 already simulates execution across a ladder of position sizes, so
 * rather than re-deriving impact we interpolate its curve at the actual mark
 * value. This matters because recovery is strongly size-dependent: the same
 * token can return 98% on $5K and 65% on $100K.
 */
function recoveryRatio(report: ExitabilityReport, markValueUsd: number): number {
  const curve = report.curve
    .filter((point) => point.positionUsd > 0 && Number.isFinite(point.expectedProceedsUsd))
    .sort((a, b) => a.positionUsd - b.positionUsd);

  if (curve.length === 0) return referenceRatio(report);
  if (markValueUsd <= curve[0].positionUsd) return clampRatio(pointRatio(curve[0]));

  for (let i = 0; i < curve.length - 1; i += 1) {
    const lower = curve[i];
    const upper = curve[i + 1];
    if (markValueUsd <= upper.positionUsd) {
      const span = upper.positionUsd - lower.positionUsd;
      const t = span > 0 ? (markValueUsd - lower.positionUsd) / span : 0;
      return clampRatio(pointRatio(lower) + t * (pointRatio(upper) - pointRatio(lower)));
    }
  }

  // Beyond the simulated ladder: continue the final segment's slope and apply a
  // depth guard, because past the last simulated size we are extrapolating.
  const last = curve[curve.length - 1];
  const previous = curve.length > 1 ? curve[curve.length - 2] : last;
  const span = last.positionUsd - previous.positionUsd;
  const slope = span > 0 ? (pointRatio(last) - pointRatio(previous)) / span : 0;
  const extrapolated = pointRatio(last) + slope * (markValueUsd - last.positionUsd);

  const depth5 = report.exitDepth.find((point) => point.impactPct === 5)?.absorbableUsd ?? 0;
  const depthPressure = depth5 > 0 ? markValueUsd / depth5 : 1;
  const depthGuard = depthPressure > 1 ? 1 / (1 + 0.25 * (depthPressure - 1)) : 1;

  return clampRatio(extrapolated * depthGuard);
}

function pointRatio(point: { positionUsd: number; expectedProceedsUsd: number }): number {
  return point.positionUsd > 0 ? point.expectedProceedsUsd / point.positionUsd : 0;
}

function referenceRatio(report: ExitabilityReport): number {
  const simulation = report.referenceSimulation;
  if (simulation.positionUsd > 0 && simulation.expectedProceedsUsd > 0) {
    return clampRatio(simulation.expectedProceedsUsd / simulation.positionUsd);
  }
  return clampRatio(1 - Math.min(0.9, simulation.priceImpactPct / 100 + simulation.slippagePct / 100));
}

function stressFactor(report: ExitabilityReport): number {
  const normal = Math.max(1, report.score);
  const stressed = Math.max(0, report.stressScore);
  // A stress score far below the normal score means simultaneous exit is costly.
  return clampRatio(0.55 + 0.45 * (stressed / normal));
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return round(Math.max(0.01, Math.min(1, value)), 6);
}

export function toPositionExitability(report: ExitabilityReport): PositionExitability {
  return {
    score: report.score,
    stressScore: report.stressScore,
    interpretation: report.interpretation,
    usableLiquidityUsd: report.liquidity.usableLiquidityUsd,
    priceImpactPct: report.referenceSimulation.priceImpactPct,
    slippagePct: report.referenceSimulation.slippagePct,
    confidence: report.confidence / 100,
    generatedAt: report.generatedAt,
  };
}

/**
 * Materiality check for spec §43: a position whose mark value dwarfs the
 * liquidity that could absorb it must not be displayed as a plain number.
 */
export function isIlliquidRelativeToPosition(
  markValueUsd: number | null,
  usableLiquidityUsd: number | null,
): boolean {
  if (markValueUsd === null || usableLiquidityUsd === null) return false;
  const ratio = safeDivide(markValueUsd, usableLiquidityUsd);
  return ratio !== null && ratio >= 0.25;
}
