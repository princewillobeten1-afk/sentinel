'use client';

import { useCallback, useEffect, useState } from 'react';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData, ApiRequestError } from '@/lib/api/response';

/**
 * How many tokens each tab shows.
 *
 * Asked for explicitly: 20 trending, 15 top. Both are within the registry and
 * ranking endpoints' hard cap of 100, so neither is silently clamped.
 */
export const TRENDING_LIMIT = 20;
export const TOP_TOKENS_LIMIT = 15;

/**
 * Per-section deadline.
 *
 * Generous enough for a cold Next.js route compile in development, short enough
 * that a wedged endpoint degrades one panel instead of the page.
 */
const SECTION_TIMEOUT_MS = 12_000;

/**
 * Everything the Overview screen reads, in one place.
 *
 * The page previously rendered eleven features from hardcoded literals and a
 * hook that substituted mock data on failure. Each panel is now backed by a real
 * endpoint, and — importantly — each tracks its **own** availability: a failing
 * portfolio must not blank the market panels, and a market outage must not hide
 * alerts that loaded fine.
 *
 * `Promise.allSettled` rather than `Promise.all` for exactly that reason. Any
 * section that fails ends up `null` with its error recorded, and the view shows
 * that section as unavailable while the rest renders.
 */

export interface MarketRegime {
  regime: string;
  confidenceScore: number;
  activeSolanaVolume24hUsd: number;
  newMintsCount24h: number;
  medianPoolDepthUsd: number;
  averageWashTradingPct: number;
}

export interface VolumeDecomposition {
  totalVolumeUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  washTradingProbabilityPct?: number;
  /** Engine-computed, not derived here — see VolumeDecompositionEngine. */
  organicVolumeUsd?: number;
  organicVolumePct?: number;
  organicScore?: number;
  suspectedWashVolumeUsd?: number;
}

export interface OverviewToken {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: string | number | null;
  priceChange24h: number | null;
  marketCapUsd: string | number | null;
  liquidityUsd: string | number | null;
  volume24hUsd: string | number | null;
  intelligenceScore: number | null;
  logoURI?: string | null;
}

export interface OverviewAlert {
  id: string;
  title: string | null;
  summary: string | null;
  severity: string | null;
  category: string | null;
  token: string | null;
  readState: string;
  timestamp: string;
}

/** One slice of the allocation bar. `sharePct` here is already 0–100. */
export interface AllocationSlice {
  key: string;
  label: string;
  valueUsd: number;
  sharePct: number;
}

export interface OverviewData {
  market: { regime: MarketRegime; decomposition: VolumeDecomposition } | null;
  allocation: AllocationSlice[];
  trending: OverviewToken[];
  topTokens: OverviewToken[];
  alerts: OverviewAlert[];
  criticalAlertCount: number;
  portfolio: { totalValueUsd: number | null; exitValueUsd: number | null; changeUsd: number | null } | null;
  /** Per-section failure messages, keyed by section. Absent means it loaded. */
  errors: Partial<Record<'market' | 'trending' | 'topTokens' | 'alerts' | 'portfolio', string>>;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/** Normalises the differing token shapes the two token endpoints return. */
function toOverviewToken(raw: Record<string, unknown>): OverviewToken {
  const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : null;
  };
  /**
   * The two token endpoints use different field names for the same things:
   * the ranking engine emits `tokenId` / `changePct` / `volumeUsd` / `score`,
   * while the registry emits `address` / `priceChange24h` / `volume24hUsd`.
   * Reading only one set is why cards rendered `0/100` and `—` for volume.
   */
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  };

  return {
    mint: String(first('mint', 'address', 'tokenId', 'id') ?? ''),
    symbol: String(raw.symbol ?? '—'),
    name: String(raw.name ?? raw.symbol ?? 'Unknown'),
    priceUsd: (first('priceUsd', 'price') as string) ?? null,
    priceChange24h: num(first('priceChange24h', 'changePct', 'change24h')),
    marketCapUsd: (first('marketCapUsd', 'marketCap') as string) ?? null,
    liquidityUsd: (first('liquidityUsd', 'liquidity') as string) ?? null,
    volume24hUsd: (first('volume24hUsd', 'volumeUsd', 'volume24h') as string) ?? null,
    logoURI: (first('logoURI', 'logo_uri', 'icon', 'image', 'avatar', 'logoUrl', 'logo') as string) ?? null,
    // No fabricated score — `null` renders as "—" rather than a number that
    // looks measured.
    intelligenceScore: num(
      first('intelligenceScore', 'score') ??
        (raw.discoveryScore as { totalScore?: number } | undefined)?.totalScore,
    ),
  };
}

export function useOverviewData(walletAddress?: string | null): OverviewData {
  const [market, setMarket] = useState<OverviewData['market']>(null);
  const [trending, setTrending] = useState<OverviewToken[]>([]);
  const [topTokens, setTopTokens] = useState<OverviewToken[]>([]);
  const [alerts, setAlerts] = useState<OverviewAlert[]>([]);
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);
  const [portfolio, setPortfolio] = useState<OverviewData['portfolio']>(null);
  const [allocation, setAllocation] = useState<AllocationSlice[]>([]);
  const [errors, setErrors] = useState<OverviewData['errors']>({});
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const nextErrors: OverviewData['errors'] = {};

    const get = async <T,>(path: string, label: string): Promise<T | null> => {
      // Every request is bounded. Without this a single cold-compiling or
      // wedged route leaves its promise unsettled, `isLoading` stays true, and
      // the whole Overview sits on skeletons — the same failure already fixed
      // in use-realtime-token-feed.ts.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SECTION_TIMEOUT_MS);
      try {
        const res = await fetch(path, { credentials: 'include', signal: controller.signal });
        return await readApiData<T>(res, `Failed to load ${label}`);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          nextErrors[label as keyof OverviewData['errors']] =
            `${label} timed out after ${Math.round(SECTION_TIMEOUT_MS / 1000)}s.`;
          return null;
        }
        // 401 on a user-scoped section is "signed out", not a fault worth
        // showing as an error banner.
        if (err instanceof ApiRequestError && err.status === 401) return null;
        nextErrors[label as keyof OverviewData['errors']] =
          err instanceof Error ? err.message : `Failed to load ${label}`;
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    const [marketRes, trendingRes, topRes, alertsRes, portfolioRes, exposureRes] = await Promise.allSettled([
      get<{ marketRegime: MarketRegime; volumeDecomposition: VolumeDecomposition }>(
        apiUrl('/v1/analytics/market'),
        'market',
      ),
      // The discovery feeds, not the ranking engine over the registry.
      //
      // Measured: 0 of the 20 tokens the registry ranked had traded in the
      // previous 15 minutes, while 85 other mints had. The Overview was
      // showing a set disjoint from anything happening on-chain, so its live
      // price wiring had nothing to deliver. These feeds rank tokens by
      // current activity, which is what makes the WebSocket merge visible.
      get<{ tokens: Record<string, unknown>[] }>(
        apiUrl('/v1/discovery/trending', { limit: TRENDING_LIMIT }),
        'trending',
      ),
      // "Top" reads Jupiter's organic-score ranking rather than raw volume: a
      // token can lead the volume tables on wash trading, and separating
      // genuine flow from manufactured flow is this platform's premise.
      get<{ tokens: Record<string, unknown>[] }>(
        apiUrl('/v1/discovery/hot', { limit: TOP_TOKENS_LIMIT }),
        'topTokens',
      ),
      get<{ alerts: OverviewAlert[] }>(apiUrl(endpoints.alerts.events, { limit: 8 }), 'alerts'),
      walletAddress
        ? get<{ overview: Record<string, { usd?: number | null }> }>(
            apiUrl(endpoints.portfolio.overview(walletAddress)),
            'portfolio',
          )
        : Promise.resolve(null),
      walletAddress
        ? get<{ exposure: { byToken?: { key: string; label: string; valueUsd: number; sharePct: number }[] } }>(
            apiUrl(endpoints.portfolio.exposure(walletAddress)),
            'portfolio',
          )
        : Promise.resolve(null),
    ]);

    const value = <T,>(r: PromiseSettledResult<T | null>): T | null =>
      r.status === 'fulfilled' ? r.value : null;

    const m = value(marketRes);
    setMarket(m ? { regime: m.marketRegime, decomposition: m.volumeDecomposition } : null);

    setTrending((value(trendingRes)?.tokens ?? []).map(toOverviewToken));
    setTopTokens((value(topRes)?.tokens ?? []).map(toOverviewToken));

    const a = value(alertsRes)?.alerts ?? [];
    setAlerts(a);
    setCriticalAlertCount(a.filter((x) => x.severity === 'CRITICAL' || x.severity === 'HIGH').length);

    const p = value(portfolioRes)?.overview;
    setPortfolio(
      p
        ? {
            totalValueUsd: p.totalValue?.usd ?? null,
            exitValueUsd: p.estimatedExitValue?.usd ?? null,
            changeUsd: p.todayChange?.usd ?? null,
          }
        : null,
    );

    // `sharePct` arrives as a 0–1 fraction (lib/portfolio/exposure-engine.ts).
    // Converting once here is why a 60%-concentrated book cannot render as
    // "0.6%" — the same unit bug that hit the portfolio summary adapter.
    const buckets = value(exposureRes)?.exposure?.byToken ?? [];
    setAllocation(
      buckets
        .filter((b) => Number.isFinite(b.valueUsd) && b.valueUsd > 0)
        .map((b) => ({
          key: b.key,
          label: b.label || b.key,
          valueUsd: b.valueUsd,
          sharePct: (b.sharePct ?? 0) * 100,
        }))
        .sort((a, b) => b.sharePct - a.sharePct),
    );

    setErrors(nextErrors);
    setIsLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    market,
    allocation,
    trending,
    topTokens,
    alerts,
    criticalAlertCount,
    portfolio,
    errors,
    isLoading,
    refresh,
  };
}
