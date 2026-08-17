/**
 * Watchlist Service (Sprint 46 §56-58).
 *
 * Persists user watchlists and enriches entries with realtime token market snapshot data.
 */

import { snapshotEngine } from '../market-data/snapshots/snapshot-engine';
import { tokenDiscoveryPipeline } from '../market-data/discovery/token-discovery-pipeline';
import { TokenMarketSnapshot } from '../market-data/types';

export interface WatchlistEntry {
  tokenId: string;
  symbol: string;
  name: string;
  addedAt: string;
  snapshot: TokenMarketSnapshot;
}

export class WatchlistService {
  private static instance: WatchlistService;
  // Key: userId -> Set of tokenIds
  private userWatchlists: Map<string, Set<string>> = new Map();

  private constructor() {
    this.seedDefaultWatchlist();
  }

  public static getInstance(): WatchlistService {
    if (!WatchlistService.instance) {
      WatchlistService.instance = new WatchlistService();
    }
    return WatchlistService.instance;
  }

  private seedDefaultWatchlist(): void {
    const defaultUser = 'user_default';
    const sentMint = 'So11111111111111111111111111111111111111112';
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    const set = new Set<string>();
    set.add(sentMint);
    set.add(usdcMint);
    this.userWatchlists.set(defaultUser, set);
  }

  public addToWatchlist(userId: string, tokenId: string): boolean {
    if (!this.userWatchlists.has(userId)) {
      this.userWatchlists.set(userId, new Set());
    }
    const set = this.userWatchlists.get(userId)!;
    if (set.has(tokenId)) return false;
    set.add(tokenId);
    return true;
  }

  public removeFromWatchlist(userId: string, tokenId: string): boolean {
    const set = this.userWatchlists.get(userId);
    if (!set) return false;
    return set.delete(tokenId);
  }

  public isWatchlisted(userId: string, tokenId: string): boolean {
    const set = this.userWatchlists.get(userId);
    return set ? set.has(tokenId) : false;
  }

  public getWatchlist(userId: string): WatchlistEntry[] {
    const set = this.userWatchlists.get(userId);
    if (!set || set.size === 0) return [];

    const entries: WatchlistEntry[] = [];
    for (const tokenId of set) {
      const token = tokenDiscoveryPipeline.getToken(tokenId);
      const snapshot = snapshotEngine.getTokenSnapshot(tokenId);

      entries.push({
        tokenId,
        symbol: token?.symbol || snapshot.symbol || 'TOKEN',
        name: token?.name || snapshot.name || 'Token',
        addedAt: new Date().toISOString(),
        snapshot,
      });
    }

    return entries;
  }

  public reset(): void {
    this.userWatchlists.clear();
    this.seedDefaultWatchlist();
  }
}

export const watchlistService = WatchlistService.getInstance();
