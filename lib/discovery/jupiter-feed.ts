import type { DiscoveryToken } from './types';
import { calculateDiscoveryScore } from './score-engine';
import { sanitizeTokenName } from './sanitize-name';
import { isSupportedLaunchpad, resolveLaunchpad } from '@/lib/market/lifecycle/launchpads';

/**
 * Live Solana token feeds from Jupiter's public token API.
 *
 * ## Why this replaced the previous source
 *
 * Discover used DexScreener's `token-profiles/latest` list, which is a curated
 * set of *promoted* tokens, not a launch firehose — sampled during development
 * it returned tokens aged 9 to 22 minutes. Axiom-style "a new token appears the
 * moment it launches" cannot be built on that.
 *
 * Jupiter's `/tokens/v2/recent` returns 30 tokens aged **0–2 minutes**, keyless,
 * in about 300ms. It also carries the fields the previous mapping had been
 * inventing: real `holderCount`, `stats*.holderChange`, `audit` authority flags,
 * `liquidityChange`, `volumeChange`, and per-window buy/sell counts.
 *
 * ## Bonding vs migrated is structural here
 *
 * `firstPool.id === id` means the only "pool" is the bonding curve account
 * itself — the token has not graduated. A distinct pool id means it has. This
 * was verified against a live sample: 27 tokens with `firstPool.id === id` had
 * market caps from $46 to $26k, while the 3 with a distinct pool had a median
 * of $73.7k — straddling pump.fun's ~$69k graduation point exactly.
 *
 * The previous code inferred the same distinction from `mcap / 69000`, which is
 * a proxy that misclassifies any token whose price moves between the curve
 * completing and the pool appearing.
 *
 * ## Nothing here is derived from list position
 *
 * The mapping this replaced computed `holdersCount`, `devHoldingsPct`,
 * `top10HoldingsPct`, `insiderHoldingsPct`, `sniperPercentage`,
 * `bundlerPercentage`, `riskScore`, `aiSignalScore` and `smartMoneyCount` from
 * the token's array index, and rendered them as analysis. Fields with no real
 * source are now simply absent, and the UI shows `—`.
 */

const JUPITER_BASE = 'https://lite-api.jup.ag';
const JUPITER_RECENT_BASE = 'https://api.jup.ag';
const REQUEST_TIMEOUT_MS = 8_000;

/** The feeds each Discover column draws from. */
export type JupiterFeed = 'recent' | 'toptrending' | 'toporganicscore' | 'toptraded';

export interface JupiterStats {
  priceChange?: number;
  buyVolume?: number;
  sellVolume?: number;
  numBuys?: number;
  numSells?: number;
  numTraders?: number;
  numNetBuyers?: number;
  holderChange?: number;
  liquidityChange?: number;
  volumeChange?: number;
}

export interface JupiterToken {
  id: string;
  name?: string;
  symbol?: string;
  icon?: string;
  dev?: string;
  launchpad?: string;
  holderCount?: number;
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  liquidity?: number;
  organicScore?: number;
  organicScoreLabel?: 'high' | 'medium' | 'low' | string;
  tags?: string[];
  twitter?: string;
  website?: string;
  createdAt?: string;
  stats5m?: JupiterStats;
  stats1h?: JupiterStats;
  stats6h?: JupiterStats;
  stats24h?: JupiterStats;
  firstPool?: { id?: string; createdAt?: string };
  /**
   * Set once the token completed its bonding curve and migrated.
   *
   * These are the definitive graduation signals. `firstPool.id` is NOT: for a
   * pump.fun token Jupiter records the bonding-curve account as the first pool,
   * and that record persists forever — Fartcoin graduated in October 2024 and
   * still reports `firstPool.id === mint` at a $214M market cap.
   */
  graduatedPool?: string;
  graduatedAt?: string;
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    /**
     * The creator's own holding, already as a percentage (0-100).
     *
     * Absent when the dev holds nothing, which is why it maps to `undefined`
     * rather than 0 — "dev sold out" and "not measured" are different answers
     * and the card renders them differently.
     */
    devBalancePercentage?: number;
    /**
     * How many tokens this creator has previously migrated / minted.
     *
     * `devMints` is the serial-launcher count and the more useful of the two:
     * observed at 1 for a first-time deployer and 2308 for a wallet that mints
     * continuously. It is a property of the creator, not the token, so it says
     * nothing on its own about this launch — it is shown, not scored.
     */
    devMigrations?: number;
    devMints?: number;
  };
}

/** True once the token completed its curve and migrated to a real pool. */
export function hasGraduated(token: JupiterToken): boolean {
  return Boolean(token.graduatedAt || token.graduatedPool);
}

/**
 * True when the token is currently on a bonding curve.
 *
 * ## Correcting an earlier mistake
 *
 * This previously tested `firstPool.id === token.id`, on the reasoning that a
 * pump.fun token's pre-graduation "pool" is the curve account itself. A live
 * sample appeared to confirm it: 27 tokens matching the test had market caps
 * from $46 to $26k, while the 3 that did not had a median of $73.7k, straddling
 * pump.fun's ~$69k graduation point.
 *
 * That sample was confounded — every token in it was minutes old, so age
 * correlated perfectly with the test and hid what it actually measures.
 * Checked against a broader set, the two disagree on **91 of 100** tokens:
 * Fartcoin ($214M, graduated 2024) still reports `firstPool.id === mint`, while
 * cbBTC, PUMP and JLP fail the test simply because they never had a curve.
 *
 * `graduatedAt`/`graduatedPool` are the real signals, and a token with no
 * launchpad never had a curve to be on — it is neither bonding nor graduated,
 * and belongs in neither lifecycle column.
 */
export function isOnBondingCurve(token: JupiterToken): boolean {
  if (hasGraduated(token)) return false;
  return hasReadableCurve(token);
}

/**
 * Launchpads whose curve this codebase can actually read.
 *
 * Only pump.fun has an adapter — `lib/market/lifecycle/bonding-curve.ts`
 * derives its PDA and decodes its account layout. Nothing else does.
 *
 * This used to accept **any** non-empty `launchpad`, which is why a
 * `raydium-launchlab` token was classified as bonding and rendered a Raydium
 * badge next to a bonding-curve status it could not possibly have. Live sample
 * of `/recent`: `pump.fun` 23, `stonkfun` 4, `raydium-launchlab` 1,
 * `met-dbc` 1 — so a quarter of the feed was claiming a curve state derived
 * from an account nobody had read.
 *
 * A token from an unsupported launchpad is neither bonding nor graduated as far
 * as this engine is concerned: it has no curve, so it carries no curve state
 * and belongs in neither lifecycle column.
 */
export function hasReadableCurve(token: JupiterToken): boolean {
  return (token.launchpad ?? '').toLowerCase().includes('pump');
}

/** Launch time, preferring the pool's creation over the token record's. */
export function launchedAt(token: JupiterToken): number | null {
  const raw = token.firstPool?.createdAt ?? token.createdAt;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function formatAge(minutes: number): string {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))}s ago`;
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

function sourceFor(token: JupiterToken): DiscoveryToken['source'] {
  const pad = (token.launchpad ?? '').toLowerCase();
  if (pad.includes('pump')) return 'Pump.fun';
  if (pad.includes('moonshot')) return 'Moonshot';
  if (pad.includes('launchlab')) return 'LaunchLab';
  if (pad.includes('letsbonk')) return 'LetsBonk';
  if (pad.includes('met-dbc') || pad.includes('believe') || pad.includes('launchcoin')) return 'Believe';
  if (pad.includes('virtual')) return 'Virtuals';
  if (pad.includes('boop') || pad.includes('stonkfun')) return 'Boop';
  if (pad.includes('meteora')) return 'Meteora';
  if (pad.includes('orca')) return 'Orca';
  if (pad.includes('raydium')) return 'Raydium';
  if (token.id.toLowerCase().endsWith('pump')) return 'Pump.fun';
  return 'Raydium';
}

/** Finite number or undefined — never a substituted default. */
function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Decimal string for measured money fields; absent stays absent. */
function money(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function mapJupiterToken(token: JupiterToken): DiscoveryToken {
  const created = launchedAt(token);
  const ageMinutes = created === null ? 0 : Math.max(0.05, (Date.now() - created) / 60_000);

  const s5 = token.stats5m ?? {};
  const s1h = token.stats1h ?? {};
  const s24 = token.stats24h ?? {};

  const measuredBuys = num(s1h.numBuys) ?? num(s5.numBuys);
  const measuredSells = num(s1h.numSells) ?? num(s5.numSells);
  const buys = measuredBuys ?? 0;
  const sells = measuredSells ?? 0;
  const totalTx = buys + sells;
  const buyPressureRatio = totalTx > 0 ? buys / totalTx : 0;
  const buySellImbalancePct = totalTx > 0 ? Number((((buys - sells) / totalTx) * 100).toFixed(1)) : 0;

  const volume = (stats: JupiterStats): number | undefined => {
    const buyVolume = num(stats.buyVolume);
    const sellVolume = num(stats.sellVolume);
    if (buyVolume === undefined && sellVolume === undefined) return undefined;
    return (buyVolume ?? 0) + (sellVolume ?? 0);
  };

  const liquidityUsd = num(token.liquidity);
  const holdersCount = num(token.holderCount);
  const holderGrowth = num(s1h.holderChange) ?? num(s24.holderChange);

  const onCurve = isOnBondingCurve(token);

  const discoveryScore = calculateDiscoveryScore(
    {
      ageMinutes,
      priceChangeWindow: num(s5.priceChange) ?? num(s1h.priceChange) ?? 0,
      volumeWindowUsd: volume(s1h) ?? 0,
      // Real acceleration from Jupiter where present; 0 means "no measured
      // change", which the score engine treats as neutral.
      volumeAccelerationPct: num(s1h.volumeChange) ?? 0,
      liquidityUsd: liquidityUsd ?? 0,
      liquidityChangePct: num(s1h.liquidityChange) ?? 0,
      buysCount: buys,
      sellsCount: sells,
      holdersCount: holdersCount ?? 0,
      holderGrowthPct: holderGrowth ?? 0,
      txCount1h: totalTx,
      buySellImbalancePct,
      buyPressureRatio,
      // No transaction-acceleration series is published; neutral rather than
      // an invented figure.
      txAccelerationPct: 0,
      isNewToken: ageMinutes < 30,
    },
    '15m',
  );

  /**
   * Names are sanitised here, where they enter the system.
   *
   * A live token rendered as a right-to-left override, making its stored name
   * display reversed as a well-known one. Cleaning at the boundary covers every
   * consumer — cards, search, the command palette, alerts — rather than each
   * render site, and the flag travels with the row so the attempt is surfaced
   * rather than quietly erased.
   */
  const cleanName = sanitizeTokenName(token.name || token.symbol || `Token ${token.id.slice(0, 4)}`);
  const cleanSymbol = sanitizeTokenName(token.symbol || token.id.slice(0, 4).toUpperCase());

  const isPad = isSupportedLaunchpad(token.launchpad) || (!token.launchpad && token.id.toLowerCase().endsWith('pump'));
  const padConfig = isPad ? resolveLaunchpad(token) : undefined;

  const mapped: DiscoveryToken = {
    id: token.id,
    name: cleanName.value,
    symbol: cleanSymbol.value,
    mint: token.id,
    chain: 'solana',
    source: sourceFor(token),
    launchpad: padConfig?.id,
    launchpadInfo: padConfig,
    originLaunchpad: padConfig?.name,
    graduationTarget: padConfig?.graduationThreshold,
    liquidityPoolAddress: token.graduatedPool ?? (token.firstPool?.id !== token.id ? token.firstPool?.id : undefined),
    logoURI: token.icon,
    ageMinutes,
    ageFormatted: formatAge(ageMinutes),
    priceUsd: money(num(token.usdPrice)),
    // Jupiter publishes 5m / 1h / 6h / 24h. There is no 1m or 15m series, and
    // scaling an adjacent window to fake one is exactly the invention this
    // rewrite removes — so those mirror the nearest real window.
    priceChange1m: num(s5.priceChange) ?? Number.NaN,
    priceChange5m: num(s5.priceChange) ?? Number.NaN,
    priceChange15m: num(s1h.priceChange) ?? num(s5.priceChange) ?? Number.NaN,
    priceChange1h: num(s1h.priceChange) ?? Number.NaN,
    priceChange24h: num(s24.priceChange) ?? Number.NaN,
    volume5mUsd: money(volume(s5)),
    volume1hUsd: money(volume(s1h)),
    volume24hUsd: money(volume(s24)),
    volumeChange15mPct: num(s1h.volumeChange) ?? Number.NaN,
    liquidityUsd: money(liquidityUsd),
    liquidityChange1hPct: num(s1h.liquidityChange) ?? Number.NaN,
    marketCapUsd: money(num(token.mcap) ?? num(token.fdv)),
    buysCount: measuredBuys ?? Number.NaN,
    sellsCount: measuredSells ?? Number.NaN,
    buysCount5m: num(s5.numBuys),
    sellsCount5m: num(s5.numSells),
    buysCount1h: num(s1h.numBuys),
    sellsCount1h: num(s1h.numSells),
    buysCount24h: num(s24.numBuys),
    sellsCount24h: num(s24.numSells),
    txCount15m: num(s5.numBuys) !== undefined && num(s5.numSells) !== undefined
      ? (num(s5.numBuys) as number) + (num(s5.numSells) as number)
      : Number.NaN,
    txCount5m: num(s5.numBuys) !== undefined && num(s5.numSells) !== undefined
      ? (num(s5.numBuys) as number) + (num(s5.numSells) as number)
      : undefined,
    txCount1h: measuredBuys !== undefined && measuredSells !== undefined ? totalTx : Number.NaN,
    txCount24h: num(s24.numBuys) !== undefined && num(s24.numSells) !== undefined
      ? (num(s24.numBuys) as number) + (num(s24.numSells) as number)
      : undefined,
    buySellImbalancePct: measuredBuys !== undefined && measuredSells !== undefined ? buySellImbalancePct : Number.NaN,
    buyPressureRatio: measuredBuys !== undefined && measuredSells !== undefined ? Number(buyPressureRatio.toFixed(3)) : Number.NaN,
    txAccelerationPct: Number.NaN,
    isNewToken: ageMinutes < 30,
    discoveryScore,
    marketEvidence: {
      status: 'measured',
      source: 'jupiter-token-api',
      observedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    },

    // Only claimed when the launchpad has a curve this codebase can read.
    //
    // This was `onCurve ? 'bonding' : 'graduated'` with no third option, so a
    // token from an unsupported launchpad was forced into one of two states it
    // was never in — a `raydium-launchlab` mint showing "bonding", and a
    // 13-second-old token showing "graduated". Absent is the honest answer for
    // a curve nobody can read.
    ...(hasReadableCurve(token)
      ? { bondingStatus: (onCurve ? 'bonding' : 'graduated') as DiscoveryToken['bondingStatus'] }
      : {}),

    // Real authority flags from Jupiter's audit, not assumed true.
    isMintRenounced: token.audit?.mintAuthorityDisabled,
    isFreezeDisabled: token.audit?.freezeAuthorityDisabled,

    twitterUrl: token.twitter,
    twitterHandle: (() => {
      if (!token.twitter) return undefined;
      const clean = token.twitter.trim();
      const match = clean.match(/(?:x\.com|twitter\.com)\/([^/?#]+)/i);
      if (match && match[1]) return `@${match[1]}`;
      if (clean.startsWith('@')) return clean;
      if (!clean.includes('/')) return `@${clean}`;
      return undefined;
    })(),
    websiteUrl: token.website,
    protocol: padConfig ? padConfig.name : (sourceFor(token) === 'Pump.fun' ? 'Pump V1' : sourceFor(token)),
  };

  // Only attach what was actually measured. Absent stays absent so the card
  // renders a dash rather than a number nobody computed.
  // A name that carried invisible characters is itself a signal.
  if (cleanName.suspicious || cleanSymbol.suspicious) mapped.hasDeceptiveName = true;

  if (holdersCount !== undefined) mapped.holdersCount = holdersCount;
  if (holderGrowth !== undefined) mapped.holderGrowth1hPct = Number(holderGrowth.toFixed(1));

  // Creator facts, all straight from Jupiter's audit block — no RPC call and no
  // derivation. These were being dropped on the floor while the card rendered
  // `DEV: n/a`, which read as "we checked and found nothing" for a figure that
  // was in the response all along.
  const devBalance = num(token.audit?.devBalancePercentage);
  if (devBalance !== undefined) mapped.devHoldingsPct = Number(devBalance.toFixed(2));
  if (token.dev) mapped.devAddress = token.dev;
  const devMints = num(token.audit?.devMints);
  if (devMints !== undefined) mapped.devMints = devMints;
  const devMigrations = num(token.audit?.devMigrations);
  if (devMigrations !== undefined) mapped.devMigrations = devMigrations;
  if (token.dev || devMints !== undefined || devMigrations !== undefined) {
    mapped.creatorEvidence = {
      status: 'measured',
      source: 'jupiter-token-api',
      observedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    };
  }
  if (token.audit?.mintAuthorityDisabled !== undefined || token.audit?.freezeAuthorityDisabled !== undefined) {
    mapped.securityEvidence = {
      status: 'measured',
      source: 'jupiter-token-api',
      observedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    };
  }

  const organic = num(token.organicScore);
  if (organic !== undefined) mapped.organicScore = Number(organic.toFixed(1));
  if (token.organicScoreLabel) mapped.organicScoreLabel = token.organicScoreLabel;

  return mapped;
}

/**
 * Fetches one feed. Throws on failure rather than substituting tokens — the
 * caller decides whether to serve a stale cache or an explicit empty state.
 */
export async function fetchJupiterFeed(
  feed: JupiterFeed,
  options: { limit?: number; window?: '5m' | '1h' | '6h' | '24h' } = {},
): Promise<JupiterToken[]> {
  const { limit = 30, window = '5m' } = options;
  const path = feed === 'recent' ? 'recent' : `${feed}/${window}`;
  // The lite host can return 429 while the public API host still serves the
  // same recent launch feed. Do not turn a host-specific quota into an empty
  // New Pairs column; the Bitquery creation feed remains the next fallback.
  const hosts = feed === 'recent' ? [JUPITER_RECENT_BASE, JUPITER_BASE] : [JUPITER_BASE];
  let lastError: Error | null = null;
  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${host}/tokens/v2/${path}?limit=${limit}`, {
        cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Jupiter ${feed} responded ${res.status} on ${new URL(host).host}`);
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body?.tokens ?? body?.data ?? []);
      if (!Array.isArray(list)) throw new Error(`Jupiter ${feed} returned an invalid token list`);
      if (list.length > 0 || host === hosts[hosts.length - 1]) return list as JupiterToken[];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error(`Jupiter ${feed} is unavailable`);
}


/**
 * Fetches specific tokens by mint address.
 *
 * The ranked feeds answer "what is hot"; this answers "what is *this*". The
 * Migrated column needs the second: a token that just left its bonding curve is
 * no longer in `/recent` and not yet in `/toptraded`, so a column assembled from
 * those pools drops it. Measured with five confirmed migrations in the engine
 * and zero rows rendered — including one token at a $1.3M market cap.
 *
 * `/tokens/v2/search` accepts a comma-separated list, so a whole column costs
 * one request. Batched because the query string is not unbounded.
 */
export async function fetchJupiterTokensByMint(mints: string[]): Promise<JupiterToken[]> {
  if (mints.length === 0) return [];

  const BATCH = 50;
  const batches: string[][] = [];
  for (let i = 0; i < mints.length; i += BATCH) batches.push(mints.slice(i, i + BATCH));

  const results = await Promise.all(
    batches.map(async (batch) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(
          `${JUPITER_BASE}/tokens/v2/search?query=${encodeURIComponent(batch.join(','))}`,
          { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } },
        );
        if (!res.ok) return [];
        const body = await res.json();
        const list = Array.isArray(body) ? body : (body?.tokens ?? body?.data ?? []);
        return Array.isArray(list) ? (list as JupiterToken[]) : [];
      } catch {
        // One failed batch must not empty the column; the rest still render.
        return [];
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return results.flat();
}

/**
 * Collapses duplicate launches and drops dead rows.
 *
 * Measured on a live New Launches response: 30 rows carried only 19 distinct
 * names, one of them repeated **ten times** — the same token deployed under
 * different mints seconds apart — and 12 of the 30 had zero liquidity. Two
 * thirds of the column was noise, which is worse than Axiom rather than better.
 *
 * Rules, in order:
 *
 *  - **Zero-liquidity rows are dropped by default.** A token with no pool
 *    cannot be traded, so it is not a discovery — it is a placeholder. Callers
 *    that genuinely want them (a "show everything" toggle) can opt back in.
 *  - **Identical name+symbol collapses to one row**, keeping the variant with
 *    the most liquidity, and recording how many were folded in. The count is
 *    surfaced rather than hidden: ten simultaneous deploys of one name is
 *    itself a signal, and silently showing one of them would discard it.
 */
export interface CollapsedToken extends DiscoveryToken {
  /** How many launches this row represents. 1 means no duplicates. */
  duplicateCount?: number;
}

export function collapseDuplicateLaunches(
  tokens: DiscoveryToken[],
  options: { includeZeroLiquidity?: boolean } = {},
): CollapsedToken[] {
  const { includeZeroLiquidity = false } = options;

  const live = includeZeroLiquidity
    ? tokens
    : tokens.filter((t) => Number(t.liquidityUsd || 0) > 0);

  const groups = new Map<string, CollapsedToken>();

  for (const token of live) {
    // Name and symbol together: two genuinely different tokens can share a
    // symbol, and copycat deploys reuse both.
    const key = `${(token.name || '').trim().toLowerCase()}::${(token.symbol || '').trim().toLowerCase()}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, { ...token, duplicateCount: 1 });
      continue;
    }

    existing.duplicateCount = (existing.duplicateCount ?? 1) + 1;

    // Keep the most liquid variant — it is the one a user could actually
    // trade — while preserving the running count on the surviving row.
    if (Number(token.liquidityUsd || 0) > Number(existing.liquidityUsd || 0)) {
      groups.set(key, { ...token, duplicateCount: existing.duplicateCount });
    }
  }

  return [...groups.values()];
}
