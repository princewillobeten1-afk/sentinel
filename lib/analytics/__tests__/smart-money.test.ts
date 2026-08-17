import { describe, it, expect } from 'vitest';
import { SmartMoneyTracker } from '../smart-money-tracker';

describe('Smart Money Tracker & Entry Detector (Sprint 38 §41-42)', () => {
  it('detects smart money accumulation signal when multiple high win-rate wallets enter', () => {
    const entries = [
      {
        walletAddress: 'SmartAlpha1',
        tokenMint: 'TokenSol1',
        entryTimestamp: Date.now() - 120000,
        entryPriceUsd: 1.25,
        tradeSizeUsd: 8000,
        historicalWinRatePct: 75,
        historicalRealizedPnlUsd: 25000,
      },
      {
        walletAddress: 'SmartAlpha2',
        tokenMint: 'TokenSol1',
        entryTimestamp: Date.now() - 60000,
        entryPriceUsd: 1.28,
        tradeSizeUsd: 12000,
        historicalWinRatePct: 80,
        historicalRealizedPnlUsd: 45000,
      },
      {
        walletAddress: 'RetailLosingWallet',
        tokenMint: 'TokenSol1',
        entryTimestamp: Date.now() - 30000,
        entryPriceUsd: 1.3,
        tradeSizeUsd: 500,
        historicalWinRatePct: 30,
        historicalRealizedPnlUsd: -2000,
      },
    ];

    const result = SmartMoneyTracker.detectSmartMoneyEntries({
      tokenAddress: 'TokenSol1',
      entries,
    });

    expect(result.hasSmartMoneySignal).toBe(true);
    expect(result.smartWalletsDetected).toContain('SmartAlpha1');
    expect(result.smartWalletsDetected).toContain('SmartAlpha2');
    expect(result.smartWalletsDetected).not.toContain('RetailLosingWallet');
    expect(result.signal?.confidence).toBe('MEDIUM');
  });
});
