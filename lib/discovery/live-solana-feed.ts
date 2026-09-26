import { DiscoveryToken, DiscoveryFilter, TimeWindow } from './types';
import { calculateTrendingScore } from './trending-engine';
import { filterDiscoveryTokens } from './service';
import {
  fetchJupiterFeed,
  mapJupiterToken,
  formatAge,
  collapseDuplicateLaunches,
  hasGraduated,
  type JupiterFeed,
  type JupiterToken,
} from './jupiter-feed';
import { getLifecycleDiscoveryTokens } from './lifecycle-feed';
import { getLifecycle } from '@/lib/market/lifecycle/lifecycle-engine';
import { hydrateTokenCards, getTokenCardPatch, updateTokenCard } from '@/lib/market/live/card-cache';
import { mergeTokenCardSnapshot } from './card-snapshot';
import { getAudit, isAuditPending, queueAudit } from '@/lib/market/enrichment/audit-worker';
import { queueSecurityTarget } from '@/lib/market/enrichment/security-worker';
import { getWatchedMints } from '@/lib/market/live/stream-demand';
import { calculateRugRisk } from '@/lib/market/enrichment/rug-risk';

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

export function __resetLiveSolanaFeedForTests(): void { caches.clear(); }

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
 * Enriches discovery tokens with cached ownership audits, live card patches,
 * and queues un-audited tokens in the background.
 */
export async function enrichTokensWithAudits(tokens: DiscoveryToken[], section?: DiscoveryFilter['section']): Promise<DiscoveryToken[]> {
  if (!tokens || tokens.length === 0) return tokens;
  const mints = tokens.map((t) => t.mint).filter(Boolean);
  if (mints.length === 0) return tokens;

  try {
    await hydrateTokenCards(mints);
  } catch {
    // Hydration is best-effort
  }

  const unAuditedMints: string[] = [];

  const enriched = tokens.map((token) => {
    let t = token;
    const patch = getTokenCardPatch(token.mint);
    if (token.devAddress && !patch?.changedFields.devAddress) {
      // Security checks can use the creator already measured by Jupiter;
      // repeating Birdeye Token Security for every visible card competes with
      // Holder Profile for the same provider budget.
      updateTokenCard(token.mint, { devAddress: token.devAddress },
        token.creatorEvidence?.source ?? 'jupiter-token-api');
    }
    if (patch) {
      t = mergeTokenCardSnapshot(t, patch);
    }

    const audit = getAudit(token.mint);
    if (audit) {
      const observedAt = new Date(audit.fetchedAt).toISOString();
      const ownershipSource = audit.source ?? 'birdeye-holder-profile';
      const completeProfile = [
        audit.top10Pct, audit.totalHolders, audit.snipersPct,
        audit.insidersPct, audit.bundlersPct, audit.devPct,
        audit.proTraders, audit.kols,
      ].every((v) => v !== null);

      t = {
        ...t,
        top10HoldingsPct: t.top10HoldingsPct ?? audit.top10Pct ?? undefined,
        holdersCount: t.holdersCount ?? audit.totalHolders ?? undefined,
        sniperPercentage: t.sniperPercentage ?? audit.snipersPct ?? undefined,
        insiderHoldingsPct: t.insiderHoldingsPct ?? audit.insidersPct ?? undefined,
        bundlerPercentage: t.bundlerPercentage ?? audit.bundlersPct ?? undefined,
        devHoldingsPct: t.devHoldingsPct ?? audit.devPct ?? undefined,
        proTradersCount: t.proTradersCount ?? audit.proTraders ?? undefined,
        kolsCount: t.kolsCount ?? audit.kols ?? undefined,
        auditPending: false,
        ownershipEvidence: t.ownershipEvidence ?? {
          status: 'measured',
          source: ownershipSource,
          observedAt,
          reason: completeProfile ? undefined : 'Some ownership classifications were not supplied by this provider; missing values remain unavailable.',
        },
      };

      if (!t.rugRisk || t.rugRisk.score === 0) {
        const rugRisk = calculateRugRisk({
          top10Pct: t.top10HoldingsPct,
          devPct: t.devHoldingsPct,
          snipersPct: t.sniperPercentage,
          insidersPct: t.insiderHoldingsPct,
          bundlersPct: t.bundlerPercentage,
          mintAuthorityRevoked: t.isMintRenounced,
          freezeAuthorityRevoked: t.isFreezeDisabled,
          liquidityLocked: t.isLiquidityLocked,
        });
        if (rugRisk) {
          t.rugRisk = rugRisk;
        }
      }
    } else {
      if (isAuditPending(token.mint)) {
        t = {
          ...t,
          auditPending: true,
          ownershipEvidence: t.ownershipEvidence ?? {
            status: 'loading',
            source: 'birdeye-holder-profile',
            observedAt: new Date().toISOString(),
          },
        };
      } else {
        unAuditedMints.push(token.mint);
      }
    }

    return t;
  });

  if (getWatchedMints().length === 0 && unAuditedMints.length > 0) {
    try {
      queueAudit(unAuditedMints.slice(0, 6));
    } catch {
      // Best-effort audit queuing
    }
  }

  // A browser normally supplies its exact visible set over WebSocket. If that
  // transport is unavailable, keep the first rows of the three terminal
  // columns functional through a bounded REST fallback.
  if (getWatchedMints().length === 0 && (section === 'new' || section === 'migrating' || section === 'graduated')) {
    for (const token of tokens.slice(0, 2)) queueSecurityTarget(token.mint);
  }

  return enriched;
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

  let tokens: DiscoveryToken[];

  switch (section) {
    case 'new': {
      // Collapsed before sorting: an unfiltered response is routinely two
      // thirds noise — measured at 30 rows carrying 19 distinct names, one
      // repeated ten times, with 12 rows holding no liquidity at all.
      const rows = (await recentTokens()).filter(({ token, raw }) => {
        const state = getLifecycle(token.mint)?.state;
        // /recent can retain a just-graduated mint. The verified lifecycle
        // engine and Jupiter's own graduation fact both outrank listing age.
        return (!state || state === 'NEW_PAIR') && !hasGraduated(raw);
      });
      const collapsed = collapseDuplicateLaunches(rows.map((r) => r.token), {
        includeZeroLiquidity: filter?.includeZeroLiquidity,
      });
      tokens = apply(collapsed).sort((a, b) => a.ageMinutes - b.ageMinutes);
      break;
    }

    case 'migrating':
    case 'graduated':
      // Not partitions of /recent: old launches can migrate just now, while
      // a brand-new Raydium pool may never have had a bonding curve at all.
      tokens = apply(await getLifecycleDiscoveryTokens(section));
      break;

    case 'hot': {
      // Jupiter's own organic-score label, which is a published measurement of
      // genuine versus wash activity — the platform's whole premise.
      const pool = await rankedPool('toporganicscore');
      tokens = apply(pool);
      break;
    }

    case 'trending': {
      const pool = await rankedPool('toptrending');
      tokens = apply(pool).sort((a, b) => {
        const scoreA = calculateTrendingScore(a, window).trendingRankScore;
        const scoreB = calculateTrendingScore(b, window).trendingRankScore;
        return scoreB - scoreA;
      });
      break;
    }

    case 'volume': {
      const pool = await rankedPool('toptraded');
      tokens = apply(pool).sort((a, b) => parseFloat(b.volume24hUsd) - parseFloat(a.volume24hUsd));
      break;
    }

    case 'liquidity': {
      const pool = await rankedPool('toptraded');
      tokens = apply(pool).sort((a, b) => parseFloat(b.liquidityUsd) - parseFloat(a.liquidityUsd));
      break;
    }

    case 'momentum': {
      const pool = await rankedPool('toptrending');
      tokens = apply(pool).sort((a, b) => b.priceChange1h - a.priceChange1h);
      break;
    }

    case 'top-gainers': {
      const pool = await rankedPool('toptraded');
      tokens = apply(pool).sort((a, b) => b.priceChange24h - a.priceChange24h);
      break;
    }

    case 'top-losers': {
      const pool = await rankedPool('toptraded');
      tokens = apply(pool).sort((a, b) => a.priceChange24h - b.priceChange24h);
      break;
    }

    case 'revived': {
      const pool = await rankedPool('toptrending');
      tokens = apply(pool)
        .filter((token) => token.ageMinutes >= 60 && token.priceChange24h > 0)
        .sort((a, b) => b.priceChange24h - a.priceChange24h);
      break;
    }

    case 'legacy': {
      const pool = await rankedPool('toptrending');
      tokens = apply(pool)
        .filter((token) => token.ageMinutes >= 24 * 60)
        .sort((a, b) => parseFloat(b.marketCapUsd) - parseFloat(a.marketCapUsd));
      break;
    }

    case 'similar': {
      const referenceMint = filter?.similarTo;
      if (!referenceMint) return [];
      const pool = await fetchLiveSolanaTokens();
      const reference = pool.find((token) => token.mint === referenceMint);
      if (!reference) return [];
      const referenceCap = parseFloat(reference.marketCapUsd);
      tokens = apply(pool)
        .filter((token) => token.mint !== referenceMint && token.source === reference.source)
        .sort((a, b) => Math.abs(parseFloat(a.marketCapUsd) - referenceCap) - Math.abs(parseFloat(b.marketCapUsd) - referenceCap));
      break;
    }

    default: {
      // smart-money, ai-picks, watchlist, movers, personalized — no live source
      // ranks these today. Return the broad pool unsorted rather than inventing
      // a score to sort by; the column shows real tokens and an honest order.
      const pool = await fetchLiveSolanaTokens();
      tokens = apply(pool);
      break;
    }
  }

  return enrichTokensWithAudits(tokens, section);
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
