/**
 * Realtime Market Data Publisher & WebSocket Streamer (Sprint 45 §55-57, §79).
 *
 * Implements coalesced batch publishing (250ms window) to prevent client-side UI thrashing,
 * manages subscriptions for token and market channels, and provides snapshot recovery.
 */

import { snapshotEngine } from '../snapshots/snapshot-engine';
import { priceEngine } from '../pricing/price-engine';

export type RealtimeSubscriberCallback = (data: any) => void;

export class RealtimeMarketPublisher {
  private static instance: RealtimeMarketPublisher;
  private subscribers: Map<string, Set<RealtimeSubscriberCallback>> = new Map();
  private pendingUpdates: Map<string, any> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly coalescingWindowMs = 250;

  private constructor() {}

  public static getInstance(): RealtimeMarketPublisher {
    if (!RealtimeMarketPublisher.instance) {
      RealtimeMarketPublisher.instance = new RealtimeMarketPublisher();
    }
    return RealtimeMarketPublisher.instance;
  }

  public subscribe(topic: string, callback: RealtimeSubscriberCallback): () => void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(callback);

    // Return unsubscription teardown function
    return () => {
      this.subscribers.get(topic)?.delete(callback);
      if (this.subscribers.get(topic)?.size === 0) {
        this.subscribers.delete(topic);
      }
    };
  }

  public publishTokenUpdate(tokenId: string, payload?: any): void {
    const topic = `token.market_data_updated:${tokenId}`;
    const data = payload || snapshotEngine.getTokenSnapshot(tokenId);

    this.pendingUpdates.set(topic, data);
    this.scheduleFlush();
  }

  public publishMarketPriceUpdate(marketId: string, payload?: any): void {
    const topic = `market.price_updated:${marketId.toLowerCase()}`;
    const data = payload || priceEngine.getMarketPrice(marketId);

    this.pendingUpdates.set(topic, data);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.coalescingWindowMs);
  }

  private flush(): void {
    this.flushTimer = null;
    const updates = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();

    for (const [topic, data] of updates) {
      const subs = this.subscribers.get(topic);
      if (subs) {
        subs.forEach((cb) => {
          try {
            cb(data);
          } catch (err) {
            console.error(`[REALTIME_PUBLISHER] Error in subscriber for ${topic}:`, err);
          }
        });
      }
    }
  }

  /**
   * Snapshot Recovery: Returns current snapshot state on WebSocket reconnect
   */
  public recoverSnapshot(type: 'TOKEN' | 'MARKET', id: string): any {
    if (type === 'TOKEN') {
      return snapshotEngine.getTokenSnapshot(id);
    }
    return snapshotEngine.getMarketSnapshot(id);
  }

  public reset(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.subscribers.clear();
    this.pendingUpdates.clear();
  }
}

export const realtimeMarketPublisher = RealtimeMarketPublisher.getInstance();
