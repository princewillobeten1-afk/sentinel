/**
 * Canonical Token Ranking Engine (Sprint 45 §47-51, §66-72).
 *
 * Implements a generic ranking framework, multi-factor trending momentum scoring,
 * top gainers, top losers, most liquid, highest volume, and new token feeds.
 */

import { tokenDiscoveryPipeline } from '../discovery/token-discovery-pipeline';
import { snapshotEngine } from '../snapshots/snapshot-engine';
import { RankedTokenItem, TokenTrendBreakdown } from '../types';

export class RankingEngine {
  private static instance: RankingEngine;

  private constructor() {}

  public static getInstance(): RankingEngine {
    if (!RankingEngine.instance) {
      RankingEngine.instance = new RankingEngine();
    }
    return RankingEngine.instance;
  }

  /**
   * Calculates transparent trending momentum score
   */
  public computeTrendScore(snapshot: any): TokenTrendBreakdown {
    // 1. Volume Momentum: ratio of 1h volume to (24h volume / 24)
    const expectedHourlyVol = Math.max(1, snapshot.volume24hUsd / 24);
    const volumeMomentum = Math.min(40, (snapshot.volume1hUsd / expectedHourlyVol) * 15);

    // 2. Price Momentum: positive price acceleration
    const priceMomentum = Math.min(30, Math.max(0, snapshot.priceChange1h * 3 + snapshot.priceChange24h * 0.5));

    // 3. Activity Momentum: simulated active trader interactions
    const activityMomentum = 18.5;

    // 4. Liquidity Factor: log10 depth weight
    const liquidityFactor = Math.min(15, Math.log10(Math.max(10, snapshot.totalLiquidityUsd)) * 2.5);

    const finalScore = parseFloat(
      (volumeMomentum + priceMomentum + activityMomentum + liquidityFactor).toFixed(2)
    );

    return {
      volumeMomentum: parseFloat(volumeMomentum.toFixed(2)),
      priceMomentum: parseFloat(priceMomentum.toFixed(2)),
      activityMomentum: parseFloat(activityMomentum.toFixed(2)),
      liquidityFactor: parseFloat(liquidityFactor.toFixed(2)),
      finalScore,
    };
  }

  public getTrendingTokens(limit = 10): RankedTokenItem[] {
    const tokens = tokenDiscoveryPipeline.listTokens({ status: 'ACTIVE' });
    const items: RankedTokenItem[] = [];

    for (const t of tokens) {
      const snap = snapshotEngine.getTokenSnapshot(t.tokenId);
      const trend = this.computeTrendScore(snap);

      items.push({
        rank: 1,
        tokenId: t.tokenId,
        symbol: t.symbol,
        name: t.name,
        priceUsd: snap.priceUsd,
        changePct: snap.priceChange24h,
        volumeUsd: snap.volume24hUsd,
        liquidityUsd: snap.totalLiquidityUsd,
        score: trend.finalScore,
        trendBreakdown: trend,
      });
    }

    items.sort((a, b) => b.score - a.score);
    return items.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  public getTopGainers(timeframe: '1h' | '6h' | '24h' = '24h', limit = 10): RankedTokenItem[] {
    const tokens = tokenDiscoveryPipeline.listTokens();
    const items: RankedTokenItem[] = [];

    for (const t of tokens) {
      const snap = snapshotEngine.getTokenSnapshot(t.tokenId);
      if (snap.totalLiquidityUsd >= 5000) {
        const changePct =
          timeframe === '1h'
            ? snap.priceChange1h
            : timeframe === '6h'
            ? snap.priceChange6h
            : snap.priceChange24h;

        items.push({
          rank: 1,
          tokenId: t.tokenId,
          symbol: t.symbol,
          name: t.name,
          priceUsd: snap.priceUsd,
          changePct,
          volumeUsd: snap.volume24hUsd,
          liquidityUsd: snap.totalLiquidityUsd,
          score: changePct,
        });
      }
    }

    items.sort((a, b) => b.changePct - a.changePct);
    return items.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  public getTopLosers(timeframe: '1h' | '6h' | '24h' = '24h', limit = 10): RankedTokenItem[] {
    const tokens = tokenDiscoveryPipeline.listTokens();
    const items: RankedTokenItem[] = [];

    for (const t of tokens) {
      const snap = snapshotEngine.getTokenSnapshot(t.tokenId);
      if (snap.totalLiquidityUsd >= 5000) {
        const changePct =
          timeframe === '1h'
            ? snap.priceChange1h
            : timeframe === '6h'
            ? snap.priceChange6h
            : snap.priceChange24h;

        items.push({
          rank: 1,
          tokenId: t.tokenId,
          symbol: t.symbol,
          name: t.name,
          priceUsd: snap.priceUsd,
          changePct,
          volumeUsd: snap.volume24hUsd,
          liquidityUsd: snap.totalLiquidityUsd,
          score: changePct,
        });
      }
    }

    items.sort((a, b) => a.changePct - b.changePct);
    return items.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  public getMostLiquidTokens(limit = 10): RankedTokenItem[] {
    const tokens = tokenDiscoveryPipeline.listTokens();
    const items: RankedTokenItem[] = [];

    for (const t of tokens) {
      const snap = snapshotEngine.getTokenSnapshot(t.tokenId);
      items.push({
        rank: 1,
        tokenId: t.tokenId,
        symbol: t.symbol,
        name: t.name,
        priceUsd: snap.priceUsd,
        changePct: snap.priceChange24h,
        volumeUsd: snap.volume24hUsd,
        liquidityUsd: snap.totalLiquidityUsd,
        score: snap.totalLiquidityUsd,
      });
    }

    items.sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    return items.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  public getHighestVolumeTokens(limit = 10): RankedTokenItem[] {
    const tokens = tokenDiscoveryPipeline.listTokens();
    const items: RankedTokenItem[] = [];

    for (const t of tokens) {
      const snap = snapshotEngine.getTokenSnapshot(t.tokenId);
      items.push({
        rank: 1,
        tokenId: t.tokenId,
        symbol: t.symbol,
        name: t.name,
        priceUsd: snap.priceUsd,
        changePct: snap.priceChange24h,
        volumeUsd: snap.volume24hUsd,
        liquidityUsd: snap.totalLiquidityUsd,
        score: snap.volume24hUsd,
      });
    }

    items.sort((a, b) => b.volumeUsd - a.volumeUsd);
    return items.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  public getNewTokensFeed(filter?: {
    chainId?: string;
    minLiquidityUsd?: number;
    minVolumeUsd?: number;
    limit?: number;
  }): RankedTokenItem[] {
    let tokens = tokenDiscoveryPipeline.listTokens({ chainId: filter?.chainId });

    // Sort by discovery date descending
    tokens.sort((a, b) => new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime());

    const items: RankedTokenItem[] = [];
    for (const t of tokens) {
      const snap = snapshotEngine.getTokenSnapshot(t.tokenId);
      if (filter?.minLiquidityUsd && snap.totalLiquidityUsd < filter.minLiquidityUsd) continue;
      if (filter?.minVolumeUsd && snap.volume24hUsd < filter.minVolumeUsd) continue;

      items.push({
        rank: 1,
        tokenId: t.tokenId,
        symbol: t.symbol,
        name: t.name,
        priceUsd: snap.priceUsd,
        changePct: snap.priceChange24h,
        volumeUsd: snap.volume24hUsd,
        liquidityUsd: snap.totalLiquidityUsd,
        score: new Date(t.firstSeenAt).getTime(),
      });
    }

    const limit = filter?.limit || 10;
    return items.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }
}

export const rankingEngine = RankingEngine.getInstance();
