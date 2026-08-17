/**
 * AI Post-Trade Journal & Learning Review Engine (Sprint 37 §65-67).
 *
 * Provides constructive retrospective analysis of completed trades:
 *   - Entry & Exit prices, Net P&L after all DEX fees
 *   - "What went well" (e.g. entry timing during volume surge)
 *   - "What could improve" (e.g. exit delay during liquidity drain)
 *   - Feeds evaluation metrics into calibration loop
 */

import { TradeJournalEntry } from './types';

export interface TradeReviewInput {
  tradeId: string;
  tokenSymbol: string;
  entryPriceUsd: number;
  exitPriceUsd: number;
  positionSizeUsd: number;
  feesPaidUsd: number;
  holdDurationMinutes: number;
  entryOrganicVolumePct?: number;
  exitExitabilityScore?: number;
  hadLiquidityDropDuringHold?: boolean;
}

export class TradeJournalEngine {
  /**
   * Generates an educational post-trade review.
   */
  public static reviewTrade(input: TradeReviewInput): TradeJournalEntry {
    const rawPnlPct = ((input.exitPriceUsd - input.entryPriceUsd) / input.entryPriceUsd) * 100;
    const grossPnlUsd = (rawPnlPct / 100) * input.positionSizeUsd;
    const netPnlUsd = Number((grossPnlUsd - input.feesPaidUsd).toFixed(2));
    const pnlPct = Number(rawPnlPct.toFixed(2));

    const whatWentWell: string[] = [];
    const whatCouldImprove: string[] = [];

    // Evaluate Entry
    if (input.entryOrganicVolumePct && input.entryOrganicVolumePct > 60) {
      whatWentWell.push('Entered while organic volume was expanding (>60% real demand).');
    }

    if (pnlPct > 0) {
      whatWentWell.push(`Captured +${pnlPct}% positive price movement over ${input.holdDurationMinutes}m hold period.`);
    }

    // Evaluate Exit & Execution
    if (input.hadLiquidityDropDuringHold) {
      whatCouldImprove.push('Held through on-chain liquidity reduction; exiting earlier when pool depth dropped would have preserved more capital.');
    }

    if (input.exitExitabilityScore && input.exitExitabilityScore < 45) {
      whatCouldImprove.push(`Exitability score had degraded to ${input.exitExitabilityScore}/100 prior to closing order, resulting in higher slippage.`);
    }

    if (input.feesPaidUsd > Math.abs(netPnlUsd) * 0.3 && pnlPct > 0) {
      whatCouldImprove.push('DEX gas and routing fees consumed a substantial portion of gross profit (>30%).');
    }

    if (whatWentWell.length === 0) {
      whatWentWell.push('Executed trade within disciplined position sizing limits.');
    }
    if (whatCouldImprove.length === 0) {
      whatCouldImprove.push('Disciplined execution adhering to planned profit targets.');
    }

    const learningSummary =
      pnlPct >= 0
        ? `Profitable trade (+${pnlPct}% / +$${netPnlUsd}). Good entry momentum alignment.`
        : `Negative outcome (${pnlPct}% / -$${Math.abs(netPnlUsd)}). Review exit triggers and liquidity monitoring to improve risk management.`;

    return {
      tradeId: input.tradeId,
      tokenSymbol: input.tokenSymbol,
      entryPriceUsd: input.entryPriceUsd,
      exitPriceUsd: input.exitPriceUsd,
      pnlPct,
      netPnlUsd,
      feesPaidUsd: input.feesPaidUsd,
      holdDurationMinutes: input.holdDurationMinutes,
      whatWentWell,
      whatCouldImprove,
      learningSummary,
      generatedAt: new Date().toISOString(),
    };
  }
}
