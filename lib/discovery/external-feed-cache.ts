interface CachedEntry {
  value: unknown;
  cachedAt: number;
}

/**
 * Caches responses from the live, rate-limited Birdeye API for discovery
 * list routes that have no caching today (trending/momentum/new/volume/
 * liquidity/movers). 30s TTL — longer than `ranking-cache.ts`'s 15s, because
 * this cache exists to protect a metered external API, not just to tune UI
 * freshness (Sprint 31 — Item 1).
 */
export class ExternalFeedCache {
  private static instance: ExternalFeedCache;
  private cache: Map<string, CachedEntry> = new Map();
  private readonly TTL_MS = 30000;

  private constructor() {}

  public static getInstance(): ExternalFeedCache {
    if (!ExternalFeedCache.instance) {
      ExternalFeedCache.instance = new ExternalFeedCache();
    }
    return ExternalFeedCache.instance;
  }

  /**
   * Returns a cached value if fresh, otherwise awaits `fetchFn`, caches, and
   * returns the result. Reports whether the call was a cache hit so callers
   * can surface it (e.g. an `X-Cache` debug header).
   */
  public async getOrFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
    const now = Date.now();
    const hit = this.cache.get(key);

    if (hit && now - hit.cachedAt < this.TTL_MS) {
      return { value: hit.value as T, hit: true };
    }

    const value = await fetchFn();
    this.cache.set(key, { value, cachedAt: now });
    return { value, hit: false };
  }

  public invalidate(key: string): void {
    this.cache.delete(key);
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const externalFeedCache = ExternalFeedCache.getInstance();
