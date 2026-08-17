import type { DiscoveryToken, DiscoveryFilter, TimeWindow, DiscoverySection } from './types';
import { getMockDiscoveryTokens } from './service';
import { calculateTrendingScore } from './trending-engine';

interface CachedRankList {
  tokens: DiscoveryToken[];
  cachedAt: number;
}

/**
 * Ranking Cache Architecture (Section 36)
 *
 * Provides high-performance, in-memory cached ranking lists across 5 key dimensions:
 * 1. Global Ranking — All tokens sorted by composite discovery score
 * 2. Chain Ranking — Tokens filtered by chain (e.g. solana) and ranked
 * 3. Category Ranking — Section rankings (trending, new, momentum, volume, liquidity, movers)
 * 4. Time-Window Ranking — Rankings for specific intervals (1m, 5m, 15m, 1h, 4h, 24h)
 * 5. Personalized Ranking — Ranking boosted by user watchlist or custom preferences
 *
 * Cache TTL: 15,000ms (15 seconds) to ensure data freshness while avoiding recalculation on every request.
 */
export class RankingCache {
  private static instance: RankingCache;
  private cache: Map<string, CachedRankList> = new Map();
  private readonly TTL_MS = 15000;

  private constructor() {}

  public static getInstance(): RankingCache {
    if (!RankingCache.instance) {
      RankingCache.instance = new RankingCache();
    }
    return RankingCache.instance;
  }

  /**
   * Generates a cache key for a given ranking request.
   */
  private getCacheKey(dimension: string, chain: string, timeWindow: TimeWindow, section?: string, userKey?: string): string {
    return `${dimension}:${chain}:${timeWindow}:${section || 'default'}:${userKey || 'global'}`;
  }

  /**
   * Get cached or compute Global Ranking.
   */
  public getGlobalRanking(chain = 'solana', window: TimeWindow = '15m'): DiscoveryToken[] {
    const key = this.getCacheKey('global', chain, window);
    return this.getOrCompute(key, () => {
      return getMockDiscoveryTokens({ chain, timeWindow: window });
    });
  }

  /**
   * Get cached or compute Chain Ranking.
   */
  public getChainRanking(chain: string, window: TimeWindow = '15m'): DiscoveryToken[] {
    const key = this.getCacheKey('chain', chain, window);
    return this.getOrCompute(key, () => {
      return getMockDiscoveryTokens({ chain, timeWindow: window });
    });
  }

  /**
   * Get cached or compute Category Ranking (trending, new, momentum, etc.).
   */
  public getCategoryRanking(section: DiscoverySection, chain = 'solana', window: TimeWindow = '15m'): DiscoveryToken[] {
    const key = this.getCacheKey('category', chain, window, section);
    return this.getOrCompute(key, () => {
      return getMockDiscoveryTokens({ section, chain, timeWindow: window });
    });
  }

  /**
   * Get cached or compute Time-Window Ranking.
   */
  public getTimeWindowRanking(window: TimeWindow, chain = 'solana', section?: DiscoverySection): DiscoveryToken[] {
    const key = this.getCacheKey('timewindow', chain, window, section);
    return this.getOrCompute(key, () => {
      return getMockDiscoveryTokens({ section: section || 'trending', chain, timeWindow: window });
    });
  }

  /**
   * Get cached or compute Personalized Ranking.
   * Boosts score of tokens in user's watchlist or interacting history.
   */
  public getPersonalizedRanking(userId: string, watchlistMints: string[], chain = 'solana', window: TimeWindow = '15m'): DiscoveryToken[] {
    const key = this.getCacheKey('personalized', chain, window, undefined, userId);
    return this.getOrCompute(key, () => {
      const baseList = getMockDiscoveryTokens({ chain, timeWindow: window });
      const watchlistSet = new Set(watchlistMints);

      return [...baseList].sort((a, b) => {
        const aWatch = watchlistSet.has(a.mint) ? 15 : 0;
        const bWatch = watchlistSet.has(b.mint) ? 15 : 0;
        const scoreA = a.discoveryScore.totalScore + aWatch;
        const scoreB = b.discoveryScore.totalScore + bWatch;
        return scoreB - scoreA;
      });
    });
  }

  /**
   * Update rank for a single token incrementally when a signal is received.
   */
  public updateTokenRank(mint: string, updatedScore: number): void {
    // Invalidate only affected cached ranking lists rather than global caches.
    const expiredKeys: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tokens.some((token) => token.mint === mint)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  /**
   * Internal helper to return valid cache or recompute.
   */
  private getOrCompute(key: string, computeFn: () => DiscoveryToken[]): DiscoveryToken[] {
    const now = Date.now();
    const hit = this.cache.get(key);

    if (hit && now - hit.cachedAt < this.TTL_MS) {
      return hit.tokens;
    }

    const tokens = computeFn();
    this.cache.set(key, { tokens, cachedAt: now });
    return tokens;
  }

  /**
   * Clear cache manually.
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const rankingCache = RankingCache.getInstance();
