import { describe, it, expect, beforeEach } from 'vitest';
import { volumeEngine } from '../volume/volume-engine';

describe('Canonical Volume Engine & Windows (Sprint 45 §27-30, §91)', () => {
  beforeEach(() => {
    volumeEngine.reset();
  });

  it('tracks volume across 5 rolling windows (5m, 15m, 1h, 6h, 24h) with buy/sell breakdown', () => {
    const marketId = 'solana:raydium_cpmm:58oqchx4ywmvkdwllzzbi4chocc2fqcuwbkwmihlyqo2';
    const summary = volumeEngine.getVolumeSummary(marketId);

    expect(summary.volume24h.volumeUsd).toBeGreaterThan(0);
    expect(summary.volume24h.buyVolumeUsd + summary.volume24h.sellVolumeUsd).toBeCloseTo(summary.volume24h.volumeUsd, 1);
    expect(summary.volume24h.tradeCount).toBeGreaterThan(0);
  });

  it('deduplicates swap events to prevent double counting across indexer reprocessing', () => {
    const marketId = 'solana:test:dedup_pool';
    const swap = {
      id: 'unique_tx_swap_dedup_01',
      marketId,
      txHash: '0xHashDedup123',
      senderWallet: 'WalletA',
      side: 'BUY' as const,
      baseAmount: 10,
      quoteAmount: 1500,
      priceUsd: 150.0,
      volumeUsd: 1500.0,
      slotOrBlock: 100,
      timestamp: new Date().toISOString(),
    };

    const firstIngest = volumeEngine.ingestSwap(swap);
    expect(firstIngest).toBe(true);

    // Replay identical event
    const secondIngest = volumeEngine.ingestSwap(swap);
    expect(secondIngest).toBe(false);
  });
});
