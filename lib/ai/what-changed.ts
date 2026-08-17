/**
 * "What Changed?" AI Comparison & State Diffing Engine (Sprint 37 §17-18).
 *
 * Compares snapshots across selectable timeframes (15m, 1h, 24h) to identify:
 *   - Liquidity withdrawals / injections
 *   - Whale / cluster selloffs
 *   - Creator-linked transfers
 *   - Unique trader & organic volume changes
 *   - Exitability score trajectory
 */

import { EvidencePackage, WhatChangedAnalysis, WhatChangedItem, DeepPartial } from './types';

export class WhatChangedEngine {
  /**
   * Compares a previous snapshot with the current evidence package.
   */
  public static compareSnapshots(params: {
    previous: DeepPartial<EvidencePackage>;
    current: EvidencePackage;
    timeframe?: '15m' | '1h' | '24h';
  }): WhatChangedAnalysis {
    const { previous, current, timeframe = '15m' } = params;
    const changes: WhatChangedItem[] = [];
    let warningCount = 0;
    let positiveCount = 0;

    // 1. Liquidity Delta
    if (previous.liquidity?.totalLiquidityUsd !== undefined) {
      const prevLiq = previous.liquidity.totalLiquidityUsd;
      const currLiq = current.liquidity.totalLiquidityUsd;
      const pctDelta = ((currLiq - prevLiq) / prevLiq) * 100;

      if (pctDelta <= -10) {
        warningCount++;
        changes.push({
          type: 'WARNING',
          metric: 'Pool Liquidity',
          previousValue: `$${prevLiq.toLocaleString()}`,
          currentValue: `$${currLiq.toLocaleString()}`,
          deltaDescription: `Liquidity decreased ${Math.abs(pctDelta).toFixed(1)}%.`,
          severity: pctDelta <= -25 ? 'HIGH' : 'WARNING',
        });
      } else if (pctDelta >= 10) {
        positiveCount++;
        changes.push({
          type: 'POSITIVE',
          metric: 'Pool Liquidity',
          previousValue: `$${prevLiq.toLocaleString()}`,
          currentValue: `$${currLiq.toLocaleString()}`,
          deltaDescription: `Liquidity increased ${pctDelta.toFixed(1)}%.`,
          severity: 'INFO',
        });
      }
    }

    // 2. Top Holder & Insider Concentration Delta
    if (previous.holders?.top10HoldersPct !== undefined) {
      const prevHolders = previous.holders.top10HoldersPct;
      const currHolders = current.holders.top10HoldersPct;
      const holderDelta = currHolders - prevHolders;

      if (holderDelta > 3) {
        warningCount++;
        changes.push({
          type: 'WARNING',
          metric: 'Top 10 Holder Concentration',
          previousValue: `${prevHolders}%`,
          currentValue: `${currHolders}%`,
          deltaDescription: `Top 10 concentration increased by +${holderDelta.toFixed(1)}%.`,
          severity: 'WATCH',
        });
      }
    }

    // 3. Creator Linked Wallets Delta
    if (previous.holders?.creatorLinkedWalletsPct !== undefined) {
      const prevCreator = previous.holders.creatorLinkedWalletsPct;
      const currCreator = current.holders.creatorLinkedWalletsPct;
      if (currCreator < prevCreator - 1) {
        warningCount++;
        changes.push({
          type: 'WARNING',
          metric: 'Creator Wallets',
          previousValue: `${prevCreator}%`,
          currentValue: `${currCreator}%`,
          deltaDescription: `Creator-linked wallets transferred/sold ${(prevCreator - currCreator).toFixed(1)}% of supply.`,
          severity: 'HIGH',
        });
      }
    }

    // 4. Unique Traders / Organic Volume Delta
    if (previous.volume?.uniqueTraders24h !== undefined) {
      const prevTraders = previous.volume.uniqueTraders24h;
      const currTraders = current.volume.uniqueTraders24h;
      const traderDeltaPct = ((currTraders - prevTraders) / (prevTraders || 1)) * 100;

      if (traderDeltaPct >= 10) {
        positiveCount++;
        changes.push({
          type: 'POSITIVE',
          metric: 'Unique Traders',
          previousValue: prevTraders,
          currentValue: currTraders,
          deltaDescription: `Unique traders increased ${traderDeltaPct.toFixed(0)}%.`,
          severity: 'INFO',
        });
      } else if (traderDeltaPct <= -20) {
        warningCount++;
        changes.push({
          type: 'WARNING',
          metric: 'Unique Traders',
          previousValue: prevTraders,
          currentValue: currTraders,
          deltaDescription: `Trading participation dropped ${Math.abs(traderDeltaPct).toFixed(0)}%.`,
          severity: 'WATCH',
        });
      }
    }

    // 5. Exitability Score Delta
    if (previous.exitability?.exitabilityScore !== undefined) {
      const prevExit = previous.exitability.exitabilityScore;
      const currExit = current.exitability.exitabilityScore;
      const exitDelta = currExit - prevExit;

      if (exitDelta <= -10) {
        warningCount++;
        changes.push({
          type: 'WARNING',
          metric: 'Exitability Score',
          previousValue: prevExit,
          currentValue: currExit,
          deltaDescription: `Exitability fell from ${prevExit} → ${currExit}.`,
          severity: currExit < 50 ? 'HIGH' : 'WARNING',
        });
      } else if (exitDelta >= 10) {
        positiveCount++;
        changes.push({
          type: 'POSITIVE',
          metric: 'Exitability Score',
          previousValue: prevExit,
          currentValue: currExit,
          deltaDescription: `Exitability improved from ${prevExit} → ${currExit}.`,
          severity: 'INFO',
        });
      }
    }

    // If no synthetic prior delta is found, provide standard observation
    if (changes.length === 0) {
      changes.push({
        type: 'NEUTRAL',
        metric: 'State Stability',
        previousValue: 'stable',
        currentValue: 'stable',
        deltaDescription: 'No abnormal shifts in liquidity or holder metrics over this window.',
        severity: 'INFO',
      });
    }

    const overallRiskTrend: 'INCREASED' | 'STABLE' | 'DECREASED' =
      warningCount > positiveCount ? 'INCREASED' : positiveCount > warningCount ? 'DECREASED' : 'STABLE';

    const summary =
      overallRiskTrend === 'INCREASED'
        ? `Risk has increased materially over the last ${timeframe} due to liquidity drainage and worsening exitability.`
        : overallRiskTrend === 'DECREASED'
          ? `Risk conditions have improved over the last ${timeframe} with organic trader inflows and stabilizing pool depth.`
          : `Metrics remain stable with no dramatic structural changes detected over the last ${timeframe}.`;

    return {
      tokenAddress: current.tokenAddress,
      timeframe,
      overallRiskTrend,
      summary,
      changes,
      generatedAt: new Date().toISOString(),
    };
  }
}
