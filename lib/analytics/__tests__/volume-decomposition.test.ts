import { describe, it, expect } from 'vitest';
import { VolumeDecompositionEngine } from '../volume-decomposition';

describe('10-Way Volume Decomposition Engine (Sprint 38 §13-15)', () => {
  it('decomposes raw trade events into full 10-component breakdown with high organic volume', () => {
    const trades = [
      {
        txHash: 'tx1',
        traderAddress: 'Buyer1',
        side: 'BUY' as const,
        amountUsd: 10000,
        timestamp: Date.now(),
        isFirstTimeTrader: true,
      },
      {
        txHash: 'tx2',
        traderAddress: 'Seller1',
        side: 'SELL' as const,
        amountUsd: 8000,
        timestamp: Date.now(),
        isFirstTimeTrader: false,
      },
      {
        txHash: 'tx3',
        traderAddress: 'Buyer2',
        side: 'BUY' as const,
        amountUsd: 5000,
        timestamp: Date.now(),
        isFirstTimeTrader: true,
      },
    ];

    const result = VolumeDecompositionEngine.decomposeVolume({
      tokenAddress: 'TokenABC',
      timeframe: '24h',
      trades,
    });

    expect(result.totalVolumeUsd).toBe(23000);
    expect(result.buyVolumeUsd).toBe(15000);
    expect(result.sellVolumeUsd).toBe(8000);
    expect(result.organicVolumePct).toBe(100);
    expect(result.organicScore).toBeGreaterThanOrEqual(80);
    expect(result.washTradingProbabilityPct).toBe(0);
  });

  it('correctly deducts creator-linked and suspected wash volume from organic volume', () => {
    const trades = [
      {
        txHash: 'tx1',
        traderAddress: 'CreatorWallet',
        side: 'SELL' as const,
        amountUsd: 20000,
        timestamp: Date.now(),
        isCreatorLinked: true,
      },
      {
        txHash: 'tx2',
        traderAddress: 'WashBotA',
        side: 'BUY' as const,
        amountUsd: 10000,
        timestamp: Date.now(),
        isSuspectedWash: true,
      },
      {
        txHash: 'tx3',
        traderAddress: 'RetailBuyer',
        side: 'BUY' as const,
        amountUsd: 10000,
        timestamp: Date.now(),
        isFirstTimeTrader: true,
      },
    ];

    const result = VolumeDecompositionEngine.decomposeVolume({
      tokenAddress: 'TokenManipulated',
      timeframe: '24h',
      trades,
    });

    expect(result.totalVolumeUsd).toBe(40000);
    expect(result.creatorLinkedVolumeUsd).toBe(20000);
    expect(result.suspectedWashVolumeUsd).toBe(10000);
    expect(result.organicVolumePct).toBeLessThan(50);
    expect(result.washTradingProbabilityPct).toBeGreaterThan(50);
  });
});
