/**
 * Portfolio Pipeline (spec §48)
 *
 *   Blockchain Events
 *         ↓
 *   Transaction Classification
 *         ↓
 *   Position Engine
 *         ↓
 *   Cost Basis
 *         ↓
 *   P&L Engine
 *         ↓
 *   Risk Engine
 *         ↓
 *   Portfolio Engine
 *         ↓
 *   Snapshots
 *         ↓
 *   UI / Alerts / Analytics
 *
 * The pipeline is pure: it reads a context and returns a result. It never
 * writes to a database and never broadcasts a transaction, which keeps
 * intelligence computation isolated from execution.
 */

import type {
  PortfolioAlertRule,
  PortfolioContext,
  PortfolioResult,
} from './types';
import { classifyEvents } from './classification';
import { buildPositions } from './position-engine';
import { assemblePositions, buildOverview } from './portfolio-engine';
import { buildExposure } from './exposure-engine';
import { scorePortfolioRisk } from './portfolio-risk';
import { buildPerformance } from './performance-engine';
import { detectPositionChanges } from './change-detection';
import { buildPortfolioAlertEvents } from './alert-events';
import {
  buildExposureSnapshot,
  buildPnlSnapshot,
  buildPortfolioSnapshot,
  buildRiskSnapshot,
} from './snapshots';

export interface ProcessPortfolioInput {
  context: PortfolioContext;
  rules?: PortfolioAlertRule[];
}

export function processPortfolioPipeline(input: ProcessPortfolioInput): PortfolioResult {
  const { context } = input;
  const observedAt = context.observedAt;

  // 1. Classification — decide what each chain movement actually was.
  const classified = classifyEvents(context.events, {
    ownedWallets: context.wallets.map((wallet) => wallet.address),
    migrationMap: undefined,
  });

  // 2. Position engine — lots, disposals, pending state, reconciliation.
  const { drafts, reconciliation } = buildPositions({
    portfolioId: context.portfolioId,
    classified,
    tokens: context.tokens,
    method: context.method,
    observedAt,
  });

  // 3–5. Cost basis, valuation, P&L and position risk.
  const positions = assemblePositions({ context, drafts });

  // 6. Exposure, then portfolio risk (which consumes exposure).
  const exposure = buildExposure({
    portfolioId: context.portfolioId,
    positions,
    tokens: context.tokens,
    observedAt,
  });

  const risk = scorePortfolioRisk({
    portfolioId: context.portfolioId,
    positions,
    exposure,
    tokens: context.tokens,
    observedAt,
  });

  // 7. Portfolio overview.
  const overview = buildOverview({
    context,
    positions,
    exposure,
    risk,
    history: context.history ?? [],
  });

  // 8. Performance analytics.
  const performance = buildPerformance({
    portfolioId: context.portfolioId,
    positions,
    history: context.history ?? [],
    holdingThresholds: context.holdingThresholds,
    observedAt,
  });

  // 9. Change detection and alerts.
  const changes = detectPositionChanges({
    positions,
    previousPositions: context.previousPositions,
    exitability: context.exitability,
    tokens: context.tokens,
    observedAt,
  });

  const alertEvents = buildPortfolioAlertEvents({
    portfolioId: context.portfolioId,
    positions,
    changes,
    exposure,
    risk,
    rules: input.rules,
    observedAt,
  });

  // 10. Snapshots for historical analytics.
  const snapshots = {
    portfolio: buildPortfolioSnapshot(overview, positions),
    pnl: buildPnlSnapshot(overview),
    risk: buildRiskSnapshot(risk),
    exposure: buildExposureSnapshot(exposure),
  };

  return {
    overview,
    positions,
    exposure,
    risk,
    performance,
    changes,
    alertEvents,
    reconciliation,
    snapshots,
    limitations: [
      ...new Set([
        ...overview.limitations,
        ...performance.limitations,
        ...risk.limitations,
        ...exposure.limitations,
      ]),
    ],
    processedAt: observedAt,
  };
}

/**
 * Sorts positions for the position table (spec §59).
 */
export type PositionSortKey = 'VALUE' | 'PNL' | 'RISK' | 'ALLOCATION' | 'EXITABILITY';

export function sortPositions(
  positions: PortfolioResult['positions'],
  key: PositionSortKey,
  direction: 'asc' | 'desc' = 'desc',
): PortfolioResult['positions'] {
  const factor = direction === 'desc' ? -1 : 1;
  const value = (position: PortfolioResult['positions'][number]): number => {
    switch (key) {
      case 'PNL':
        return position.pnl.net.usd ?? Number.NEGATIVE_INFINITY;
      case 'RISK':
        return position.risk.score;
      case 'ALLOCATION':
        return position.allocationPct ?? -1;
      case 'EXITABILITY':
        return position.exitability?.score ?? -1;
      case 'VALUE':
      default:
        return position.valuation.markValue.usd ?? Number.NEGATIVE_INFINITY;
    }
  };
  return [...positions].sort((a, b) => (value(a) - value(b)) * factor);
}
