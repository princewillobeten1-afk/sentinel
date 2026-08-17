/**
 * Trader Behavioral Self-Analytics & Habit Diagnosis (Sprint 38 §36-37).
 *
 * Evaluates individual trader execution metrics:
 *   - Average launch entry latency (speed)
 *   - Holding time discipline
 *   - Win rate & asymmetric risk/reward
 *   - Friction cost drag & loss attribution breakdown
 *   - Constructive, non-judgmental trading habit observations
 */

import { TraderSelfAnalytics, TrueNetPnlBreakdown } from './types';

export interface CompletedTradeRecord {
  tradeId: string;
  tokenMint: string;
  entryTimestamp: number;
  exitTimestamp: number;
  poolCreationTimestamp: number;
  pnlBreakdown: TrueNetPnlBreakdown;
  tokenExitabilityScoreAtEntry: number;
}

export class TraderSelfAnalyticsEngine {
  /**
   * Evaluates complete user trading record and diagnoses behavioral patterns.
   */
  public static analyzeTrader(params: {
    userId: string;
    trades: CompletedTradeRecord[];
  }): TraderSelfAnalytics {
    const { userId, trades } = params;

    if (!trades || trades.length === 0) {
      return {
        userId,
        totalTradesExecuted: 0,
        winRatePct: 0,
        netPnlUsd: 0,
        grossPnlUsd: 0,
        totalFrictionFeesPaidUsd: 0,
        averageEntryTimingMinutes: 0,
        averageHoldDurationMinutes: 0,
        averageWinnerGainPct: 0,
        averageLoserLossPct: 0,
        lossAttribution: {
          lowExitabilityTrapsPct: 0,
          slippageDragPct: 0,
          lateEntryPumpsPct: 0,
        },
        behavioralHabitObservations: ['No historical trade executions recorded yet.'],
      };
    }

    let grossPnl = 0;
    let netPnl = 0;
    let frictionTotal = 0;
    let winnersCount = 0;
    let winnersGainSum = 0;
    let losersCount = 0;
    let losersLossSum = 0;
    let totalHoldMins = 0;
    let totalEntryTimingMins = 0;

    let lowExitabilityLosses = 0;
    let slippageDragLosses = 0;
    let totalLossAmount = 0;

    for (const t of trades) {
      const p = t.pnlBreakdown;
      grossPnl += p.grossProfitUsd;
      netPnl += p.netPnlUsd;
      frictionTotal += p.totalFrictionCostsUsd;

      const holdDuration = Math.max(1, (t.exitTimestamp - t.entryTimestamp) / 60000);
      totalHoldMins += holdDuration;

      const entryTiming = Math.max(0, (t.entryTimestamp - t.poolCreationTimestamp) / 60000);
      totalEntryTimingMins += entryTiming;

      if (p.netPnlUsd > 0) {
        winnersCount++;
        winnersGainSum += p.netPnlPct;
      } else if (p.netPnlUsd < 0) {
        losersCount++;
        losersLossSum += Math.abs(p.netPnlPct);
        const lossAbs = Math.abs(p.netPnlUsd);
        totalLossAmount += lossAbs;

        if (t.tokenExitabilityScoreAtEntry < 45) {
          lowExitabilityLosses += lossAbs;
        }
        if (p.slippageCostUsd > lossAbs * 0.3) {
          slippageDragLosses += lossAbs;
        }
      }
    }

    const totalTradesExecuted = trades.length;
    const winRatePct = Number(((winnersCount / totalTradesExecuted) * 100).toFixed(1));
    const avgEntryTimingMinutes = Number((totalEntryTimingMins / totalTradesExecuted).toFixed(1));
    const avgHoldDurationMinutes = Math.round(totalHoldMins / totalTradesExecuted);
    const avgWinnerGainPct = winnersCount > 0 ? Number((winnersGainSum / winnersCount).toFixed(1)) : 0;
    const avgLoserLossPct = losersCount > 0 ? Number((losersLossSum / losersCount).toFixed(1)) : 0;

    const lowExitabilityTrapsPct =
      totalLossAmount > 0 ? Number(((lowExitabilityLosses / totalLossAmount) * 100).toFixed(1)) : 0;
    const slippageDragPct =
      totalLossAmount > 0 ? Number(((slippageDragLosses / totalLossAmount) * 100).toFixed(1)) : 0;
    const lateEntryPumpsPct = Math.max(0, Number((100 - lowExitabilityTrapsPct - slippageDragPct).toFixed(1)));

    // Generate behavioral habit observations (§37)
    const behavioralHabitObservations: string[] = [];

    if (avgEntryTimingMinutes <= 5) {
      behavioralHabitObservations.push('Rapid Launch Entry: You frequently enter tokens within the first 5 minutes of curve deployment.');
    } else if (avgEntryTimingMinutes > 60) {
      behavioralHabitObservations.push('Late Momentum Entry: Most trades occur >1 hour post-launch where curve price volatility is high.');
    }

    if (lowExitabilityTrapsPct >= 35) {
      behavioralHabitObservations.push(`Exit Trap Vulnerability: ${lowExitabilityTrapsPct}% of total losses originated in tokens with exitability scores under 45.`);
    }

    if (frictionTotal > Math.abs(netPnl) * 0.25 && netPnl > 0) {
      behavioralHabitObservations.push('Friction Cost Drag: DEX fees and slippage consumed >25% of gross profits.');
    }

    if (avgWinnerGainPct > avgLoserLossPct * 1.5) {
      behavioralHabitObservations.push('Positive Risk/Reward Asymmetry: Average winning trade gain exceeds average loss.');
    }

    if (behavioralHabitObservations.length === 0) {
      behavioralHabitObservations.push('Disciplined trade distribution across standard liquidity profiles.');
    }

    return {
      userId,
      totalTradesExecuted,
      winRatePct,
      netPnlUsd: Number(netPnl.toFixed(2)),
      grossPnlUsd: Number(grossPnl.toFixed(2)),
      totalFrictionFeesPaidUsd: Number(frictionTotal.toFixed(2)),
      averageEntryTimingMinutes: avgEntryTimingMinutes,
      averageHoldDurationMinutes: avgHoldDurationMinutes,
      averageWinnerGainPct: avgWinnerGainPct,
      averageLoserLossPct: avgLoserLossPct,
      lossAttribution: {
        lowExitabilityTrapsPct,
        slippageDragPct,
        lateEntryPumpsPct,
      },
      behavioralHabitObservations,
    };
  }
}
