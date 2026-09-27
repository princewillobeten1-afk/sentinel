import 'server-only';

import { CURVE_FRESHNESS_MS, FINAL_STRETCH_LIMIT, MIGRATED_LIMIT, closestToMigrating, finalStretch, getLifecycle, migrated } from '@/lib/market/lifecycle/lifecycle-engine';
import { finalStretchThreshold, type TokenLifecycle } from '@/lib/market/lifecycle/types';
import { fetchJupiterTokensByMint, fetchJupiterFeed, hasGraduated, mapJupiterToken, type JupiterToken } from './jupiter-feed';
import { fetchDexPairSnapshots, finite, type DexPair } from './dexscreener-market';
import type { DiscoveryToken } from './types';

type Section = 'migrating' | 'graduated';
// Live card patches update fast fields. This lookup decorates verified lifecycle
// records; it must not erase a whole column during a brief Jupiter outage.
const METADATA_TTL_MS = 10_000;
const METADATA_RETENTION_MS = 60 * 60_000;
const MAX_CACHED_MINTS = 2_000;
type CachedMetadata = { token: JupiterToken; source: 'jupiter'; at: number }
  | { token: DexPair; source: 'dexscreener'; at: number };
const metadata = new Map<string, CachedMetadata>();
const pending = new Map<string, Promise<void>>();

async function loadMetadata(mints: string[]): Promise<void> {
  const missing = mints.filter((mint) => Date.now() - (metadata.get(mint)?.at ?? 0) >= METADATA_TTL_MS).sort();
  if (!missing.length) return;
  const key = missing.join(',');
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const task = (async () => {
    const rows = await fetchJupiterTokensByMint(missing);
    const wanted = new Set(missing);
    const supplied = new Set<string>();
    for (const token of rows) {
      if (wanted.has(token.id)) {
        metadata.set(token.id, { token, source: 'jupiter', at: Date.now() });
        supplied.add(token.id);
      }
    }
    // Jupiter's public endpoint can be quota-limited for hours. DexScreener
    // decorates only the lifecycle mints it knows; it never decides membership.
    const fallback = await fetchDexPairSnapshots(missing.filter(mint => !supplied.has(mint)));
    for (const [mint, pair] of fallback) {
      metadata.set(mint, { token: pair, source: 'dexscreener', at: Date.now() });
    }
    for (const [mint, cached] of metadata) {
      if (Date.now() - cached.at > METADATA_RETENTION_MS) metadata.delete(mint);
    }
    while (metadata.size > MAX_CACHED_MINTS) metadata.delete(metadata.keys().next().value!);
  })();
  pending.set(key, task);
  try { await task; } finally { pending.delete(key); }
}

import { resolveLaunchpad } from '@/lib/market/lifecycle/launchpads';

/** Identity and market values from the matched DexScreener BASE pair. Missing
 * token age, creator, audit and holder facts stay unknown. */
export function mapDexLifecycleToken(mint: string, pair: DexPair, observedAt: number): DiscoveryToken {
  const token = mapJupiterToken({ id: mint, name: pair.baseToken?.name,
    symbol: pair.baseToken?.symbol, icon: pair.info?.imageUrl });
  const price = finite(pair.priceUsd);
  const cap = finite(pair.marketCap ?? pair.fdv);
  const liq = finite(pair.liquidity?.usd);
  const buys5m = finite(pair.txns?.m5?.buys);
  const sells5m = finite(pair.txns?.m5?.sells);
  const buys1h = finite(pair.txns?.h1?.buys);
  const sells1h = finite(pair.txns?.h1?.sells);
  const buys24h = finite(pair.txns?.h24?.buys);
  const sells24h = finite(pair.txns?.h24?.sells);
  const evidence = { status: 'measured' as const, source: 'dexscreener-token-rest',
    observedAt: new Date(observedAt).toISOString(),
    expiresAt: new Date(observedAt + METADATA_TTL_MS).toISOString() };
  return {
    ...token,
    ageMinutes: Number.NaN, ageFormatted: '—', isNewToken: false,
    // A pool's creation time is not necessarily the token's launch time.
    discoveryScore: { ...token.discoveryScore, confidence: 0,
      explanations: ['Launch age and ownership evidence are not available from this source.'] },
    liquidityPoolAddress: pair.pairAddress,
    priceUsd: price === undefined ? '' : String(price),
    marketCapUsd: cap === undefined ? '' : String(cap),
    liquidityUsd: liq === undefined ? '' : String(liq),
    volume5mUsd: finite(pair.volume?.m5) === undefined ? '' : String(pair.volume!.m5),
    volume1hUsd: finite(pair.volume?.h1) === undefined ? '' : String(pair.volume!.h1),
    volume24hUsd: finite(pair.volume?.h24) === undefined ? '' : String(pair.volume!.h24),
    priceChange5m: finite(pair.priceChange?.m5) ?? Number.NaN,
    priceChange1h: finite(pair.priceChange?.h1) ?? Number.NaN,
    priceChange24h: finite(pair.priceChange?.h24) ?? Number.NaN,
    buysCount: buys1h ?? Number.NaN, sellsCount: sells1h ?? Number.NaN,
    buysCount5m: buys5m, sellsCount5m: sells5m,
    buysCount1h: buys1h, sellsCount1h: sells1h,
    buysCount24h: buys24h, sellsCount24h: sells24h,
    txCount5m: buys5m !== undefined && sells5m !== undefined ? buys5m + sells5m : undefined,
    txCount1h: buys1h !== undefined && sells1h !== undefined ? buys1h + sells1h : Number.NaN,
    txCount24h: buys24h !== undefined && sells24h !== undefined ? buys24h + sells24h : undefined,
    marketEvidence: price !== undefined || cap !== undefined || liq !== undefined ? evidence : undefined,
    activityEvidence: buys1h !== undefined || sells1h !== undefined || finite(pair.volume?.h1) !== undefined
      ? evidence : undefined,
    websiteUrl: pair.info?.websites?.find(site => typeof site.url === 'string')?.url,
    twitterUrl: pair.info?.socials?.find(site => site.type === 'twitter')?.url,
    telegramUrl: pair.info?.socials?.find(site => site.type === 'telegram')?.url,
  };
}

/** The engine decides membership; metadata can decorate it, never classify it. */
export function applyLifecycleToToken(token: DiscoveryToken, record: TokenLifecycle): DiscoveryToken {
  const padConfig = record.launchpadInfo ?? resolveLaunchpad(record.launchpad);

  if (record.state === 'MIGRATED' && record.migration) {
    const proof = record.migration;
    const originLaunchpad = proof.originLaunchpad ?? record.launchpad;
    const originConfig = resolveLaunchpad(originLaunchpad);

    return {
      ...token,
      launchpad: originLaunchpad,
      launchpadInfo: originConfig,
      originLaunchpad: originConfig.name,
      lpHandling: proof.lpHandling || originConfig.lpHandling,
      graduationTarget: originConfig.graduationThreshold,
      bondingStatus: 'graduated', lifecycleState: 'migrated',
      bondingCurveProgress: undefined, migrationProgress: 100,
      migrationSignature: proof.signature, migratedAt: proof.migratedAt,
      migratedPool: proof.poolAddress, liquidityPoolAddress: proof.poolAddress, migratedDex: proof.dex,
      lifecycleEvidence: {
        status: 'measured', source: 'helius-confirmed-migration',
        observedAt: new Date(proof.migratedAt).toISOString(),
      },
    };
  }
  const curve = record.curve!;
  const progress = curve.progress * 100;
  const targetUsd = padConfig?.graduationTargetUsd || 69000;
  const estimatedMcap = Math.round((progress / 100) * targetUsd);
  const estimatedPrice = (estimatedMcap / 1_000_000_000).toFixed(8);
  const realSol = Number(curve.realSolReserves || 24_000_000_000n) / 1e9;
  const estimatedLiquidity = Math.round(realSol * 150);

  const priceUsd = token.priceUsd && Number(token.priceUsd) > 0 ? token.priceUsd : estimatedPrice;
  const marketCapUsd = token.marketCapUsd && Number(token.marketCapUsd) > 0 ? token.marketCapUsd : String(estimatedMcap);
  const liquidityUsd = token.liquidityUsd && Number(token.liquidityUsd) > 0 ? token.liquidityUsd : String(estimatedLiquidity);

  const marketEvidence = token.marketEvidence && token.marketEvidence.status === 'measured'
    ? token.marketEvidence
    : {
        status: Date.now() - curve.readAt <= CURVE_FRESHNESS_MS ? 'measured' as const : 'stale' as const,
        source: 'solana-bonding-curve',
        observedAt: new Date(curve.readAt).toISOString(),
        expiresAt: new Date(curve.readAt + CURVE_FRESHNESS_MS).toISOString(),
      };

  return {
    ...token,
    priceUsd,
    marketCapUsd,
    liquidityUsd,
    marketEvidence,
    launchpad: record.launchpad,
    launchpadInfo: padConfig,
    originLaunchpad: padConfig.name,
    graduationTarget: padConfig.graduationThreshold,
    bondingStatus: 'bonding', lifecycleState: 'final_stretch',
    bondingCurveProgress: progress, migrationProgress: progress,
    migrationSignature: undefined, migratedAt: undefined, migratedPool: undefined,
    migratedDex: padConfig.destinationDex,
    lifecycleEvidence: {
      status: Date.now() - curve.readAt <= CURVE_FRESHNESS_MS ? 'measured' : 'stale',
      source: 'solana-bonding-curve',
      observedAt: new Date(curve.readAt).toISOString(),
      expiresAt: new Date(curve.readAt + CURVE_FRESHNESS_MS).toISOString(),
      ...(Date.now() - curve.readAt > CURVE_FRESHNESS_MS
        ? { reason: 'The last verified bonding-curve reading is delayed.' } : {}),
    },
  };
}

export async function getLifecycleDiscoveryTokens(section: Section): Promise<DiscoveryToken[]> {
  const select = section === 'migrating'
    ? () => {
        const queue = finalStretch();
        const seen = new Set(queue.map((r) => r.mint));
        const combined = [...queue];
        if (combined.length < FINAL_STRETCH_LIMIT) {
          for (const near of closestToMigrating(finalStretchThreshold())) {
            if (!seen.has(near.mint)) {
              seen.add(near.mint);
              combined.push(near);
              if (combined.length >= FINAL_STRETCH_LIMIT) break;
            }
          }
        }
        if (combined.length < FINAL_STRETCH_LIMIT) {
          for (const near70 of closestToMigrating(0.70)) {
            if (!seen.has(near70.mint)) {
              seen.add(near70.mint);
              combined.push(near70);
              if (combined.length >= FINAL_STRETCH_LIMIT) break;
            }
          }
        }
        return combined;
      }
    : migrated;
  const records = select().slice(0, section === 'migrating' ? FINAL_STRETCH_LIMIT : MIGRATED_LIMIT);
  if (!records.length) {
    if (section === 'graduated') {
      try {
        const trending = await fetchJupiterFeed('toptrending', { limit: 50 });
        const graduatedTokens = trending.filter(hasGraduated);
        if (graduatedTokens.length) {
          return graduatedTokens.slice(0, MIGRATED_LIMIT).map(t => {
            const mapped = mapJupiterToken(t);
            const migratedAt = typeof t.graduatedAt === 'string'
              ? (Date.parse(t.graduatedAt) || Date.now() - 3600_000)
              : typeof t.graduatedAt === 'number'
                ? t.graduatedAt
                : Date.now() - 3600_000;
            return {
              ...mapped,
              bondingStatus: 'graduated',
              lifecycleState: 'migrated',
              migrationProgress: 100,
              migratedPool: t.graduatedPool || mapped.liquidityPoolAddress,
              migratedAt,
              lifecycleEvidence: {
                status: 'measured',
                source: 'jupiter-confirmed-migration',
                observedAt: new Date().toISOString(),
              },
            };
          });
        }
      } catch {
        // Fall through to empty if upstream request fails
      }
    } else if (section === 'migrating') {
      try {
        // For Final Stretch, check high-volume trending & traded tokens that are genuinely near graduation.
        // NEVER query 'recent' because 'recent' consists of brand-new 0-2 min launches ($5k mcap).
        // A token enters Final Stretch ONLY if its bonding curve progress is >= 80% (mcap >= ~$55.2k).
        const [trending, traded] = await Promise.all([
          fetchJupiterFeed('toptrending', { limit: 50 }).catch(() => []),
          fetchJupiterFeed('toptraded', { limit: 50 }).catch(() => []),
        ]);
        const candidates = [...trending, ...traded];
        const minThresholdPct = finalStretchThreshold() * 100;
        const seenMints = new Set<string>();
        const finalStretchTokens = candidates.filter((t) => {
          if (!t.id || seenMints.has(t.id)) return false;
          seenMints.add(t.id);
          if (hasGraduated(t) || t.graduatedPool || t.graduatedAt) return false;
          const isBonding = t.launchpad === 'pump.fun' || t.id.endsWith('pump');
          if (!isBonding) return false;
          const mcap = Number(t.mcap) || 0;
          // pump.fun graduation target is ~$69,000. 80% progress is ~$55,200.
          const progress = (mcap / 69000) * 100;
          return progress >= minThresholdPct && progress < 100;
        });

        if (finalStretchTokens.length) {
          const sorted = finalStretchTokens.sort((a, b) => (Number(b.mcap) || 0) - (Number(a.mcap) || 0));
          return sorted.slice(0, FINAL_STRETCH_LIMIT).map((t) => {
            const mapped = mapJupiterToken(t);
            const mcap = Number(t.mcap) || 55000;
            const progress = Math.min(99, Math.max(minThresholdPct, Math.round((mcap / 69000) * 100)));
            return {
              ...mapped,
              bondingStatus: 'bonding',
              lifecycleState: 'final_stretch',
              bondingCurveProgress: progress,
              migrationProgress: progress,
              lifecycleEvidence: {
                status: 'measured',
                source: 'jupiter-bonding-curve',
                observedAt: new Date().toISOString(),
              },
            };
          });
        }
      } catch {
        // Fall through to empty if upstream request fails
      }
    }
    return [];
  }
  await loadMetadata(records.map((record) => record.mint));
  // A curve can complete or migrate while the metadata request is in flight.
  // Re-check state so completed or migrated curves leave Final Stretch.
  const tokens: DiscoveryToken[] = [];
  for (const record of records) {
    const cached = metadata.get(record.mint);
    const current = getLifecycle(record.mint);
    if (!current) continue;
    if (section === 'migrating') {
      if (current.state === 'MIGRATED' || current.state === 'MIGRATING' || current.curve?.complete) continue;
      if ((current.curve?.progress ?? 0) < 0.70) continue;
    } else if (section === 'graduated') {
      if (current.state !== 'MIGRATED') continue;
    }
    // A metadata index lag must not remove a confirmed lifecycle row. Identity
    // falls back to the mint; every unmeasured market field stays unknown.
    const token = cached?.source === 'jupiter' ? mapJupiterToken(cached.token)
      : cached?.source === 'dexscreener' ? mapDexLifecycleToken(record.mint, cached.token, cached.at)
        : mapJupiterToken({ id: record.mint, launchpad: record.launchpad });
    if (!cached) {
      token.ageMinutes = Number.NaN;
      token.ageFormatted = '—';
      token.marketEvidence = { status: 'unavailable', source: 'lifecycle-metadata',
        observedAt: new Date().toISOString(), reason: 'Token metadata has not been indexed yet.' };
    }
    // Mapping is pure presentation, not a new provider observation. Preserve
    // the actual observation time for every fact carried by this payload.
    const stale = Boolean(cached && Date.now() - cached.at >= METADATA_TTL_MS);
    for (const group of ['marketEvidence', 'activityEvidence', 'ownershipEvidence', 'securityEvidence', 'creatorEvidence'] as const) {
      const evidence = token[group];
      if (evidence && cached) token[group] = { ...evidence, observedAt: new Date(cached.at).toISOString(),
        ...(stale ? { status: 'stale', reason: 'Metadata refresh is delayed.' } : {}) };
    }
    tokens.push(applyLifecycleToToken(token, current));
  }
  return tokens;
}

export function __resetLifecycleFeed(): void {
  metadata.clear();
  pending.clear();
}
