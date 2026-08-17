import { describe, it, expect } from 'vitest';
import { WashTradingDetector } from '../wash-trading-detector';

describe('Wash Trading Detection Engine (Sprint 38 §16)', () => {
  it('detects circular reciprocal swap rings (A -> B -> A)', () => {
    const now = Date.now();
    const swaps = [
      {
        txHash: 'tx1',
        senderAddress: 'WalletA',
        recipientAddress: 'WalletB',
        tokenMint: 'TokenX',
        amountUsd: 5000,
        amountTokens: 50000,
        timestamp: now - 60000,
      },
      {
        txHash: 'tx2',
        senderAddress: 'WalletB',
        recipientAddress: 'WalletA',
        tokenMint: 'TokenX',
        amountUsd: 5000,
        amountTokens: 50000,
        timestamp: now - 45000,
      },
      {
        txHash: 'tx3',
        senderAddress: 'WalletA',
        recipientAddress: 'WalletB',
        tokenMint: 'TokenX',
        amountUsd: 5000,
        amountTokens: 50000,
        timestamp: now - 30000,
      },
      {
        txHash: 'tx4',
        senderAddress: 'WalletB',
        recipientAddress: 'WalletA',
        tokenMint: 'TokenX',
        amountUsd: 5000,
        amountTokens: 50000,
        timestamp: now - 15000,
      },
    ];

    const patterns = WashTradingDetector.detectWashPatterns(swaps);
    expect(patterns.length).toBeGreaterThan(0);
    const ringPattern = patterns.find((p) => p.patternType === 'CIRCULAR_RING');
    expect(ringPattern).toBeDefined();
    expect(ringPattern?.participatingWallets).toContain('WalletA');
    expect(ringPattern?.participatingWallets).toContain('WalletB');
    expect(ringPattern?.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('detects synchronized same-size trades across multiple wallets', () => {
    const now = Date.now();
    const swaps = [
      { txHash: 't1', senderAddress: 'W1', recipientAddress: 'Pool', tokenMint: 'M', amountUsd: 4000, amountTokens: 10, timestamp: now - 1000 },
      { txHash: 't2', senderAddress: 'W2', recipientAddress: 'Pool', tokenMint: 'M', amountUsd: 4000, amountTokens: 10, timestamp: now - 800 },
      { txHash: 't3', senderAddress: 'W3', recipientAddress: 'Pool', tokenMint: 'M', amountUsd: 4000, amountTokens: 10, timestamp: now - 600 },
      { txHash: 't4', senderAddress: 'W4', recipientAddress: 'Pool', tokenMint: 'M', amountUsd: 4000, amountTokens: 10, timestamp: now - 400 },
    ];

    const patterns = WashTradingDetector.detectWashPatterns(swaps);
    const syncPattern = patterns.find((p) => p.patternType === 'SAME_SIZE_SYNC');
    expect(syncPattern).toBeDefined();
    expect(syncPattern?.estimatedWashVolumeUsd).toBe(16000);
  });
});
