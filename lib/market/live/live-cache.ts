import 'server-only';

import type { NormalizedMarketEvent } from '@/lib/market/event-pipeline';
import type { LatestMintState } from './types';

const MAX_RECENT_EVENTS = 200;

class LiveMarketCache {
  private latestByMint = new Map<string, LatestMintState>();
  private recentEvents: NormalizedMarketEvent[] = [];

  update(event: NormalizedMarketEvent): void {
    this.latestByMint.set(event.mint, {
      mint: event.mint,
      lastPriceUsd: event.priceUsd ?? null,
      lastVolumeUsd: event.volumeUsd ?? null,
      lastEventType: event.eventType,
      provider: event.provider,
      freshness: event.freshness,
      lastEventAt: event.processedAt,
    });

    this.recentEvents.push(event);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents = this.recentEvents.slice(-MAX_RECENT_EVENTS);
    }
  }

  getLatest(mint: string): LatestMintState | undefined {
    return this.latestByMint.get(mint);
  }

  getAllLatest(): LatestMintState[] {
    return [...this.latestByMint.values()];
  }

  getRecentEvents(limit = 50): NormalizedMarketEvent[] {
    return this.recentEvents.slice(-limit).reverse();
  }
}

// Survives Next.js dev-mode HMR reloads — matches lib/server/store.ts's pattern.
const globalForLiveCache = globalThis as unknown as { liveMarketCache?: LiveMarketCache };
export const liveMarketCache = globalForLiveCache.liveMarketCache ?? new LiveMarketCache();
if (process.env.NODE_ENV !== 'production') globalForLiveCache.liveMarketCache = liveMarketCache;
