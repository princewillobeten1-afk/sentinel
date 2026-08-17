/**
 * Position Risk Engine (spec §14)
 *
 * Produces a 0–100 PositionRiskScore where higher means more risk. The score is
 * a weighted synthesis of independent signals rather than a single metric, and
 * every component carries its own status so the UI can show which parts of the
 * picture are missing.
 *
 * Components with no data are dropped and their weight is redistributed across
 * the components that do have data. Confidence falls with coverage, so a score
 * built from two of nine signals never presents as authoritative.
 */

import type { ExitabilityReport } from '@/lib/exitability/types';
import type {
  PositionRiskComponent,
  PositionRiskScore,
  TokenMetaInput,
} from './types';
import { POSITION_RISK_VERSION, clamp, evidence, riskBand, round, sum } from './utils';

export interface PositionRiskInput {
  positionId: string;
  tokenId: string;
  symbol: string;
  token?: TokenMetaInput;
  exitability?: ExitabilityReport;
  /** Share of the portfolio held in this position, 0–1. */
  allocationPct: number | null;
  /** position value / usable liquidity, when computable. */
  liquidityRatio: number | null;
  observedAt: string;
}

interface ComponentSpec {
  key: string;
  label: string;
  weight: number;
  /** 0–100 risk contribution, or null when the signal has no data. */
  score: number | null;
  detail: string;
  evidence: PositionRiskComponent['evidence'];
}

export function scorePositionRisk(input: PositionRiskInput): PositionRiskScore {
  const at = input.observedAt;
  const token = input.token;
  const exit = input.exitability;

  const specs: ComponentSpec[] = [
    {
      key: 'TOKEN_INTELLIGENCE',
      label: 'Token intelligence',
      weight: 0.18,
      score: invert(token?.intelligenceScore),
      detail:
        token?.intelligenceScore !== undefined
          ? `Token intelligence score is ${round(token.intelligenceScore, 0)}/100.`
          : 'No token intelligence report is available.',
      evidence:
        token?.intelligenceScore !== undefined
          ? [evidence('Token intelligence score', 'intelligence_engine', at, round(token.intelligenceScore, 0), 0.85)]
          : [],
    },
    {
      key: 'EXITABILITY',
      label: 'Exitability',
      weight: 0.2,
      score: invert(exit?.score),
      detail: exit
        ? `Exitability is ${exit.score}/100 (${exit.interpretation.replace(/_/g, ' ').toLowerCase()}).`
        : 'No exitability analysis is available for this token.',
      evidence: exit
        ? [evidence(`Exitability score ${exit.score}`, 'exitability_engine', exit.generatedAt, exit.score, exit.confidence / 100)]
        : [],
    },
    {
      key: 'LIQUIDITY_STABILITY',
      label: 'Liquidity stability',
      weight: 0.12,
      score: invert(exit?.liquidity.stabilityScore),
      detail: exit
        ? `Liquidity stability is ${exit.liquidity.stabilityScore}/100 across ${exit.liquidity.poolCount} pool(s).`
        : 'Liquidity stability is unknown.',
      evidence: exit
        ? [
            evidence(
              `Usable liquidity ${Math.round(exit.liquidity.usableLiquidityUsd)} USD`,
              'liquidity_engine',
              exit.generatedAt,
              round(exit.liquidity.usableLiquidityUsd, 0),
              exit.liquidity.confidence,
            ),
          ]
        : [],
    },
    {
      key: 'OWNERSHIP_CONCENTRATION',
      label: 'Ownership concentration',
      weight: 0.12,
      score: token?.ownershipConcentration ?? null,
      detail:
        token?.ownershipConcentration !== undefined
          ? `Ownership concentration reads ${round(token.ownershipConcentration, 0)}/100.`
          : 'Ownership distribution could not be established.',
      evidence:
        token?.ownershipConcentration !== undefined
          ? [evidence('Ownership concentration index', 'ownership_engine', at, round(token.ownershipConcentration, 0), 0.8)]
          : [],
    },
    {
      key: 'CREATOR_REPUTATION',
      label: 'Creator reputation',
      weight: 0.1,
      score: invert(token?.creatorReputation),
      detail:
        token?.creatorReputation !== undefined
          ? `Creator reputation is ${round(token.creatorReputation, 0)}/100.`
          : 'No creator relationship could be reliably established.',
      evidence:
        token?.creatorReputation !== undefined
          ? [evidence('Creator reputation score', 'creator_engine', at, round(token.creatorReputation, 0), 0.75)]
          : [],
    },
    {
      key: 'ORGANIC_ACTIVITY',
      label: 'Organic activity',
      weight: 0.1,
      score: invert(token?.organicScore),
      detail:
        token?.organicScore !== undefined
          ? `Organic activity reads ${round(token.organicScore, 0)}/100.`
          : 'Activity quality is unknown.',
      evidence:
        token?.organicScore !== undefined
          ? [evidence('Organic activity score', 'activity_engine', at, round(token.organicScore, 0), 0.8)]
          : [],
    },
    {
      key: 'INSIDER_SIGNALS',
      label: 'Insider signals',
      weight: 0.08,
      score: token?.insiderRisk ?? null,
      detail:
        token?.insiderRisk !== undefined
          ? `Insider signal strength reads ${round(token.insiderRisk, 0)}/100.`
          : 'No insider assessment is available.',
      evidence:
        token?.insiderRisk !== undefined
          ? [evidence('Insider risk score', 'insider_engine', at, round(token.insiderRisk, 0), 0.7)]
          : [],
    },
    {
      key: 'VOLATILITY',
      label: 'Volatility',
      weight: 0.05,
      score: token?.volatility !== undefined ? clamp(token.volatility * 200, 0, 100) : null,
      detail:
        token?.volatility !== undefined
          ? `Recent price volatility is approximately ${round(token.volatility * 100, 1)}%.`
          : 'Volatility could not be measured.',
      evidence:
        token?.volatility !== undefined
          ? [evidence('Recent realised volatility', 'market_engine', at, round(token.volatility * 100, 1), 0.7)]
          : [],
    },
    {
      key: 'POSITION_CONCENTRATION',
      label: 'Position concentration',
      weight: 0.05,
      score: input.allocationPct !== null ? concentrationRisk(input.allocationPct) : null,
      detail:
        input.allocationPct !== null
          ? `This position is ${round(input.allocationPct * 100, 1)}% of the portfolio.`
          : 'Portfolio allocation could not be computed.',
      evidence:
        input.allocationPct !== null
          ? [evidence('Position share of portfolio', 'exposure_engine', at, round(input.allocationPct * 100, 1), 0.9)]
          : [],
    },
  ];

  // Liquidity-adjusted exposure sharpens the exitability read (spec §19).
  if (input.liquidityRatio !== null) {
    specs.push({
      key: 'LIQUIDITY_ADJUSTED_SIZE',
      label: 'Size vs executable liquidity',
      weight: 0.1,
      score: liquidityRatioRisk(input.liquidityRatio),
      detail: `This position is ${round(input.liquidityRatio * 100, 1)}% of the token's usable liquidity.`,
      evidence: [
        evidence(
          'Position size relative to executable liquidity',
          'exposure_engine',
          at,
          round(input.liquidityRatio, 4),
          0.8,
        ),
      ],
    });
  }

  const available = specs.filter((spec) => spec.score !== null);
  const totalWeight = sum(available.map((spec) => spec.weight));
  const declaredWeight = sum(specs.map((spec) => spec.weight));

  const components: PositionRiskComponent[] = specs.map((spec) => ({
    key: spec.key,
    label: spec.label,
    score: spec.score ?? 0,
    // Redistribute weight across the signals that actually have data.
    weight: spec.score === null ? 0 : round(spec.weight / (totalWeight || 1), 4),
    status: spec.score === null ? 'UNKNOWN' : 'KNOWN',
    detail: spec.detail,
    evidence: spec.evidence,
  }));

  const score =
    totalWeight > 0
      ? round(
          clamp(
            sum(available.map((spec) => (spec.score as number) * (spec.weight / totalWeight))),
            0,
            100,
          ),
          1,
        )
      : 0;

  const coverage = declaredWeight > 0 ? totalWeight / declaredWeight : 0;
  const confidence = round(clamp(coverage, 0, 1), 3);

  const drivers = available
    .map((spec) => ({ spec, contribution: (spec.score as number) * (spec.weight / totalWeight) }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .filter((entry) => entry.contribution > 0)
    .map((entry) => entry.spec.detail);

  const limitations = specs
    .filter((spec) => spec.score === null)
    .map((spec) => `${spec.label}: no data, excluded from the score.`);

  if (coverage < 0.6) {
    limitations.unshift(
      `Only ${round(coverage * 100, 0)}% of risk signal weight had data. Treat this score as indicative.`,
    );
  }

  return {
    positionId: input.positionId,
    tokenId: input.tokenId,
    score,
    band: riskBand(score),
    confidence,
    components,
    drivers,
    limitations,
    version: POSITION_RISK_VERSION,
    generatedAt: at,
  };
}

/** Higher-is-better scores become higher-is-riskier. */
function invert(score: number | undefined): number | null {
  if (score === undefined || !Number.isFinite(score)) return null;
  return clamp(100 - score, 0, 100);
}

/**
 * Concentration risk ramps up past a quarter of the portfolio and saturates
 * once a single position dominates.
 */
function concentrationRisk(allocationPct: number): number {
  if (allocationPct <= 0.1) return clamp(allocationPct * 100, 0, 100);
  if (allocationPct <= 0.25) return clamp(10 + (allocationPct - 0.1) * 200, 0, 100);
  return clamp(40 + (allocationPct - 0.25) * 80, 0, 100);
}

/**
 * A position worth a large share of the token's usable liquidity is
 * structurally risky regardless of how healthy the token looks.
 */
function liquidityRatioRisk(ratio: number): number {
  if (ratio <= 0.02) return 5;
  if (ratio <= 0.1) return clamp(5 + (ratio - 0.02) * 400, 0, 100);
  if (ratio <= 0.5) return clamp(37 + (ratio - 0.1) * 130, 0, 100);
  return clamp(89 + (ratio - 0.5) * 22, 0, 100);
}
