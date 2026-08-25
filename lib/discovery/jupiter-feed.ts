import type { DiscoveryToken } from './types';
import { calculateDiscoveryScore } from './score-engine';

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
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    devMigrations?: number;
    devMints?: number;
  };
}

/**
 * True when the token is still on its bonding curve.
 *
 * See the module header — this is a structural test, not a market-cap
 * threshold. A token with no `firstPool` at all is treated as not-yet-migrated,
 * because a migrated token always has a pool distinct from its mint.
 */
export function isOnBondingCurve(token: JupiterToken): boolean {
  const poolId = token.firstPool?.id;
  if (!poolId) return true;
  return poolId === token.id;
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
  if (pad.includes('meteora')) return 'Meteora';
  if (pad.includes('orca')) return 'Orca';
  if (pad.includes('raydium')) return 'Raydium';
  // A pump.fun mint keeps its suffix even when the launchpad field is absent.
  if (token.id.toLowerCase().endsWith('pump')) return 'Pump.fun';
  return 'Raydium';
}

/** Finite number or undefined — never a substituted default. */
function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Decimal string for the money fields, or '0' when genuinely absent. */
function money(value: number | undefined): string {
  return value === undefined ? '0' : String(value);
}

export function mapJupiterToken(token: JupiterToken): DiscoveryToken {
  const created = launchedAt(token);
  const ageMinutes = created === null ? 0 : Math.max(0.05, (Date.now() - created) / 60_000);

  const s5 = token.stats5m ?? {};
  const s1h = token.stats1h ?? {};
  const s24 = token.stats24h ?? {};

  const buys = num(s1h.numBuys) ?? num(s5.numBuys) ?? 0;
  const sells = num(s1h.numSells) ?? num(s5.numSells) ?? 0;
  const totalTx = buys + sells;
  const buyPressureRatio = totalTx > 0 ? buys / totalTx : 0;
  const buySellImbalancePct = totalTx > 0 ? Number((((buys - sells) / totalTx) * 100).toFixed(1)) : 0;

  const volume = (stats: JupiterStats) =>
    (num(stats.buyVolume) ?? 0) + (num(stats.sellVolume) ?? 0);

  const liquidityUsd = num(token.liquidity);
  const holdersCount = num(token.holderCount);
  const holderGrowth = num(s1h.holderChange) ?? num(s24.holderChange);

  const onCurve = isOnBondingCurve(token);

  const discoveryScore = calculateDiscoveryScore(
    {
      ageMinutes,
      priceChangeWindow: num(s5.priceChange) ?? num(s1h.priceChange) ?? 0,
      volumeWindowUsd: volume(s1h),
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

  const mapped: DiscoveryToken = {
    id: token.id,
    name: token.name || token.symbol || `Token ${token.id.slice(0, 4)}`,
    symbol: token.symbol || token.id.slice(0, 4).toUpperCase(),
    mint: token.id,
    chain: 'solana',
    source: sourceFor(token),
    logoURI: token.icon,
    ageMinutes,
    ageFormatted: formatAge(ageMinutes),
    priceUsd: money(num(token.usdPrice)),
    // Jupiter publishes 5m / 1h / 6h / 24h. There is no 1m or 15m series, and
    // scaling an adjacent window to fake one is exactly the invention this
    // rewrite removes — so those mirror the nearest real window.
    priceChange1m: Number((num(s5.priceChange) ?? 0).toFixed(2)),
    priceChange5m: Number((num(s5.priceChange) ?? 0).toFixed(2)),
    priceChange15m: Number((num(s1h.priceChange) ?? num(s5.priceChange) ?? 0).toFixed(2)),
    priceChange1h: Number((num(s1h.priceChange) ?? 0).toFixed(2)),
    priceChange24h: Number((num(s24.priceChange) ?? 0).toFixed(2)),
    volume5mUsd: money(volume(s5)),
    volume1hUsd: money(volume(s1h)),
    volume24hUsd: money(volume(s24)),
    volumeChange15mPct: Number((num(s1h.volumeChange) ?? 0).toFixed(1)),
    liquidityUsd: money(liquidityUsd),
    liquidityChange1hPct: Number((num(s1h.liquidityChange) ?? 0).toFixed(1)),
    marketCapUsd: money(num(token.mcap) ?? num(token.fdv)),
    buysCount: buys,
    sellsCount: sells,
    txCount15m: (num(s5.numBuys) ?? 0) + (num(s5.numSells) ?? 0),
    txCount1h: totalTx,
    buySellImbalancePct,
    buyPressureRatio: Number(buyPressureRatio.toFixed(3)),
    txAccelerationPct: 0,
    isNewToken: ageMinutes < 30,
    discoveryScore,

    // Structural, from firstPool — see isOnBondingCurve().
    bondingStatus: onCurve ? 'bonding' : 'graduated',

    // Real authority flags from Jupiter's audit, not assumed true.
    isMintRenounced: token.audit?.mintAuthorityDisabled,
    isFreezeDisabled: token.audit?.freezeAuthorityDisabled,

    twitterUrl: token.twitter,
    websiteUrl: token.website,
  };

  // Only attach what was actually measured. Absent stays absent so the card
  // renders a dash rather than a number nobody computed.
  if (holdersCount !== undefined) mapped.holdersCount = holdersCount;
  if (holderGrowth !== undefined) mapped.holderGrowth1hPct = Number(holderGrowth.toFixed(1));

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
  const url = `${JUPITER_BASE}/tokens/v2/${path}?limit=${limit}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Jupiter ${feed} responded ${res.status}`);

    const body = await res.json();
    const list = Array.isArray(body) ? body : (body?.tokens ?? body?.data ?? []);
    return Array.isArray(list) ? (list as JupiterToken[]) : [];
  } finally {
    clearTimeout(timer);
  }
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
