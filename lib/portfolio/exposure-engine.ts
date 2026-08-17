/**
 * Exposure Engine (spec §17, §18, §19)
 *
 * Answers "where is my portfolio concentrated?" along four axes — token, chain,
 * risk class and creator — plus concentration statistics and liquidity-adjusted
 * exposure.
 *
 * Two rules shape this file:
 *  1. Positions we cannot value are excluded from percentages and reported
 *     separately, so shares always sum against a measured base (spec §44).
 *  2. Concentration produces observations, never instructions (spec §18, §63).
 */

import type {
  ConcentrationAnalysis,
  ExposureBucket,
  ExposureReport,
  LiquidityAdjustedExposure,
  Position,
  RiskClass,
  TokenMetaInput,
} from './types';
import { hasValue, herfindahl, liquidityExposureBand, riskClassOf, round, sum } from './utils';

export interface ExposureInput {
  portfolioId: string;
  positions: Position[];
  tokens: Record<string, TokenMetaInput>;
  observedAt: string;
}

/** A position/liquidity ratio at or above this is treated as illiquid exposure. */
export const ILLIQUID_RATIO_THRESHOLD = 0.15;

export function buildExposure(input: ExposureInput): ExposureReport {
  const open = input.positions.filter((position) => position.status !== 'CLOSED');
  const valued = open.filter((position) => hasValue(position.valuation.markValue));
  const unvalued = open.filter((position) => !hasValue(position.valuation.markValue));

  const totalMeasured = round(sum(valued.map((p) => p.valuation.markValue.usd as number)), 2);
  const limitations: string[] = [];

  if (unvalued.length > 0) {
    limitations.push(
      `${unvalued.length} position(s) could not be valued and are excluded from every exposure percentage.`,
    );
  }

  const byToken = bucketBy(
    valued,
    totalMeasured,
    (position) => position.tokenId,
    (position) => position.symbol,
  );

  const byChain = bucketBy(
    valued,
    totalMeasured,
    (position) => position.chain,
    (position) => chainLabel(position.chain),
  );

  const byRiskClass = bucketByRiskClass(valued, totalMeasured);

  const byCreator = bucketBy(
    valued.filter((position) => Boolean(input.tokens[position.tokenId]?.creatorId)),
    totalMeasured,
    (position) => input.tokens[position.tokenId]?.creatorId ?? 'unknown',
    (position) => input.tokens[position.tokenId]?.creatorLabel ?? 'Unattributed creator',
  );

  if (byCreator.length === 0 && valued.length > 0) {
    limitations.push('No creator relationships could be reliably established, so creator exposure is not reported.');
  }

  const liquidityAdjusted = valued.map(buildLiquidityAdjusted);
  const illiquidValue = sum(
    liquidityAdjusted
      .filter((entry) => entry.liquidityRatio !== null && entry.liquidityRatio >= ILLIQUID_RATIO_THRESHOLD)
      .map((entry) => entry.positionValueUsd),
  );

  const concentration = analyzeConcentration(valued, totalMeasured, unvalued.map((p) => p.id));

  return {
    portfolioId: input.portfolioId,
    totalMeasuredValueUsd: totalMeasured,
    unmeasuredValueUsd: 0,
    byToken,
    byChain,
    byRiskClass,
    byCreator,
    concentration,
    liquidityAdjusted,
    illiquidSharePct: totalMeasured > 0 ? round(illiquidValue / totalMeasured, 6) : 0,
    limitations,
    generatedAt: input.observedAt,
  };
}

function bucketBy(
  positions: Position[],
  total: number,
  keyOf: (position: Position) => string,
  labelOf: (position: Position) => string,
): ExposureBucket[] {
  const buckets = new Map<string, ExposureBucket>();

  for (const position of positions) {
    const key = keyOf(position);
    const value = position.valuation.markValue.usd as number;
    const existing = buckets.get(key);
    if (existing) {
      existing.valueUsd = round(existing.valueUsd + value, 2);
      existing.positionIds.push(position.id);
      existing.confidence = Math.min(existing.confidence, position.valuation.markValue.confidence);
    } else {
      buckets.set(key, {
        key,
        label: labelOf(position),
        valueUsd: round(value, 2),
        sharePct: 0,
        positionIds: [position.id],
        confidence: position.valuation.markValue.confidence,
      });
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({ ...bucket, sharePct: total > 0 ? round(bucket.valueUsd / total, 6) : 0 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

function bucketByRiskClass(positions: Position[], total: number): ExposureBucket[] {
  const order: RiskClass[] = ['LOW', 'MODERATE', 'HIGH', 'UNKNOWN'];
  const buckets = new Map<RiskClass, ExposureBucket>();

  for (const position of positions) {
    const riskClass: RiskClass =
      position.risk.confidence < 0.35 ? 'UNKNOWN' : riskClassOf(position.risk.score);
    const value = position.valuation.markValue.usd as number;
    const existing = buckets.get(riskClass);
    if (existing) {
      existing.valueUsd = round(existing.valueUsd + value, 2);
      existing.positionIds.push(position.id);
    } else {
      buckets.set(riskClass, {
        key: riskClass,
        label: riskClassLabel(riskClass),
        valueUsd: round(value, 2),
        sharePct: 0,
        positionIds: [position.id],
        confidence: position.risk.confidence,
      });
    }
  }

  return order
    .filter((riskClass) => buckets.has(riskClass))
    .map((riskClass) => {
      const bucket = buckets.get(riskClass) as ExposureBucket;
      return { ...bucket, sharePct: total > 0 ? round(bucket.valueUsd / total, 6) : 0 };
    });
}

function analyzeConcentration(
  positions: Position[],
  total: number,
  unmeasuredPositionIds: string[],
): ConcentrationAnalysis {
  const sorted = [...positions].sort(
    (a, b) => (b.valuation.markValue.usd as number) - (a.valuation.markValue.usd as number),
  );

  const shares = sorted.map((position) =>
    total > 0 ? (position.valuation.markValue.usd as number) / total : 0,
  );

  const largest = shares[0] ?? null;
  const top3 = shares.length > 0 ? round(sum(shares.slice(0, 3)), 6) : null;
  const top5 = shares.length > 0 ? round(sum(shares.slice(0, 5)), 6) : null;
  const hhi = herfindahl(shares);

  const observations: string[] = [];
  if (largest !== null && largest >= 0.4) {
    observations.push(
      `Concentration is high: ${round(largest * 100, 1)}% of measured value sits in ${sorted[0].symbol}.`,
    );
  } else if (largest !== null && largest >= 0.25) {
    observations.push(
      `${sorted[0].symbol} accounts for ${round(largest * 100, 1)}% of measured value.`,
    );
  }
  if (top3 !== null && top3 >= 0.75 && sorted.length > 3) {
    observations.push(`The top 3 positions hold ${round(top3 * 100, 1)}% of measured value.`);
  }
  if (sorted.length <= 2 && sorted.length > 0) {
    observations.push(`Only ${sorted.length} valued position(s) — the portfolio is structurally undiversified.`);
  }
  if (unmeasuredPositionIds.length > 0) {
    observations.push(
      `${unmeasuredPositionIds.length} position(s) are excluded from these figures because they could not be valued.`,
    );
  }

  return {
    largestPositionPct: largest !== null ? round(largest, 6) : null,
    largestPositionId: sorted[0]?.id,
    top3Pct: top3,
    top5Pct: top5,
    herfindahl: hhi,
    effectivePositions: hhi > 0 ? round(1 / hhi, 2) : null,
    observations,
    measuredValueUsd: total,
    unmeasuredPositionIds,
  };
}

/**
 * Liquidity-adjusted exposure (spec §19).
 *
 * A $20K position in a deep market is a different instrument from a $20K
 * position in a token with $25K of usable liquidity. The per-position view is
 * computed once by the portfolio engine; this only falls back for positions
 * that never got one (no exitability data at all).
 */
function buildLiquidityAdjusted(position: Position): LiquidityAdjustedExposure {
  if (position.liquidityAdjusted) return position.liquidityAdjusted;

  return {
    positionId: position.id,
    tokenId: position.tokenId,
    positionValueUsd: round(position.valuation.markValue.usd as number, 2),
    usableLiquidityUsd: null,
    liquidityRatio: null,
    exitDepth5PctUsd: null,
    depthRatio: null,
    band: liquidityExposureBand(null),
    note: 'Usable liquidity is unknown for this token, so size cannot be compared against executable depth.',
  };
}

function riskClassLabel(riskClass: RiskClass): string {
  switch (riskClass) {
    case 'LOW':
      return 'Low risk';
    case 'MODERATE':
      return 'Moderate risk';
    case 'HIGH':
      return 'High risk';
    default:
      return 'Unclassified';
  }
}

function chainLabel(chain: string): string {
  switch (chain) {
    case 'solana':
      return 'Solana';
    case 'ethereum':
      return 'Ethereum';
    case 'base':
      return 'Base';
    case 'arbitrum':
      return 'Arbitrum';
    default:
      return chain.charAt(0).toUpperCase() + chain.slice(1);
  }
}
