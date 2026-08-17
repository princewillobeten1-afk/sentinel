import { describe, it, expect } from 'vitest';
import { rankingEngine } from '../rankings/ranking-engine';
import { tokenSearchEngine } from '../rankings/search-engine';

describe('Rankings & Search Framework (Sprint 45 §44-51, §66-72, §92)', () => {
  it('computes trending tokens with transparent momentum score breakdown', () => {
    const trending = rankingEngine.getTrendingTokens(5);

    expect(trending.length).toBeGreaterThan(0);
    expect(trending[0].rank).toBe(1);
    expect(trending[0].trendBreakdown).toBeDefined();
    expect(trending[0].trendBreakdown?.finalScore).toBeGreaterThan(0);
    expect(trending[0].trendBreakdown?.volumeMomentum).toBeDefined();
    expect(trending[0].trendBreakdown?.priceMomentum).toBeDefined();
  });

  it('ranks top gainers, losers, liquid, and volume tokens', () => {
    const gainers = rankingEngine.getTopGainers('24h', 5);
    expect(gainers.length).toBeGreaterThan(0);

    const liquid = rankingEngine.getMostLiquidTokens(5);
    expect(liquid.length).toBeGreaterThan(0);
    expect(liquid[0].liquidityUsd).toBeGreaterThanOrEqual(liquid[liquid.length - 1].liquidityUsd);
  });

  it('multi-tier token search ranks exact symbol before partial substring', () => {
    const res = tokenSearchEngine.search('SOL');

    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items[0].symbol).toBe('SOL'); // Exact symbol matches first!
  });

  it('search engine supports cursor-based pagination', () => {
    const page1 = tokenSearchEngine.search('', undefined, 2);
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = tokenSearchEngine.search('', page1.nextCursor, 2);
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
    expect(page2.items[0].tokenId).not.toBe(page1.items[0].tokenId);
  });
});
