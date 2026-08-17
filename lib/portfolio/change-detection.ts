/**
 * Position Change Detection (spec §30)
 *
 * Compares the current portfolio state against the previous one and reports
 * what moved. These changes drive both the "What changed?" panel (spec §65) and
 * the portfolio alert feed.
 *
 * Detection is comparative only. It states that something changed and by how
 * much; it never asserts why, and it never suggests an action (spec §63).
 */

import type { ExitabilityReport } from '@/lib/exitability/types';
import type {
  PositionChange,
  PositionChangeType,
  Position,
  TokenMetaInput,
} from './types';
import { evidence, hasValue, round, safeDivide } from './utils';

export interface ChangeDetectionInput {
  positions: Position[];
  previousPositions?: Position[];
  exitability?: Record<string, ExitabilityReport>;
  tokens: Record<string, TokenMetaInput>;
  observedAt: string;
}

/** Point thresholds at which a move is worth surfacing. */
export const CHANGE_THRESHOLDS = {
  riskPoints: 8,
  exitabilityPoints: 10,
  liquidityPct: 0.15,
  pnlPct: 0.15,
  organicPoints: 12,
};

export function detectPositionChanges(input: ChangeDetectionInput): PositionChange[] {
  const previous = new Map((input.previousPositions ?? []).map((position) => [position.id, position]));
  const changes: PositionChange[] = [];

  for (const position of input.positions) {
    const before = previous.get(position.id);

    // Value became unavailable — an important state change in its own right.
    if (before && hasValue(before.valuation.markValue) && !hasValue(position.valuation.markValue)) {
      changes.push(
        change(position, 'VALUE_UNAVAILABLE', 'warning', 'Position value became unavailable', {
          detail: `${position.symbol} no longer has a usable price source. Its value is reported as unavailable rather than carried forward.`,
          confidence: 1,
          at: input.observedAt,
          ev: [
            evidence(
              'Price feed stopped serving this token',
              position.valuation.price.priceSource,
              input.observedAt,
              position.valuation.price.status,
              1,
            ),
          ],
        }),
      );
    }

    if (before) {
      // ── Risk ──
      const riskDelta = round(position.risk.score - before.risk.score, 1);
      if (Math.abs(riskDelta) >= CHANGE_THRESHOLDS.riskPoints) {
        const increased = riskDelta > 0;
        changes.push(
          change(
            position,
            increased ? 'RISK_INCREASED' : 'RISK_DECREASED',
            increased ? (riskDelta >= 20 ? 'critical' : 'warning') : 'info',
            `${position.symbol} risk ${increased ? 'increased' : 'decreased'}`,
            {
              detail: `Position risk moved from ${before.risk.score} to ${position.risk.score}. Leading factor: ${position.risk.drivers[0] ?? 'not attributable to a single component'}`,
              previousValue: before.risk.score,
              currentValue: position.risk.score,
              confidence: position.risk.confidence,
              at: input.observedAt,
              ev: position.risk.components.flatMap((component) => component.evidence).slice(0, 3),
            },
          ),
        );
      }

      // ── Exitability ──
      const beforeExit = before.exitability?.score;
      const afterExit = position.exitability?.score;
      if (beforeExit !== undefined && afterExit !== undefined) {
        const delta = round(afterExit - beforeExit, 1);
        if (delta <= -CHANGE_THRESHOLDS.exitabilityPoints) {
          changes.push(
            change(position, 'EXITABILITY_DROP', delta <= -20 ? 'critical' : 'warning', `${position.symbol} exitability dropped`, {
              detail: `Exitability fell from ${beforeExit} to ${afterExit}. The realistic exit value for this position moved further below its marked value.`,
              previousValue: beforeExit,
              currentValue: afterExit,
              deltaPct: safeDivide(delta, beforeExit) ?? undefined,
              confidence: position.exitability?.confidence ?? 0.6,
              at: input.observedAt,
              ev: [
                evidence(
                  `Exitability ${beforeExit} → ${afterExit}`,
                  'exitability_engine',
                  input.observedAt,
                  afterExit,
                  position.exitability?.confidence ?? 0.6,
                ),
              ],
            }),
          );
        }
      }

      // ── Liquidity ──
      const beforeLiquidity = before.exitability?.usableLiquidityUsd;
      const afterLiquidity = position.exitability?.usableLiquidityUsd;
      if (beforeLiquidity && afterLiquidity && beforeLiquidity > 0) {
        const pct = (afterLiquidity - beforeLiquidity) / beforeLiquidity;
        if (pct <= -CHANGE_THRESHOLDS.liquidityPct) {
          changes.push(
            change(position, 'LIQUIDITY_DROP', pct <= -0.3 ? 'critical' : 'warning', `${position.symbol} liquidity decreased`, {
              detail: `Usable liquidity fell ${Math.abs(round(pct * 100, 1))}%, from ${Math.round(beforeLiquidity)} to ${Math.round(afterLiquidity)} USD.`,
              previousValue: round(beforeLiquidity, 2),
              currentValue: round(afterLiquidity, 2),
              deltaPct: round(pct, 4),
              confidence: 0.85,
              at: input.observedAt,
              ev: [
                evidence('Usable liquidity change', 'liquidity_engine', input.observedAt, round(pct * 100, 1), 0.85),
              ],
            }),
          );
        }
      }

      // ── P&L move ──
      const beforeNet = hasValue(before.pnl.net) ? (before.pnl.net.usd as number) : null;
      const afterNet = hasValue(position.pnl.net) ? (position.pnl.net.usd as number) : null;
      if (beforeNet !== null && afterNet !== null && Math.abs(beforeNet) > 0) {
        const pct = (afterNet - beforeNet) / Math.abs(beforeNet);
        if (Math.abs(pct) >= CHANGE_THRESHOLDS.pnlPct) {
          changes.push(
            change(position, 'LARGE_PNL_MOVE', Math.abs(pct) >= 0.4 ? 'warning' : 'info', `${position.symbol} P&L moved sharply`, {
              detail: `Net P&L moved ${pct > 0 ? 'up' : 'down'} ${Math.abs(round(pct * 100, 1))}%, from ${round(beforeNet, 2)} to ${round(afterNet, 2)} USD.`,
              previousValue: round(beforeNet, 2),
              currentValue: round(afterNet, 2),
              deltaPct: round(pct, 4),
              confidence: 0.9,
              at: input.observedAt,
              ev: [evidence('Net P&L change', 'pnl_engine', input.observedAt, round(afterNet, 2), 0.9)],
            }),
          );
        }
      }
    }

    // ── Signals sourced from token intelligence, comparable without history ──
    const report = input.exitability?.[position.tokenId];
    if (report) {
      changes.push(...detectFromExitabilitySignals(position, report, input.observedAt));
    }

    const token = input.tokens[position.tokenId];
    const beforeToken = before ? input.tokens[before.tokenId] : undefined;
    if (token?.organicScore !== undefined && beforeToken?.organicScore !== undefined) {
      const delta = token.organicScore - beforeToken.organicScore;
      if (delta <= -CHANGE_THRESHOLDS.organicPoints) {
        changes.push(
          change(position, 'ORGANIC_ACTIVITY_DECLINE', 'warning', `${position.symbol} organic activity declined`, {
            detail: `Organic activity score fell from ${round(beforeToken.organicScore, 0)} to ${round(token.organicScore, 0)}.`,
            previousValue: round(beforeToken.organicScore, 0),
            currentValue: round(token.organicScore, 0),
            confidence: 0.75,
            at: input.observedAt,
            ev: [evidence('Organic activity score change', 'activity_engine', input.observedAt, round(token.organicScore, 0), 0.75)],
          }),
        );
      }
    }
  }

  return changes.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

/**
 * Sprint 8 already raises structured signals for whale, creator and
 * coordination behaviour. We lift the ones that matter to a holder rather than
 * re-deriving them.
 */
function detectFromExitabilitySignals(
  position: Position,
  report: ExitabilityReport,
  at: string,
): PositionChange[] {
  const changes: PositionChange[] = [];

  for (const signal of report.signals) {
    const mapped = mapSignal(signal.type);
    if (!mapped) continue;
    changes.push(
      change(position, mapped.type, mapped.severity, `${position.symbol}: ${mapped.title}`, {
        detail: `${signal.type.replace(/_/g, ' ').toLowerCase()} observed with value ${signal.value}.`,
        confidence: signal.confidence,
        at,
        ev: signal.evidence.slice(0, 3),
      }),
    );
  }

  return changes;
}

function mapSignal(
  type: string,
): { type: PositionChangeType; severity: PositionChange['severity']; title: string } | null {
  switch (type) {
    case 'HOLDER_EXIT_PRESSURE':
    case 'LARGE_HOLDER_SELL':
      return { type: 'WHALE_EXIT', severity: 'warning', title: 'large-holder exit pressure detected' };
    case 'WHALE_ACCUMULATION':
      return { type: 'WHALE_ACCUMULATION', severity: 'info', title: 'whale accumulation detected' };
    case 'CREATOR_SELL':
    case 'CREATOR_LIQUIDITY_REMOVAL':
      return { type: 'CREATOR_SELL', severity: 'critical', title: 'creator-associated selling detected' };
    case 'CLUSTER_COORDINATION':
    case 'COORDINATED_ACTIVITY':
      return { type: 'POTENTIAL_COORDINATION', severity: 'warning', title: 'potential coordinated activity' };
    default:
      return null;
  }
}

interface ChangeOptions {
  detail: string;
  previousValue?: number;
  currentValue?: number;
  deltaPct?: number;
  confidence: number;
  at: string;
  ev: PositionChange['evidence'];
}

function change(
  position: Position,
  type: PositionChangeType,
  severity: PositionChange['severity'],
  title: string,
  options: ChangeOptions,
): PositionChange {
  return {
    type,
    positionId: position.id,
    tokenId: position.tokenId,
    symbol: position.symbol,
    severity,
    title,
    detail: options.detail,
    previousValue: options.previousValue,
    currentValue: options.currentValue,
    deltaPct: options.deltaPct,
    confidence: options.confidence,
    evidence: options.ev,
    detectedAt: options.at,
  };
}

function severityRank(severity: PositionChange['severity']): number {
  return severity === 'critical' ? 3 : severity === 'warning' ? 2 : 1;
}
