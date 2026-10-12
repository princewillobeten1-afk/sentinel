import { INITIAL_TREND_ITEMS } from './mock-trends-data';
import type { TrendItem, TrendStats, TrendSource, TrendCategory, TrendVelocity, TrendToken } from './types';

interface DexTokenProfile {
  url?: string;
  chainId?: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: Array<{ type?: string; label?: string; url?: string }>;
}

const CACHE_TTL_MS = 25_000; // 25 seconds cache for snappy responsiveness
const MAX_MARKET_CAP_USD = 40_000_000; // Filter out legacy mega-caps (RAY, SOL, JUP) to focus on recent breakout tokens
const MIN_VOLUME_USD = 5_000; // Filter out dead launches

function formatTimeAgo(isoString?: string): string {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function detectCategory(name: string, desc: string = '', tags: string[] = []): TrendCategory {
  const text = `${name} ${desc} ${tags.join(' ')}`.toLowerCase();
  if (
    text.includes('ai') ||
    text.includes('agent') ||
    text.includes('bot') ||
    text.includes('model') ||
    text.includes('compute') ||
    text.includes('deepseek') ||
    text.includes('vram')
  ) {
    return 'ai';
  }
  if (
    text.includes('game') ||
    text.includes('minecraft') ||
    text.includes('poke') ||
    text.includes('play') ||
    text.includes('pixel') ||
    text.includes('quest')
  ) {
    return 'gaming';
  }
  if (
    text.includes('dog') ||
    text.includes('cat') ||
    text.includes('hippo') ||
    text.includes('penguin') ||
    text.includes('pet') ||
    text.includes('bear') ||
    text.includes('animal') ||
    text.includes('frog')
  ) {
    return 'animals';
  }
  if (
    text.includes('reserve') ||
    text.includes('trump') ||
    text.includes('biden') ||
    text.includes('fed') ||
    text.includes('sec') ||
    text.includes('policy') ||
    text.includes('tariff') ||
    text.includes('gov') ||
    text.includes('senate') ||
    text.includes('congress') ||
    text.includes('whitehouse')
  ) {
    return 'politics';
  }
  if (
    text.includes('music') ||
    text.includes('retro') ||
    text.includes('y2k') ||
    text.includes('art') ||
    text.includes('podcast') ||
    text.includes('labubu') ||
    text.includes('star') ||
    text.includes('celeb')
  ) {
    return 'pop_culture';
  }
  return 'meme';
}

function detectSource(
  links: Array<{ type?: string; label?: string; url?: string }> = [],
  desc: string = ''
): TrendSource {
  const text = desc.toLowerCase();
  const hasTiktok =
    links.some((l) => l.type === 'tiktok' || l.url?.toLowerCase().includes('tiktok.com')) ||
    text.includes('tiktok') ||
    text.includes('reels') ||
    text.includes('capcut') ||
    text.includes('soundboard');
  if (hasTiktok) return 'tiktok';

  const hasNews =
    text.includes('bloomberg') ||
    text.includes('reuters') ||
    text.includes('cnbc') ||
    text.includes('headline') ||
    text.includes('breaking') ||
    text.includes('legislation') ||
    text.includes('hearing') ||
    text.includes('white house') ||
    text.includes('press release');
  if (hasNews) return 'news';

  const hasTwitter =
    links.some(
      (l) =>
        l.type === 'twitter' ||
        l.url?.toLowerCase().includes('x.com') ||
        l.url?.toLowerCase().includes('twitter.com')
    ) ||
    text.includes('tweet') ||
    text.includes('crypto twitter') ||
    text.includes('kol');
  if (hasTwitter) return 'x';

  return 'culture';
}

function calculateVirality(
  traders1h: number,
  traders5m: number,
  volume24h: number,
  priceChange1h: number,
  isBoosted: boolean
): number {
  let score = 81;
  if (isBoosted) score += 4;
  if (traders1h > 500) score += 6;
  else if (traders1h > 150) score += 4;
  else if (traders1h > 50) score += 2;

  if (traders5m > 100) score += 4;
  else if (traders5m > 30) score += 2;

  if (volume24h > 1_000_000) score += 4;
  else if (volume24h > 100_000) score += 2;

  if (priceChange1h > 100) score += 4;
  else if (priceChange1h > 30) score += 2;

  return Math.min(99, Math.max(78, score));
}

function calculateVelocity(traders1h: number, priceChange1h: number): TrendVelocity {
  if (traders1h > 400 || priceChange1h > 200) return 'exploding';
  if (traders1h > 150 || priceChange1h > 50) return 'surging';
  if (priceChange1h < -20) return 'peaking';
  return 'rising';
}

export class TrendsService {
  private static cachedTrends: TrendItem[] = [...INITIAL_TREND_ITEMS];
  private static lastFetchedAt: number = 0;
  private static isFetching: boolean = false;

  /**
   * Returns list of trending topics & narratives with optional filtering (synchronous).
   * Background refreshes if cache is expired.
   */
  public static getTrendingNarratives(params?: {
    source?: string;
    category?: string;
    search?: string;
  }): { trends: TrendItem[]; stats: TrendStats } {
    // If cache is stale, trigger non-blocking background refresh
    const now = Date.now();
    if (now - this.lastFetchedAt > CACHE_TTL_MS && !this.isFetching) {
      this.refreshLiveTrends().catch((err) =>
        console.warn('[TRENDS_SERVICE] Background refresh warning:', err?.message)
      );
    }

    return this.applyFiltersAndStats(this.cachedTrends, params);
  }

  /**
   * Fetches fresh live trending tokens and narratives (asynchronous).
   * Actively queries DexScreener live token profiles and Jupiter live feeds.
   */
  public static async getLiveTrendingNarratives(params?: {
    source?: string;
    category?: string;
    search?: string;
  }): Promise<{ trends: TrendItem[]; stats: TrendStats }> {
    const now = Date.now();
    if (now - this.lastFetchedAt > CACHE_TTL_MS) {
      await this.refreshLiveTrends();
    }

    return this.applyFiltersAndStats(this.cachedTrends, params);
  }

  /**
   * Returns single trend by ID
   */
  public static getTrendById(id: string): TrendItem | undefined {
    return this.cachedTrends.find((t) => t.id === id);
  }

  /**
   * Live crawler that fetches recent breakout Solana tokens from DexScreener & Jupiter,
   * converts them to rich TrendItems, and merges with recent curated narratives.
   */
  private static async refreshLiveTrends(): Promise<void> {
    if (this.isFetching) return;
    this.isFetching = true;

    try {
      // 1. Fetch live DexScreener profiles & boosts (real promoted/boosted recent launches)
      const [profilesRes, boostsRes] = await Promise.all([
        fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        }).catch(() => null),
        fetch('https://api.dexscreener.com/token-boosts/latest/v1', {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        }).catch(() => null),
      ]);

      const profiles: DexTokenProfile[] = profilesRes?.ok
        ? await profilesRes.json().catch(() => [])
        : [];
      const boosts: any[] = boostsRes?.ok ? await boostsRes.json().catch(() => []) : [];

      const solanaProfiles = Array.isArray(profiles)
        ? profiles.filter((p) => p.chainId === 'solana' && p.tokenAddress)
        : [];
      const solanaBoosts = Array.isArray(boosts)
        ? boosts.filter((b) => b.chainId === 'solana' && b.tokenAddress)
        : [];

      // Merge into a profile metadata map
      const metaMap = new Map<string, DexTokenProfile>();
      for (const b of solanaBoosts) {
        if (b.tokenAddress && !metaMap.has(b.tokenAddress)) {
          metaMap.set(b.tokenAddress, {
            tokenAddress: b.tokenAddress,
            icon: b.icon,
            header: b.header,
            description: b.description,
            links: b.links,
          });
        }
      }
      for (const p of solanaProfiles) {
        if (p.tokenAddress) {
          metaMap.set(p.tokenAddress, {
            ...metaMap.get(p.tokenAddress),
            ...p,
          });
        }
      }

      const targetAddresses = Array.from(metaMap.keys()).slice(0, 30);

      // 2. Query Jupiter token details for live prices, volume, traders, and mcap
      let liveJupTokens: any[] = [];
      if (targetAddresses.length > 0) {
        try {
          const jupRes = await fetch(
            `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(targetAddresses.join(','))}`,
            { headers: { accept: 'application/json' }, cache: 'no-store' }
          );
          if (jupRes.ok) {
            const data = await jupRes.json().catch(() => []);
            liveJupTokens = Array.isArray(data) ? data : [];
          }
        } catch (err) {
          console.warn('[TRENDS_SERVICE] Jupiter search failed:', err);
        }
      }

      // Convert live tokens to TrendItem instances
      const liveTrendItems: TrendItem[] = [];

      for (const jt of liveJupTokens) {
        if (!jt?.id) continue;
        const mcap = Math.round(jt.mcap || 0);

        // Filter out dinosaur mega-caps (> $40M) and dead tokens
        if (mcap > MAX_MARKET_CAP_USD) continue;
        const volume24h = Math.round(
          (jt.stats24h?.buyVolume || 0) + (jt.stats24h?.sellVolume || 0)
        );
        if (volume24h < MIN_VOLUME_USD && mcap < 15_000) continue;

        const prof = metaMap.get(jt.id);
        const symbol = jt.symbol || 'TOKEN';
        const name = jt.name || symbol;
        const desc = prof?.description || `${name} viral community play surging on Solana.`;

        const traders1h = jt.stats1h?.numTraders || 0;
        const traders5m = jt.stats5m?.numTraders || 0;
        const priceChange1h = Math.round(jt.stats1h?.priceChange || 0);
        const priceChange24h = Math.round(jt.stats24h?.priceChange || 0);

        const source = detectSource(prof?.links, desc);
        const category = detectCategory(name, desc, jt.tags || []);
        const viralityScore = calculateVirality(
          traders1h,
          traders5m,
          volume24h,
          priceChange1h,
          !!prof
        );
        const velocity = calculateVelocity(traders1h, priceChange1h);
        const timeAgo = formatTimeAgo(jt.createdAt);

        let launchpad: TrendToken['launchpad'] = 'unknown';
        if (jt.launchpad === 'pump.fun' || jt.id.endsWith('pump')) {
          launchpad = 'pump.fun';
        } else if (jt.launchpad === 'raydium' || jt.graduatedPool) {
          launchpad = 'raydium';
        } else if (jt.launchpad === 'met-dbc' || jt.launchpad === 'meteora') {
          launchpad = 'meteora';
        } else {
          launchpad = 'pump.fun';
        }

        const catalyst =
          traders1h > 100
            ? `${traders1h} unique traders in the last hour driving aggressive accumulation on ${launchpad}.`
            : priceChange1h > 50
            ? `Price surging +${priceChange1h}% in the past hour as social momentum accelerates.`
            : `Surging social interest with active liquidity and organic community volume.`;

        const socialUrl =
          prof?.links?.find(
            (l) => l.type === 'twitter' || l.url?.includes('x.com') || l.url?.includes('twitter.com')
          )?.url ||
          prof?.links?.find(
            (l) => l.type === 'tiktok' || l.url?.includes('tiktok.com')
          )?.url ||
          prof?.url ||
          `https://dexscreener.com/solana/${jt.id}`;

        const trendItem: TrendItem = {
          id: `trend-live-${jt.id}`,
          title: `"${name}" ($${symbol}) Breaks Out Across ${source === 'tiktok' ? 'TikTok' : source === 'x' ? '𝕏' : 'Culture'} Feeds`,
          source,
          category,
          viralityScore,
          velocity,
          metrics: {
            impressions: `${Math.max(12, Math.round(volume24h / 1000))}K views`,
            postCount: `${Math.max(80, traders1h * 3)} mentions`,
            growthPct: Math.max(120, Math.abs(priceChange1h * 3)),
            hashtags: [`#${symbol}`, `#${name.replace(/\s+/g, '')}`, '#SolanaMeme'],
          },
          summary: desc,
          catalyst,
          publishedAt: jt.createdAt || new Date().toISOString(),
          timeAgo,
          sourceUrl: socialUrl,
          associatedToken: {
            mint: jt.id,
            symbol,
            name,
            avatarUrl:
              prof?.icon ||
              jt.icon ||
              `https://cdn.dexscreener.com/token-images/og/solana/${jt.id}`,
            priceUsd: Number(jt.usdPrice || 0.0001),
            priceChange24h,
            priceChange1h,
            marketCapUsd: mcap || 50000,
            volume24hUsd: volume24h,
            launchpad,
            relationship: `Live trending token tracking real-time viral volume on Solana`,
          },
        };

        liveTrendItems.push(trendItem);
      }

      // 3. Deduplicate and merge live items with recent curated seed items
      const existingMints = new Set<string>();
      const existingSymbols = new Set<string>();
      const combined: TrendItem[] = [];

      // Add live items first
      for (const item of liveTrendItems) {
        const mint = item.associatedToken.mint.toLowerCase();
        const sym = item.associatedToken.symbol.toLowerCase();
        if (!existingMints.has(mint) && !existingSymbols.has(sym)) {
          existingMints.add(mint);
          existingSymbols.add(sym);
          combined.push(item);
        }
      }

      // Add fresh curated seed items to fill variety across all categories/sources
      for (const item of INITIAL_TREND_ITEMS) {
        const mint = item.associatedToken.mint.toLowerCase();
        const sym = item.associatedToken.symbol.toLowerCase();
        if (!existingMints.has(mint) && !existingSymbols.has(sym)) {
          existingMints.add(mint);
          existingSymbols.add(sym);
          combined.push(item);
        }
      }

      // Sort by virality score descending
      combined.sort((a, b) => b.viralityScore - a.viralityScore);

      this.cachedTrends = combined;
      this.lastFetchedAt = Date.now();
    } catch (error) {
      console.error('[TRENDS_SERVICE_REFRESH_ERROR]', error);
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Applies source, category, and search filters, and computes summary statistics
   */
  private static applyFiltersAndStats(
    items: TrendItem[],
    params?: { source?: string; category?: string; search?: string }
  ): { trends: TrendItem[]; stats: TrendStats } {
    let filtered = [...items];

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

    const stats = this.computeStats(items);

    return {
      trends: filtered,
      stats,
    };
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
