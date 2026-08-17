/**
 * Hot Market Data In-Memory Cache (Sprint 45 §58-59).
 *
 * Provides sub-millisecond cache access for live token prices, 24h volumes,
 * and liquidity with proactive write-through invalidation.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MarketDataCache {
  private static instance: MarketDataCache;
  private cache: Map<string, CacheEntry<any>> = new Map();

  private constructor() {}

  public static getInstance(): MarketDataCache {
    if (!MarketDataCache.instance) {
      MarketDataCache.instance = new MarketDataCache();
    }
    return MarketDataCache.instance;
  }

  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs = 5000): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public invalidate(key: string): void {
    this.cache.delete(key);
  }

  public invalidatePattern(prefix: string): void {
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const marketDataCache = MarketDataCache.getInstance();
