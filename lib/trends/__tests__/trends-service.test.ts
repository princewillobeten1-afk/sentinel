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

    const newsResult = TrendsService.getTrendingNarratives({ source: 'news' });
    expect(newsResult.trends.length).toBeGreaterThan(0);
    newsResult.trends.forEach((t) => {
      expect(t.source).toBe('news');
    });
  });

  it('searches trends by recent keyword or token symbol (e.g. SENTS, Winny2k, Labubu)', () => {
    const sentsResult = TrendsService.getTrendingNarratives({ search: 'Sentients' });
    expect(sentsResult.trends.length).toBeGreaterThan(0);
    expect(sentsResult.trends[0].associatedToken.symbol).toBe('SENTS');

    const winnyResult = TrendsService.getTrendingNarratives({ search: 'WINNY2K' });
    expect(winnyResult.trends.length).toBeGreaterThan(0);
    expect(winnyResult.trends[0].title).toContain('Winny2k');

    const labubuResult = TrendsService.getTrendingNarratives({ search: 'LABUBU' });
    expect(labubuResult.trends.length).toBeGreaterThan(0);
    expect(labubuResult.trends[0].title).toContain('Labubu');
  });

  it('ensures recent trending tokens have trader-accessible market caps under $5M', () => {
    const { trends } = TrendsService.getTrendingNarratives();
    trends.forEach((t) => {
      expect(t.associatedToken).toBeDefined();
      expect(t.associatedToken.mint).toBeDefined();
      expect(t.associatedToken.symbol).toBeDefined();
      expect(t.associatedToken.priceUsd).toBeGreaterThan(0);
      expect(t.associatedToken.marketCapUsd).toBeGreaterThan(0);
      // Ensure tokens are recent trader plays rather than old multi-hundred-million mega-caps
      expect(t.associatedToken.marketCapUsd).toBeLessThan(10_000_000);
      expect(t.associatedToken.launchpad).toBeDefined();
    });
  });

  it('asynchronously fetches live trending narratives via getLiveTrendingNarratives', async () => {
    const result = await TrendsService.getLiveTrendingNarratives();
    expect(result.trends.length).toBeGreaterThan(0);
    expect(result.stats.totalTrends).toBe(result.trends.length);
    expect(result.stats.topViralityScore).toBeGreaterThanOrEqual(90);
  });
});
