/**
 * Multi-Tier Token Search Engine (Sprint 45 §44-46).
 *
 * Implements tiered search relevance ranking:
 *   Tier 1: Exact Symbol Match
 *   Tier 2: Exact Address Match
 *   Tier 3: Exact Name Match
 *   Tier 4: Prefix Symbol Match
 *   Tier 5: Partial Substring Match
 *   Tier 6: Volume / Liquidity Tie-Breaker
 *
 * Supports opaque cursor-based pagination.
 */

import { tokenDiscoveryPipeline } from '../discovery/token-discovery-pipeline';
import { snapshotEngine } from '../snapshots/snapshot-engine';
import { RankedTokenItem } from '../types';

export interface SearchResultPage {
  items: RankedTokenItem[];
  nextCursor?: string;
  totalCount: number;
}

export class TokenSearchEngine {
  private static instance: TokenSearchEngine;

  private constructor() {}

  public static getInstance(): TokenSearchEngine {
    if (!TokenSearchEngine.instance) {
      TokenSearchEngine.instance = new TokenSearchEngine();
    }
    return TokenSearchEngine.instance;
  }

  public search(query: string, cursor?: string, limit = 20): SearchResultPage {
    const rawQuery = (query || '').trim();
    const cleanQuery = rawQuery.toLowerCase().replace('$', '');
    const tokens = tokenDiscoveryPipeline.listTokens();

    let startIndex = 0;
    if (cursor) {
      try {
        const decoded = parseInt(Buffer.from(cursor, 'base64').toString('ascii'), 10);
        if (!isNaN(decoded)) startIndex = decoded;
      } catch {
        startIndex = 0;
      }
    }

    if (!cleanQuery) {
      const paged = tokens.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < tokens.length;
      const nextCursor = hasMore
        ? Buffer.from(String(startIndex + limit)).toString('base64')
        : undefined;

      const items: RankedTokenItem[] = paged.map((t, idx) => {
        const snap = snapshotEngine.getTokenSnapshot(t.tokenId);
        return {
          rank: startIndex + idx + 1,
          tokenId: t.tokenId,
          symbol: t.symbol,
          name: t.name,
          priceUsd: snap.priceUsd,
          changePct: snap.priceChange24h,
          volumeUsd: snap.volume24hUsd,
          liquidityUsd: snap.totalLiquidityUsd,
          score: 100,
        };
      });
      return { items, nextCursor, totalCount: tokens.length };
    }

    const scoredTokens: Array<{
      token: any;
      score: number;
      snapshot: any;
    }> = [];

    for (const t of tokens) {
      const snap = snapshotEngine.getTokenSnapshot(t.tokenId);
      const symbolLower = t.symbol.toLowerCase().replace('$', '');
      const nameLower = t.name.toLowerCase();
      const addressLower = t.tokenId.toLowerCase();

      let score = 0;

      // Tier 1: Exact Symbol Match
      if (symbolLower === cleanQuery) {
        score += 1000;
      }
      // Tier 2: Exact Address Match
      else if (addressLower === cleanQuery) {
        score += 800;
      }
      // Tier 3: Exact Name Match
      else if (nameLower === cleanQuery) {
        score += 600;
      }
      // Tier 4: Prefix Symbol Match
      else if (symbolLower.startsWith(cleanQuery)) {
        score += 400;
      }
      // Tier 5: Partial Substring in Symbol or Name
      else if (symbolLower.includes(cleanQuery)) {
        score += 200;
      } else if (nameLower.includes(cleanQuery)) {
        score += 100;
      } else if (addressLower.includes(cleanQuery)) {
        score += 50;
      }

      if (score > 0) {
        // Tier 6: Volume / Liquidity tie-breaker bonus
        const volumeBonus = Math.min(20, Math.log10(Math.max(1, snap.volume24hUsd)) * 2);
        score += volumeBonus;

        scoredTokens.push({
          token: t,
          score,
          snapshot: snap,
        });
      }
    }

    scoredTokens.sort((a, b) => b.score - a.score);

    const paged = scoredTokens.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < scoredTokens.length;
    const nextCursor = hasMore
      ? Buffer.from(String(startIndex + limit)).toString('base64')
      : undefined;

    const items: RankedTokenItem[] = paged.map((item, idx) => ({
      rank: startIndex + idx + 1,
      tokenId: item.token.tokenId,
      symbol: item.token.symbol,
      name: item.token.name,
      priceUsd: item.snapshot.priceUsd,
      changePct: item.snapshot.priceChange24h,
      volumeUsd: item.snapshot.volume24hUsd,
      liquidityUsd: item.snapshot.totalLiquidityUsd,
      score: parseFloat(item.score.toFixed(2)),
    }));

    return {
      items,
      nextCursor,
      totalCount: scoredTokens.length,
    };
  }
}

export const tokenSearchEngine = TokenSearchEngine.getInstance();
