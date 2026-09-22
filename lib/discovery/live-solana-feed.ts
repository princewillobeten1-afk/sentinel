import { DiscoveryToken, DiscoveryFilter, TimeWindow } from './types';
import { calculateTrendingScore } from './trending-engine';
import { filterDiscoveryTokens } from './service';
import {
  fetchJupiterFeed,
  mapJupiterToken,
  formatAge,
  collapseDuplicateLaunches,
  type JupiterFeed,
  type JupiterToken,
} from './jupiter-feed';
import { getLifecycleDiscoveryTokens } from './lifecycle-feed';

/**
 * The live token source behind every Discover column.
 *
 * ## What changed and why
 *
 * This previously read DexScreener's `token-profiles/latest` — a curated list
 * of *promoted* tokens, which sampled at 9–22 minutes old. A "new launches"
 * column cannot be built on a promotions list.
 *
 * More seriously, the mapping invented most of what it returned. Holder counts,
 * dev holdings, top-10 concentration, insider percentage, sniper percentage,
 * bundler percentage, risk score, AI signal score and smart-money flow were all
 * computed from the token's **index in the response array**:
 *
 *     holdersCount: Math.floor(65 + rankIdx * 28)
 *     riskScore:    Math.min(98, Math.max(68, 95 - (rankIdx % 20)))
 *
 * Every token also claimed `isMintRenounced: true` and `isFreezeDisabled: true`
 * — a safety assertion about tokens nothing had checked. And when fewer than 20
 * tokens came back, mock tokens were merged in to pad the list.
 *
 * All of that is gone. `jupiter-feed.ts` maps only measured values and omits
 * the rest, so the UI renders `—` where nothing is known.
 *
 * ## Caching
 *
 * Each feed is cached separately with its own TTL, because the columns refresh
 * at different rates: new launches want ~5s, trending tolerates 15s, and the
 * organic-score list barely moves. Ages are recomputed on every read so a
 * cached token still counts up in real time.
 */

interface FeedCache {
  raw: JupiterToken[];
  mapped: DiscoveryToken[];
  fetchedAt: number;
  /** Last error, retained so a failing feed can say why rather than look empty. */
  error?: string;
}

const caches = new Map<JupiterFeed, FeedCache>();

/** Per-feed freshness, matched to how fast each list actually turns over. */
const FEED_TTL_MS: Record<JupiterFeed, number> = {
  recent: 4_000,
  toptrending: 12_000,
  toporganicscore: 25_000,
  toptraded: 12_000,
};

/** Recomputes age against the wall clock so cached rows keep counting. */
function withCurrentAge(token: DiscoveryToken, launchedAtMs: number | null): DiscoveryToken {
  if (launchedAtMs === null) return token;
  const ageMinutes = Math.max(0.05, (Date.now() - launchedAtMs) / 60_000);
  return { ...token, ageMinutes, ageFormatted: formatAge(ageMinutes) };
}

const launchMs = new WeakMap<JupiterToken, number | null>();

async function loadFeed(feed: JupiterFeed, limit = 30): Promise<FeedCache> {
  const cached = caches.get(feed);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < FEED_TTL_MS[feed]) return cached;

  try {
    const raw = await fetchJupiterFeed(feed, { limit });
    const mapped = raw.map((token) => {
      const dt = mapJupiterToken(token);
      launchMs.set(token, dt.ageMinutes ? Date.now() - dt.ageMinutes * 60_000 : null);
      return dt;
    });
    const next: FeedCache = { raw, mapped, fetchedAt: now };
    caches.set(feed, next);
    return next;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Serve the previous snapshot rather than nothing — but keep the error so
    // the caller can say the data is stale. Never substitute invented tokens.
    if (cached) {
      const stale: FeedCache = { ...cached, error: message };
      caches.set(feed, stale);
      return stale;
    }
    const empty: FeedCache = { raw: [], mapped: [], fetchedAt: now, error: message };
    caches.set(feed, empty);
    return empty;
  }
}

/**
 * Fresh launches for New Pairs. Lifecycle columns have their own evidence feed.
 */
async function recentTokens(): Promise<{ token: DiscoveryToken; raw: JupiterToken }[]> {
  const { raw, mapped } = await loadFeed('recent');
  return mapped.map((token, index) => ({
    token: withCurrentAge(token, launchMs.get(raw[index]) ?? null),
    raw: raw[index],
  }));
}

/** Broad pool for the sections that rank rather than partition. */
async function rankedPool(feed: JupiterFeed): Promise<DiscoveryToken[]> {
  const { raw, mapped } = await loadFeed(feed, 30);
  return mapped.map((token, index) => withCurrentAge(token, launchMs.get(raw[index]) ?? null));
}

/**
 * Every live Solana token currently known, across feeds.
 *
 * Kept for callers that want the unpartitioned set; sections below prefer the
 * narrower feed that actually answers their question.
 */
export async function fetchLiveSolanaTokens(): Promise<DiscoveryToken[]> {
  const [recent, trending] = await Promise.all([recentTokens(), rankedPool('toptrending')]);
  const seen = new Set<string>();
  const all: DiscoveryToken[] = [];
  for (const entry of [...recent.map((r) => r.token), ...trending]) {
    if (seen.has(entry.mint)) continue;
    seen.add(entry.mint);
    all.push(entry);
  }
  return all;
}

/**
 * Resolves one Discover section to real tokens.
 *
 * New Pairs uses /recent; Final Stretch and Migrated use the on-chain lifecycle
 * engine plus by-mint metadata so lifecycle membership never depends on listing age.
 */
export async function getLiveDiscoveryTokens(filter?: Partial<DiscoveryFilter>): Promise<DiscoveryToken[]> {
  const section = filter?.section;
  const window: TimeWindow = filter?.timeWindow || '15m';

  const apply = (tokens: DiscoveryToken[]) => filterDiscoveryTokens(tokens, filter);

  switch (section) {
    case 'new': {
      // Collapsed before sorting: an unfiltered response is routinely two
      // thirds noise — measured at 30 rows carrying 19 distinct names, one
      // repeated ten times, with 12 rows holding no liquidity at all.
      const rows = await recentTokens();
      const collapsed = collapseDuplicateLaunches(rows.map((r) => r.token), {
        includeZeroLiquidity: filter?.includeZeroLiquidity,
      });
      return apply(collapsed).sort((a, b) => a.ageMinutes - b.ageMinutes);
    }

    case 'migrating':
    case 'graduated':
      // Not partitions of /recent: old launches can migrate just now, while
      // a brand-new Raydium pool may never have had a bonding curve at all.
      return apply(await getLifecycleDiscoveryTokens(section));

    case 'hot': {
      // Jupiter's own organic-score label, which is a published measurement of
      // genuine versus wash activity — the platform's whole premise.
      const pool = await rankedPool('toporganicscore');
      return apply(pool);
    }

    case 'trending': {
      const pool = await rankedPool('toptrending');
      return apply(pool).sort((a, b) => {
        const scoreA = calculateTrendingScore(a, window).trendingRankScore;
        const scoreB = calculateTrendingScore(b, window).trendingRankScore;
        return scoreB - scoreA;
      });
    }

    case 'volume': {
      const pool = await rankedPool('toptraded');
      return apply(pool).sort((a, b) => parseFloat(b.volume24hUsd) - parseFloat(a.volume24hUsd));
    }

    case 'liquidity': {
      const pool = await rankedPool('toptraded');
      return apply(pool).sort((a, b) => parseFloat(b.liquidityUsd) - parseFloat(a.liquidityUsd));
    }

    case 'momentum': {
      const pool = await rankedPool('toptrending');
      return apply(pool).sort((a, b) => b.priceChange1h - a.priceChange1h);
    }

    case 'top-gainers': {
      const pool = await rankedPool('toptraded');
      return apply(pool).sort((a, b) => b.priceChange24h - a.priceChange24h);
    }

    case 'top-losers': {
      const pool = await rankedPool('toptraded');
      return apply(pool).sort((a, b) => a.priceChange24h - b.priceChange24h);
    }

    case 'revived': {
      const pool = await rankedPool('toptrending');
      return apply(pool)
        .filter((token) => token.ageMinutes >= 60 && token.priceChange24h > 0)
        .sort((a, b) => b.priceChange24h - a.priceChange24h);
    }

    case 'legacy': {
      const pool = await rankedPool('toptrending');
      return apply(pool)
        .filter((token) => token.ageMinutes >= 24 * 60)
        .sort((a, b) => parseFloat(b.marketCapUsd) - parseFloat(a.marketCapUsd));
    }

    case 'similar': {
      const referenceMint = filter?.similarTo;
      if (!referenceMint) return [];
      const pool = await fetchLiveSolanaTokens();
      const reference = pool.find((token) => token.mint === referenceMint);
      if (!reference) return [];
      const referenceCap = parseFloat(reference.marketCapUsd);
      return apply(pool)
        .filter((token) => token.mint !== referenceMint && token.source === reference.source)
        .sort((a, b) => Math.abs(parseFloat(a.marketCapUsd) - referenceCap) - Math.abs(parseFloat(b.marketCapUsd) - referenceCap));
    }

    default: {
      // smart-money, ai-picks, watchlist, movers, personalized — no live source
      // ranks these today. Return the broad pool unsorted rather than inventing
      // a score to sort by; the column shows real tokens and an honest order.
      const pool = await fetchLiveSolanaTokens();
      return apply(pool);
    }
  }
}

/** Diagnostics for the feed's freshness, surfaced by the discovery routes. */
export function getFeedHealth(): Record<string, { ageMs: number; count: number; error?: string }> {
  const out: Record<string, { ageMs: number; count: number; error?: string }> = {};
  const now = Date.now();
  for (const [feed, cache] of caches) {
    out[feed] = { ageMs: now - cache.fetchedAt, count: cache.mapped.length, error: cache.error };
  }
  return out;
}
