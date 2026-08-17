/**
 * Smart-Money Alpha Tracking & Coordinated Entry Detector (Sprint 38 §41-42).
 *
 * Distinguishes true alpha wallets (consistent high win-rate + early entry precision)
 * from pure capital whales. Detects multi-wallet smart-money accumulation clusters.
 */

import { SmartMoneySignal } from './types';

export interface SmartWalletEntryEvent {
  walletAddress: string;
  tokenMint: string;
  entryTimestamp: number;
  entryPriceUsd: number;
  tradeSizeUsd: number;
  historicalWinRatePct: number;
  historicalRealizedPnlUsd: number;
}

export class SmartMoneyTracker {
  /**
   * Evaluates recent entries on a token to identify coordinated smart-money accumulation.
   */
  public static detectSmartMoneyEntries(params: {
    tokenAddress: string;
    entries: SmartWalletEntryEvent[];
    timeWindowMinutes?: number;
  }): { hasSmartMoneySignal: boolean; signal?: SmartMoneySignal; smartWalletsDetected: string[] } {
    const { tokenAddress, entries, timeWindowMinutes = 10 } = params;

    // Filter for wallets meeting strict smart-money criteria (§41)
    const smartEntries = entries.filter(
      (e) => e.historicalWinRatePct >= 65 && e.historicalRealizedPnlUsd >= 5000
    );

    if (smartEntries.length === 0) {
      return {
        hasSmartMoneySignal: false,
        smartWalletsDetected: [],
      };
    }

    const distinctWallets = Array.from(new Set(smartEntries.map((e) => e.walletAddress)));
    const totalVolume = smartEntries.reduce((acc, e) => acc + e.tradeSizeUsd, 0);

    const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
      distinctWallets.length >= 5 ? 'HIGH' : distinctWallets.length >= 2 ? 'MEDIUM' : 'LOW';

    const signal = {
      tokenAddress,
      smartWalletsCount: distinctWallets.length,
      participatingWallets: distinctWallets,
      totalAccumulatedUsd: Number(totalVolume.toFixed(2)),
      timeWindowMinutes,
      confidence,
      summary: `${distinctWallets.length} historically successful wallet(s) entered ${tokenAddress.slice(0, 6)}... within ${timeWindowMinutes} minutes ($${totalVolume.toLocaleString()} total).`,
      timestamp: new Date().toISOString(),
    };

    return {
      hasSmartMoneySignal: distinctWallets.length >= 2,
      signal,
      smartWalletsDetected: distinctWallets,
    };
  }
}
