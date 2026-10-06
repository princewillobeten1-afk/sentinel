import { describe, it, expect } from 'vitest';
import { TrendsService } from '../trends-service';

describe('TrendsService - Meme Trend Radar & Viral Newsfeed', () => {
  it('returns all initial trending topics sorted by virality score descending', () => {
    const { trends, stats } = TrendsService.getTrendingNarratives();
    expect(trends.length).toBeGreaterThan(0);
    expect(stats.totalTrends).toBe(trends.length);
    expect(stats.topViralityScore).toBeGreaterThanOrEqual(95);

    // Verify sorted by virality score descending
    for (let i = 0; i < trends.length - 1; i++) {
      expect(trends[i].viralityScore).toBeGreaterThanOrEqual(trends[i + 1].viralityScore);
    }
  });

  it('filters trends by source platform (e.g. tiktok, x, news)', () => {
    const tiktokResult = TrendsService.getTrendingNarratives({ source: 'tiktok' });
    expect(tiktokResult.trends.length).toBeGreaterThan(0);
    tiktokResult.trends.forEach((t) => {
      expect(t.source).toBe('tiktok');
    });

    const xResult = TrendsService.getTrendingNarratives({ source: 'x' });
    expect(xResult.trends.length).toBeGreaterThan(0);
    xResult.trends.forEach((t) => {
      expect(t.source).toBe('x');
    });
  });

  it('searches trends by keyword or token symbol', () => {
    const searchResult = TrendsService.getTrendingNarratives({ search: 'Chill Guy' });
    expect(searchResult.trends.length).toBeGreaterThan(0);
    expect(searchResult.trends[0].associatedToken.symbol).toBe('CHILLGUY');

    const pnutResult = TrendsService.getTrendingNarratives({ search: 'PNUT' });
    expect(pnutResult.trends.length).toBeGreaterThan(0);
    expect(pnutResult.trends[0].title).toContain('Peanut');
  });

  it('ensures each trend has a valid associated Solana token with price and mint', () => {
    const { trends } = TrendsService.getTrendingNarratives();
    trends.forEach((t) => {
      expect(t.associatedToken).toBeDefined();
      expect(t.associatedToken.mint).toBeDefined();
      expect(t.associatedToken.symbol).toBeDefined();
      expect(t.associatedToken.priceUsd).toBeGreaterThan(0);
      expect(t.associatedToken.marketCapUsd).toBeGreaterThan(0);
      expect(t.associatedToken.launchpad).toBeDefined();
    });
  });
});
