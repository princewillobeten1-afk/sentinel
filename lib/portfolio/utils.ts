/**
 * Shared helpers for the Portfolio Intelligence engines.
 *
 * The most important thing in this file is the `MonetaryValue` algebra. The
 * whole portfolio system depends on never silently turning "unknown" into 0
 * (spec §44), so arithmetic on money goes through these helpers rather than
 * through raw `+`.
 */

import type { Evidence } from '@/lib/intelligence/types';
import type {
  FeeBreakdown,
  HoldingBucket,
  HoldingThresholds,
  MonetaryValue,
  RiskBand,
  RiskClass,
  SampleAdequacy,
  SampleSize,
  SampledMetric,
  ValueStatus,
} from './types';

export const PORTFOLIO_VERSION = 'sentinel-portfolio-v1.0.0';
export const POSITION_RISK_VERSION = 'sentinel-position-risk-v1.0.0';
export const PORTFOLIO_RISK_VERSION = 'sentinel-portfolio-risk-v1.0.0';
export const COST_BASIS_VERSION = 'sentinel-cost-basis-v1.0.0';
export const PERFORMANCE_VERSION = 'sentinel-performance-v1.0.0';

/** Default price staleness budget in seconds (spec §42). */
export const DEFAULT_PRICE_FRESHNESS_SECONDS = 120;

/** Below this notional a position is treated as dust, not a holding. */
export const DUST_VALUE_USD = 1;

/** Below this quantity a position is considered fully closed. */
export const QUANTITY_EPSILON = 1e-9;

export const DEFAULT_HOLDING_THRESHOLDS: HoldingThresholds = {
  scalpMaxHours: 1,
  intradayMaxHours: 24,
  swingMaxHours: 24 * 14,
};

/** Sample-size gates for statistically meaningful metrics (spec §36, §37). */
export const SAMPLE_GATES = {
  winRate: 20,
  averageReturn: 20,
  profitFactor: 20,
  expectancy: 20,
  sharpe: 30,
  sortino: 30,
  holdingPeriod: 5,
  drawdown: 5,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Numeric helpers
// ────────────────────────────────────────────────────────────────────────────

export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, places = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return sum(values) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg === null) return null;
  const variance = sum(values.map((value) => (value - avg) ** 2)) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Downside deviation against a zero target, used for Sortino-like metrics. */
export function downsideDeviation(values: number[]): number | null {
  const downside = values.filter((value) => value < 0);
  if (downside.length < 2) return null;
  const variance = sum(downside.map((value) => value ** 2)) / (downside.length - 1);
  return Math.sqrt(variance);
}

export function herfindahl(shares: number[]): number {
  return round(sum(shares.map((value) => value ** 2)), 6);
}

export function toTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function hoursBetween(fromIso: string, toIso: string): number {
  const delta = toTimestamp(toIso) - toTimestamp(fromIso);
  return delta <= 0 ? 0 : delta / 3_600_000;
}

// ────────────────────────────────────────────────────────────────────────────
// MonetaryValue algebra (spec §44)
// ────────────────────────────────────────────────────────────────────────────

export function known(usd: number, source?: string, observedAt?: string, confidence = 1): MonetaryValue {
  return { status: 'KNOWN', usd: round(usd, 6), confidence: clamp(confidence, 0, 1), source, observedAt };
}

export function estimated(usd: number, source: string, observedAt?: string, confidence = 0.7): MonetaryValue {
  return { status: 'ESTIMATED', usd: round(usd, 6), confidence: clamp(confidence, 0, 1), source, observedAt };
}

export function stale(usd: number, source: string, observedAt: string, confidence = 0.4): MonetaryValue {
  return {
    status: 'STALE',
    usd: round(usd, 6),
    confidence: clamp(confidence, 0, 1),
    source,
    observedAt,
    note: 'Price is older than the freshness budget',
  };
}

export function unknownValue(note: string, source?: string): MonetaryValue {
  return { status: 'UNKNOWN', usd: null, confidence: 0, source, note };
}

export function unavailable(note: string, source?: string): MonetaryValue {
  return { status: 'UNAVAILABLE', usd: null, confidence: 0, source, note };
}

export function zero(source = 'derived'): MonetaryValue {
  return { status: 'KNOWN', usd: 0, confidence: 1, source };
}

export function hasValue(value: MonetaryValue): value is MonetaryValue & { usd: number } {
  return value.usd !== null && Number.isFinite(value.usd);
}

/** Numeric value or `fallback`. Use only where a null genuinely means "skip". */
export function valueOr(value: MonetaryValue, fallback: number): number {
  return hasValue(value) ? value.usd : fallback;
}

const STATUS_RANK: Record<ValueStatus, number> = {
  KNOWN: 0,
  ESTIMATED: 1,
  STALE: 2,
  UNKNOWN: 3,
  UNAVAILABLE: 4,
};

/** The weakest status wins when combining values. */
export function worstStatus(statuses: ValueStatus[]): ValueStatus {
  if (statuses.length === 0) return 'KNOWN';
  return statuses.reduce((worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst), 'KNOWN' as ValueStatus);
}

/**
 * Adds monetary values. Unknown/unavailable terms do NOT contribute a zero —
 * they degrade the status of the result so callers can see the total is partial.
 */
export function addValues(values: MonetaryValue[], source = 'aggregate'): MonetaryValue {
  if (values.length === 0) return zero(source);

  const usable = values.filter(hasValue);
  const missing = values.filter((value) => !hasValue(value));

  if (usable.length === 0) {
    const status = worstStatus(values.map((value) => value.status));
    return status === 'UNAVAILABLE'
      ? unavailable('No component values were available', source)
      : unknownValue('No component values were known', source);
  }

  const total = sum(usable.map((value) => value.usd));
  const status = worstStatus(usable.map((value) => value.status));
  const confidence = mean(usable.map((value) => value.confidence)) ?? 0;

  if (missing.length > 0) {
    return {
      status: 'ESTIMATED',
      usd: round(total, 6),
      confidence: clamp(confidence * (usable.length / values.length), 0, 1),
      source,
      note: `${missing.length} of ${values.length} components had no value and are excluded`,
    };
  }

  return { status, usd: round(total, 6), confidence: clamp(confidence, 0, 1), source };
}

export function subtractValues(a: MonetaryValue, b: MonetaryValue, source = 'derived'): MonetaryValue {
  if (!hasValue(a) || !hasValue(b)) {
    const status = worstStatus([a.status, b.status]);
    return status === 'UNAVAILABLE'
      ? unavailable('One side of the subtraction was unavailable', source)
      : unknownValue('One side of the subtraction was unknown', source);
  }
  return {
    status: worstStatus([a.status, b.status]),
    usd: round(a.usd - b.usd, 6),
    confidence: Math.min(a.confidence, b.confidence),
    source,
  };
}

export function scaleValue(value: MonetaryValue, factor: number, source = 'derived'): MonetaryValue {
  if (!hasValue(value)) return { ...value, source };
  return { ...value, usd: round(value.usd * factor, 6), source };
}

export function emptyFees(): FeeBreakdown {
  return { tradingFeesUsd: 0, networkFeesUsd: 0, dexFeesUsd: 0, totalUsd: 0 };
}

export function addFees(...breakdowns: FeeBreakdown[]): FeeBreakdown {
  const result = breakdowns.reduce<FeeBreakdown>(
    (acc, fee) => ({
      tradingFeesUsd: acc.tradingFeesUsd + fee.tradingFeesUsd,
      networkFeesUsd: acc.networkFeesUsd + fee.networkFeesUsd,
      dexFeesUsd: acc.dexFeesUsd + fee.dexFeesUsd,
      totalUsd: acc.totalUsd + fee.totalUsd,
    }),
    emptyFees(),
  );
  return {
    tradingFeesUsd: round(result.tradingFeesUsd, 6),
    networkFeesUsd: round(result.networkFeesUsd, 6),
    dexFeesUsd: round(result.dexFeesUsd, 6),
    totalUsd: round(result.totalUsd, 6),
  };
}

export function feesFromEvent(event: {
  tradingFeeUsd?: number;
  networkFeeUsd?: number;
  dexFeeUsd?: number;
}): FeeBreakdown {
  const trading = event.tradingFeeUsd ?? 0;
  const network = event.networkFeeUsd ?? 0;
  const dex = event.dexFeeUsd ?? 0;
  return {
    tradingFeesUsd: round(trading, 6),
    networkFeesUsd: round(network, 6),
    dexFeesUsd: round(dex, 6),
    totalUsd: round(trading + network + dex, 6),
  };
}

export function scaleFees(fees: FeeBreakdown, factor: number): FeeBreakdown {
  return {
    tradingFeesUsd: round(fees.tradingFeesUsd * factor, 6),
    networkFeesUsd: round(fees.networkFeesUsd * factor, 6),
    dexFeesUsd: round(fees.dexFeesUsd * factor, 6),
    totalUsd: round(fees.totalUsd * factor, 6),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Bands & classes
// ────────────────────────────────────────────────────────────────────────────

export function riskBand(score: number): RiskBand {
  if (score >= 80) return 'SEVERE';
  if (score >= 65) return 'HIGH';
  if (score >= 45) return 'ELEVATED';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

export function riskClassOf(score: number | null): RiskClass {
  if (score === null || !Number.isFinite(score)) return 'UNKNOWN';
  if (score >= 65) return 'HIGH';
  if (score >= 35) return 'MODERATE';
  return 'LOW';
}

/**
 * Band for "how big is this position relative to what the market can absorb".
 * `null` means we could not measure it, which is reported as the non-committal
 * middle band rather than as "low" (spec §44).
 */
export function liquidityExposureBand(worstRatio: number | null): RiskBand {
  if (worstRatio === null || !Number.isFinite(worstRatio)) return 'MODERATE';
  if (worstRatio >= 0.75) return 'SEVERE';
  if (worstRatio >= 0.4) return 'HIGH';
  if (worstRatio >= 0.15) return 'ELEVATED';
  if (worstRatio >= 0.05) return 'MODERATE';
  return 'LOW';
}

export function holdingBucket(hours: number, thresholds = DEFAULT_HOLDING_THRESHOLDS): HoldingBucket {
  if (hours <= thresholds.scalpMaxHours) return 'SCALP';
  if (hours <= thresholds.intradayMaxHours) return 'INTRADAY';
  if (hours <= thresholds.swingMaxHours) return 'SWING';
  return 'LONG_TERM';
}

// ────────────────────────────────────────────────────────────────────────────
// Sample sizing (spec §36, §37)
// ────────────────────────────────────────────────────────────────────────────

export function sampleSize(count: number, minimumForConfidence: number): SampleSize {
  let adequacy: SampleAdequacy;
  if (count === 0) adequacy = 'INSUFFICIENT';
  else if (count < Math.ceil(minimumForConfidence / 4)) adequacy = 'INSUFFICIENT';
  else if (count < Math.ceil(minimumForConfidence / 2)) adequacy = 'LOW';
  else if (count < minimumForConfidence) adequacy = 'MODERATE';
  else adequacy = 'ADEQUATE';

  const note =
    adequacy === 'ADEQUATE'
      ? `${count} observations — sample meets the ${minimumForConfidence} threshold`
      : `${count} observations — below the ${minimumForConfidence} needed for a confident read`;

  return { count, adequacy, minimumForConfidence, note };
}

/**
 * Builds a metric that carries its own sample size. When the sample is empty
 * the value is reported as UNKNOWN rather than 0, and when the sample is merely
 * small the value is still returned but flagged ESTIMATED so the UI can make
 * the small sample obvious (spec §37).
 */
export function sampled(
  value: number | null,
  count: number,
  minimumForConfidence: number,
  unit: SampledMetric['unit'] = 'COUNT',
): SampledMetric {
  const sample = sampleSize(count, minimumForConfidence);
  if (value === null || !Number.isFinite(value) || count === 0) {
    return { value: null, status: 'UNKNOWN', sample, unit };
  }
  return {
    value: round(value, 6),
    status: sample.adequacy === 'ADEQUATE' ? 'KNOWN' : 'ESTIMATED',
    sample,
    unit,
  };
}

/**
 * Statistically meaningless metrics are suppressed entirely rather than
 * displayed with a caveat (spec §36).
 */
export function suppressedBelow(
  value: number | null,
  count: number,
  minimumForConfidence: number,
  unit: SampledMetric['unit'] = 'RATIO',
): SampledMetric {
  const sample = sampleSize(count, minimumForConfidence);
  if (value === null || !Number.isFinite(value) || count < Math.ceil(minimumForConfidence / 2)) {
    return {
      value: null,
      status: 'UNKNOWN',
      sample: { ...sample, note: `Suppressed: ${count} observations is not enough to be meaningful` },
      unit,
    };
  }
  return { value: round(value, 6), status: sample.adequacy === 'ADEQUATE' ? 'KNOWN' : 'ESTIMATED', sample, unit };
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting & evidence
// ────────────────────────────────────────────────────────────────────────────

export function evidence(
  fact: string,
  source: string,
  observedAt: string,
  value: string | number,
  confidence: number,
): Evidence {
  return { fact, source, observedAt, value, confidence: clamp(confidence, 0, 1) };
}

export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${round(abs / 1_000_000, 2)}M`;
  if (abs >= 1_000) return `${sign}$${round(abs / 1_000, 1)}K`;
  return `${sign}$${round(abs, 2)}`;
}

export function formatValue(value: MonetaryValue): string {
  switch (value.status) {
    case 'UNKNOWN':
      return 'Unknown';
    case 'UNAVAILABLE':
      return 'Unavailable';
    default:
      return formatUsd(value.usd);
  }
}

export function formatPct(value: number | null, places = 1): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  return `${round(value * 100, places)}%`;
}
