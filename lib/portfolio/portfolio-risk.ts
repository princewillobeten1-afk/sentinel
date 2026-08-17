/**
 * Portfolio Risk Engine (spec §15, §16)
 *
 * Portfolio risk is explicitly NOT the average of position risk scores. A
 * portfolio of ten moderate-risk tokens that all move together, held in size
 * against thin liquidity, is riskier than the average suggests.
 *
 * The score starts from a value-weighted position risk and then adds penalties
 * for concentration, liquidity-adjusted size and correlation, each of which is
 * reported as a named driver with its point contribution (spec §16).
 */

import type {
  ExposureReport,
  PortfolioRiskDriver,
  PortfolioRiskScore,
  Position,
  TokenMetaInput,
} from './types';
import { ILLIQUID_RATIO_THRESHOLD } from './exposure-engine';
import {
  PORTFOLIO_RISK_VERSION,
  clamp,
  evidence,
  hasValue,
  riskBand,
  round,
  sum,
} from './utils';

export interface PortfolioRiskInput {
  portfolioId: string;
  positions: Position[];
  exposure: ExposureReport;
  tokens: Record<string, TokenMetaInput>;
  observedAt: string;
}

const MAX_CONCENTRATION_PENALTY = 22;
const MAX_LIQUIDITY_PENALTY = 18;
const MAX_CORRELATION_PENALTY = 12;

export function scorePortfolioRisk(input: PortfolioRiskInput): PortfolioRiskScore {
  const at = input.observedAt;
  const valued = input.positions.filter(
    (position) => position.status !== 'CLOSED' && hasValue(position.valuation.markValue),
  );

  const total = input.exposure.totalMeasuredValueUsd;
  const drivers: PortfolioRiskDriver[] = [];
  const limitations: string[] = [];

  if (valued.length === 0) {
    return {
      portfolioId: input.portfolioId,
      score: 0,
      band: 'LOW',
      confidence: 0,
      weightedPositionRisk: 0,
      concentrationPenalty: 0,
      liquidityPenalty: 0,
      correlationPenalty: 0,
      drivers: [],
      limitations: ['No position could be valued, so a portfolio risk score cannot be produced.'],
      version: PORTFOLIO_RISK_VERSION,
      generatedAt: at,
    };
  }

  // ── 1. Value-weighted position risk ──
  const weighted = valued.map((position) => ({
    position,
    weight: total > 0 ? (position.valuation.markValue.usd as number) / total : 1 / valued.length,
  }));

  const weightedPositionRisk = round(
    clamp(sum(weighted.map((entry) => entry.position.risk.score * entry.weight)), 0, 100),
    1,
  );

  const topRiskContributors = [...weighted]
    .sort((a, b) => b.position.risk.score * b.weight - a.position.risk.score * a.weight)
    .slice(0, 3);

  for (const entry of topRiskContributors) {
    if (entry.position.risk.score < 40) continue;
    drivers.push({
      key: `POSITION_RISK_${entry.position.tokenId}`,
      label: `${entry.position.symbol} risk`,
      contribution: round(entry.position.risk.score * entry.weight, 1),
      detail: `${round(entry.weight * 100, 1)}% of the portfolio sits in ${entry.position.symbol}, which scores ${entry.position.risk.score}/100 on position risk.`,
      affectedPositionIds: [entry.position.id],
      evidence: [
        evidence(
          `${entry.position.symbol} position risk ${entry.position.risk.score}/100`,
          'position_risk_engine',
          at,
          entry.position.risk.score,
          entry.position.risk.confidence,
        ),
      ],
    });
  }

  // ── 2. Concentration penalty ──
  const largest = input.exposure.concentration.largestPositionPct ?? 0;
  const top3 = input.exposure.concentration.top3Pct ?? 0;
  const concentrationPenalty = round(
    clamp(
      Math.max(
        largest > 0.25 ? (largest - 0.25) * 55 : 0,
        top3 > 0.6 ? (top3 - 0.6) * 40 : 0,
      ),
      0,
      MAX_CONCENTRATION_PENALTY,
    ),
    1,
  );

  if (concentrationPenalty > 0) {
    const largestPosition = valued.find((p) => p.id === input.exposure.concentration.largestPositionId);
    drivers.push({
      key: 'CONCENTRATION',
      label: 'Portfolio concentration',
      contribution: concentrationPenalty,
      detail: `${round(largest * 100, 0)}% of the portfolio is concentrated in one token${largestPosition ? ` (${largestPosition.symbol})` : ''}; the top 3 hold ${round(top3 * 100, 0)}%.`,
      affectedPositionIds: largestPosition ? [largestPosition.id] : [],
      evidence: [
        evidence('Largest position share of portfolio', 'exposure_engine', at, round(largest * 100, 1), 0.9),
        evidence('Top 3 position share of portfolio', 'exposure_engine', at, round(top3 * 100, 1), 0.9),
      ],
    });
  }

  // ── 3. Liquidity penalty ──
  const illiquidEntries = input.exposure.liquidityAdjusted.filter(
    (entry) => entry.liquidityRatio !== null && entry.liquidityRatio >= ILLIQUID_RATIO_THRESHOLD,
  );
  const lowExitability = valued.filter(
    (position) => position.exitability !== undefined && position.exitability.score < 50,
  );
  const lowExitabilityShare =
    total > 0
      ? sum(lowExitability.map((position) => position.valuation.markValue.usd as number)) / total
      : 0;

  const liquidityPenalty = round(
    clamp(
      input.exposure.illiquidSharePct * 30 + lowExitabilityShare * 25,
      0,
      MAX_LIQUIDITY_PENALTY,
    ),
    1,
  );

  if (liquidityPenalty > 0) {
    drivers.push({
      key: 'LIQUIDITY',
      label: 'Liquidity-adjusted exposure',
      contribution: liquidityPenalty,
      detail: `${round(lowExitabilityShare * 100, 0)}% of the portfolio is in low-exitability assets and ${round(input.exposure.illiquidSharePct * 100, 0)}% is large relative to usable liquidity.`,
      affectedPositionIds: [
        ...new Set([...illiquidEntries.map((entry) => entry.positionId), ...lowExitability.map((p) => p.id)]),
      ],
      evidence: [
        evidence(
          'Share of portfolio held in low-exitability assets',
          'exitability_engine',
          at,
          round(lowExitabilityShare * 100, 1),
          0.8,
        ),
        evidence(
          'Share of portfolio that is large relative to usable liquidity',
          'exposure_engine',
          at,
          round(input.exposure.illiquidSharePct * 100, 1),
          0.8,
        ),
      ],
    });
  }

  // ── 4. Correlation penalty ──
  const correlation = assessCorrelation(weighted, input.tokens);
  const correlationPenalty = round(clamp(correlation.penalty, 0, MAX_CORRELATION_PENALTY), 1);

  if (correlationPenalty > 0) {
    drivers.push({
      key: 'CORRELATION',
      label: 'Position correlation',
      contribution: correlationPenalty,
      detail: correlation.detail,
      affectedPositionIds: correlation.positionIds,
      evidence: [
        evidence(
          'Largest share of portfolio inside a single correlation group',
          'exposure_engine',
          at,
          round(correlation.largestGroupShare * 100, 1),
          0.6,
        ),
      ],
    });
  }

  // ── Compose ──
  const score = round(
    clamp(weightedPositionRisk + concentrationPenalty + liquidityPenalty + correlationPenalty, 0, 100),
    0,
  );

  const confidence = round(
    clamp(
      sum(weighted.map((entry) => entry.position.risk.confidence * entry.weight)) *
        (input.exposure.concentration.unmeasuredPositionIds.length > 0 ? 0.85 : 1),
      0,
      1,
    ),
    3,
  );

  if (input.exposure.concentration.unmeasuredPositionIds.length > 0) {
    limitations.push(
      `${input.exposure.concentration.unmeasuredPositionIds.length} position(s) could not be valued and do not contribute to this score.`,
    );
  }
  if (confidence < 0.6) {
    limitations.push('Signal coverage across positions is incomplete; treat the portfolio score as indicative.');
  }
  if (correlation.assumed) {
    limitations.push(
      'Correlation is inferred from declared correlation groups and chain co-location, not from a returns covariance model.',
    );
  }

  return {
    portfolioId: input.portfolioId,
    score,
    band: riskBand(score),
    confidence,
    weightedPositionRisk,
    concentrationPenalty,
    liquidityPenalty,
    correlationPenalty,
    drivers: drivers.sort((a, b) => b.contribution - a.contribution),
    limitations,
    version: PORTFOLIO_RISK_VERSION,
    generatedAt: at,
  };
}

interface CorrelationAssessment {
  penalty: number;
  detail: string;
  positionIds: string[];
  largestGroupShare: number;
  assumed: boolean;
}

/**
 * Correlation is approximated from declared correlation groups (e.g. same
 * narrative/creator/launch cohort). We do not claim a statistical correlation
 * we have not measured.
 */
function assessCorrelation(
  weighted: Array<{ position: Position; weight: number }>,
  tokens: Record<string, TokenMetaInput>,
): CorrelationAssessment {
  const groups = new Map<string, { share: number; positionIds: string[]; label: string }>();

  for (const entry of weighted) {
    const meta = tokens[entry.position.tokenId];
    const group = meta?.correlationGroup;
    if (!group) continue;
    const existing = groups.get(group);
    if (existing) {
      existing.share += entry.weight;
      existing.positionIds.push(entry.position.id);
    } else {
      groups.set(group, { share: entry.weight, positionIds: [entry.position.id], label: group });
    }
  }

  const multiMember = [...groups.values()].filter((group) => group.positionIds.length > 1);
  const largest = multiMember.sort((a, b) => b.share - a.share)[0];

  if (!largest) {
    return {
      penalty: 0,
      detail: 'No correlated cluster of positions was identified.',
      positionIds: [],
      largestGroupShare: 0,
      assumed: false,
    };
  }

  const penalty = largest.share > 0.3 ? (largest.share - 0.3) * 40 : 0;

  return {
    penalty,
    detail: `${round(largest.share * 100, 0)}% of the portfolio sits in ${largest.positionIds.length} positions that share the "${largest.label}" correlation group and are likely to move together.`,
    positionIds: largest.positionIds,
    largestGroupShare: largest.share,
    assumed: true,
  };
}

/**
 * Human-readable risk interpretation (spec §16). Returns the headline plus the
 * ordered driver lines shown under "Primary drivers".
 */
export function interpretPortfolioRisk(risk: PortfolioRiskScore): {
  headline: string;
  drivers: string[];
} {
  return {
    headline: `Portfolio Risk: ${risk.score} / 100 (${risk.band.toLowerCase()})`,
    drivers: risk.drivers.map((driver) => driver.detail),
  };
}
