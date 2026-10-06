import { INITIAL_TREND_ITEMS } from './mock-trends-data';
import type { TrendItem, TrendStats, TrendSource, TrendCategory } from './types';

export class TrendsService {
  private static cachedTrends: TrendItem[] = [...INITIAL_TREND_ITEMS];

  /**
   * Returns list of trending topics & narratives with optional filtering
   */
  public static getTrendingNarratives(params?: {
    source?: string;
    category?: string;
    search?: string;
  }): { trends: TrendItem[]; stats: TrendStats } {
    let filtered = [...this.cachedTrends];

    // Filter by Source (tiktok, x, news, culture, etc.)
    if (params?.source && params.source !== 'all') {
      const targetSource = params.source.toLowerCase();
      filtered = filtered.filter((t) => t.source.toLowerCase() === targetSource);
    }

    // Filter by Category
    if (params?.category && params.category !== 'all') {
      const targetCategory = params.category.toLowerCase();
      filtered = filtered.filter((t) => t.category.toLowerCase() === targetCategory);
    }

    // Search by title, summary, catalyst, symbol, or hashtags
    if (params?.search && params.search.trim().length > 0) {
      const query = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.summary.toLowerCase().includes(query) ||
          t.catalyst.toLowerCase().includes(query) ||
          t.associatedToken.symbol.toLowerCase().includes(query) ||
          t.associatedToken.name.toLowerCase().includes(query) ||
          (t.metrics.hashtags && t.metrics.hashtags.some((h) => h.toLowerCase().includes(query)))
      );
    }

    // Sort by virality score descending
    filtered.sort((a, b) => b.viralityScore - a.viralityScore);

    const stats = this.computeStats(this.cachedTrends);

    return {
      trends: filtered,
      stats,
    };
  }

  /**
   * Returns single trend by ID
   */
  public static getTrendById(id: string): TrendItem | undefined {
    return this.cachedTrends.find((t) => t.id === id);
  }

  /**
   * Computes overview statistics across trends
   */
  private static computeStats(items: TrendItem[]): TrendStats {
    let maxVirality = 0;
    let tiktokCount = 0;
    let xCount = 0;
    let newsCount = 0;
    let cultureCount = 0;

    for (const item of items) {
      if (item.viralityScore > maxVirality) maxVirality = item.viralityScore;
      if (item.source === 'tiktok') tiktokCount++;
      else if (item.source === 'x') xCount++;
      else if (item.source === 'news') newsCount++;
      else if (item.source === 'culture') cultureCount++;
    }

    return {
      totalTrends: items.length,
      topViralityScore: maxVirality,
      tiktokCount,
      xCount,
      newsCount,
      cultureCount,
      lastUpdated: new Date().toISOString(),
    };
  }
}
