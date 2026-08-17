/**
 * Canonical Volume Engine (Sprint 45 §27-30, §64).
 *
 * Tracks 5 rolling volume windows (5m, 15m, 1h, 6h, 24h), decomposes buy vs sell volume,
 * enforces event deduplication, and detects volume spike anomalies.
 */

import { SwapEvent } from '../types';

export interface VolumeMetrics {
  volumeUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
}

export interface MultiWindowVolumeSummary {
  marketOrTokenId: string;
  volume5m: VolumeMetrics;
  volume15m: VolumeMetrics;
  volume1h: VolumeMetrics;
  volume6h: VolumeMetrics;
  volume24h: VolumeMetrics;
  volumeSpikeAnomaly: boolean;
  updatedAt: string;
}

export class VolumeEngine {
  private static instance: VolumeEngine;
  private processedEventIds: Set<string> = new Set();
  private swaps: SwapEvent[] = [];

  private constructor() {
    this.seedDefaultSwaps();
  }

  public static getInstance(): VolumeEngine {
    if (!VolumeEngine.instance) {
      VolumeEngine.instance = new VolumeEngine();
    }
    return VolumeEngine.instance;
  }

  private seedDefaultSwaps(): void {
    const marketId = 'solana:raydium_cpmm:58oqchx4ywmvkdwllzzbi4chocc2fqcuwbkwmihlyqo2';
    const now = Date.now();

    // Ingest simulated swaps across 24 hours
    for (let i = 0; i < 20; i++) {
      const ageMs = i * 15 * 60 * 1000; // spread over past 5 hours
      const isBuy = i % 2 === 0;
      this.ingestSwap({
        id: `swap_seed_${i}`,
        marketId,
        txHash: `0xSeedTxHash_${i}`,
        senderWallet: `Wallet_${i}`,
        side: isBuy ? 'BUY' : 'SELL',
        baseAmount: 10 + i * 2,
        quoteAmount: (10 + i * 2) * 150,
        priceUsd: 150 + (i % 3) * 0.2,
        volumeUsd: (10 + i * 2) * 150,
        slotOrBlock: 284910000 + i,
        timestamp: new Date(now - ageMs).toISOString(),
      });
    }
  }

  public ingestSwap(swap: SwapEvent): boolean {
    // 1. Deduplication Gate
    if (this.processedEventIds.has(swap.id)) {
      return false; // Dropped duplicate
    }

    this.processedEventIds.add(swap.id);
    this.swaps.push(swap);

    // Prune events older than 48 hours
    const cutoff = Date.now() - 48 * 3600 * 1000;
    if (this.swaps.length > 50000) {
      this.swaps = this.swaps.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
    }

    return true;
  }

  /**
   * Computes volume aggregation over a window in seconds
   */
  private aggregateWindow(swaps: SwapEvent[], windowSeconds: number): VolumeMetrics {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    let volumeUsd = 0;
    let buyVolumeUsd = 0;
    let sellVolumeUsd = 0;
    let tradeCount = 0;
    let buyCount = 0;
    let sellCount = 0;

    for (const s of swaps) {
      const t = new Date(s.timestamp).getTime();
      if (t >= windowStart && t <= now) {
        volumeUsd += s.volumeUsd;
        tradeCount++;
        if (s.side === 'BUY') {
          buyVolumeUsd += s.volumeUsd;
          buyCount++;
        } else {
          sellVolumeUsd += s.volumeUsd;
          sellCount++;
        }
      }
    }

    return {
      volumeUsd: parseFloat(volumeUsd.toFixed(2)),
      buyVolumeUsd: parseFloat(buyVolumeUsd.toFixed(2)),
      sellVolumeUsd: parseFloat(sellVolumeUsd.toFixed(2)),
      tradeCount,
      buyCount,
      sellCount,
    };
  }

  public getVolumeSummary(marketId: string): MultiWindowVolumeSummary {
    const matchingSwaps = this.swaps.filter(
      (s) => s.marketId.toLowerCase() === marketId.toLowerCase()
    );

    const volume5m = this.aggregateWindow(matchingSwaps, 5 * 60);
    const volume15m = this.aggregateWindow(matchingSwaps, 15 * 60);
    const volume1h = this.aggregateWindow(matchingSwaps, 60 * 60);
    const volume6h = this.aggregateWindow(matchingSwaps, 6 * 60 * 60);
    const volume24h = this.aggregateWindow(matchingSwaps, 24 * 60 * 60);

    // Volume Spike Detection: if 5m volume is > 30% of entire 24h volume
    const volumeSpikeAnomaly =
      volume24h.volumeUsd > 1000 && volume5m.volumeUsd > volume24h.volumeUsd * 0.3;

    return {
      marketOrTokenId: marketId,
      volume5m,
      volume15m,
      volume1h,
      volume6h,
      volume24h,
      volumeSpikeAnomaly,
      updatedAt: new Date().toISOString(),
    };
  }

  public reset(): void {
    this.processedEventIds.clear();
    this.swaps = [];
    this.seedDefaultSwaps();
  }
}

export const volumeEngine = VolumeEngine.getInstance();
