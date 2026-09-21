'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { NormalizedSearchResult, searchTokens } from '@/lib/token/search-service';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData, ApiRequestError } from '@/lib/api/response';

/**
 * Watchlist state.
 *
 * The server is the source of truth; `localStorage` is only a cache so the list
 * paints instantly on load and survives being offline.
 *
 * Previously this store made **zero** API calls while `/api/v1/watchlist`
 * existed — the list lived only in `localStorage`, so it died with the browser
 * profile and never reached a second device. It also seeded two hardcoded mints
 * on first run, one of which (`7xK99zK8mP2xQ5wN3a19`) is not a valid Solana
 * address, so every new user started with a token that cannot exist.
 *
 * Writes are optimistic and reverted on failure: the star must respond
 * immediately, but a change the server refused must not be left on screen.
 */

const WATCHLIST_CACHE_KEY = 'sentinel_watchlist_mints';
const WATCHLIST_META_CACHE_KEY = 'sentinel_watchlist_meta';

interface WatchlistContextType {
  watchlistedMints: string[];
  addToWatchlist: (mint: string, meta?: Partial<NormalizedSearchResult>) => void;
  removeFromWatchlist: (mint: string) => void;
  toggleWatchlist: (mint: string, meta?: Partial<NormalizedSearchResult>) => void;
  isWatchlisted: (mint: string) => boolean;
  getWatchlistTokens: () => NormalizedSearchResult[];
  /** True while the first server read is in flight. */
  isLoading: boolean;
  /** Set when the server copy could not be reached; the cache is being shown. */
  error: string | null;
  refresh: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | null>(null);

function readCache(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(WATCHLIST_CACHE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed.filter((m) => typeof m === 'string') : [];
  } catch {
    return [];
  }
}

function writeCache(mints: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(mints));
  } catch {
    // Private mode or storage disabled — the server copy is still authoritative.
  }
}

function readMetaCache(): Record<string, Partial<NormalizedSearchResult>> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(WATCHLIST_META_CACHE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function writeMetaCache(meta: Record<string, Partial<NormalizedSearchResult>>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WATCHLIST_META_CACHE_KEY, JSON.stringify(meta));
  } catch {}
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  // No seeded defaults. An empty watchlist is the honest starting state.
  const [watchlistedMints, setWatchlistedMints] = useState<string[]>([]);
  const [tokenMetaMap, setTokenMetaMap] = useState<Record<string, Partial<NormalizedSearchResult>>>({});
  const [cacheReady, setCacheReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Signed-out users get the local cache only; there is nothing to sync to. */
  const isAuthenticatedRef = useRef(true);

  // Match the server's first paint, then restore the browser cache. Do not
  // persist the empty first render over an existing offline watchlist.
  useEffect(() => {
    setWatchlistedMints(readCache());
    setTokenMetaMap(readMetaCache());
    setCacheReady(true);
  }, []);

  useEffect(() => {
    if (cacheReady) writeCache(watchlistedMints);
  }, [watchlistedMints, cacheReady]);

  useEffect(() => {
    if (cacheReady) writeMetaCache(tokenMetaMap);
  }, [tokenMetaMap, cacheReady]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl(endpoints.watchlist.list), { credentials: 'include' });
      const data = await readApiData<{ items: Array<{ mint: string }> }>(res, 'Failed to load watchlist');
      isAuthenticatedRef.current = true;
      setWatchlistedMints((data.items ?? []).map((i) => i.mint));
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        // Not signed in: the cache is the whole story, and that is not an error.
        isAuthenticatedRef.current = false;
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Could not sync your watchlist.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Optimistic local change, then persist; revert if the server refuses. */
  const persist = useCallback(
    async (mint: string, action: 'add' | 'remove', previous: string[]) => {
      if (!isAuthenticatedRef.current) return;
      try {
        const res = await fetch(apiUrl(endpoints.watchlist.list), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mint, action }),
        });
        await readApiData(res, 'Failed to update watchlist');
        setError(null);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          isAuthenticatedRef.current = false;
          return;
        }
        setWatchlistedMints(previous);
        setError(err instanceof Error ? err.message : 'Could not save that change.');
      }
    },
    [],
  );

  const addToWatchlist = useCallback(
    (mint: string, meta?: Partial<NormalizedSearchResult>) => {
      if (meta) {
        setTokenMetaMap((prev) => ({ ...prev, [mint.toLowerCase()]: meta }));
      }
      setWatchlistedMints((prev) => {
        if (prev.includes(mint)) return prev;
        void persist(mint, 'add', prev);
        return [...prev, mint];
      });
    },
    [persist],
  );

  const removeFromWatchlist = useCallback(
    (mint: string) => {
      setWatchlistedMints((prev) => {
        if (!prev.includes(mint)) return prev;
        void persist(mint, 'remove', prev);
        return prev.filter((m) => m !== mint);
      });
    },
    [persist],
  );

  const toggleWatchlist = useCallback(
    (mint: string, meta?: Partial<NormalizedSearchResult>) => {
      if (meta) {
        setTokenMetaMap((prev) => ({ ...prev, [mint.toLowerCase()]: meta }));
      }
      setWatchlistedMints((prev) => {
        const has = prev.includes(mint);
        void persist(mint, has ? 'remove' : 'add', prev);
        return has ? prev.filter((m) => m !== mint) : [...prev, mint];
      });
    },
    [persist],
  );

  const isWatchlistedCheck = useCallback(
    (mint: string) => watchlistedMints.includes(mint),
    [watchlistedMints],
  );

  const getWatchlistTokens = useCallback((): NormalizedSearchResult[] => {
    const allDb = searchTokens('');
    return watchlistedMints.map((mint) => {
      const found = allDb.find((t) => t.mint.toLowerCase() === mint.toLowerCase());
      if (found) return found;

      const cachedMeta = tokenMetaMap[mint.toLowerCase()];
      if (cachedMeta) {
        return {
          id: `t_${mint.slice(0, 8)}`,
          name: cachedMeta.name || `Token ${mint.slice(0, 4)}`,
          symbol: (cachedMeta.symbol || mint.slice(0, 4)).replace('$', ''),
          mint: mint,
          chain: cachedMeta.chain || 'solana',
          priceUsd: cachedMeta.priceUsd ? String(cachedMeta.priceUsd).replace('$', '') : '0.0420',
          priceChange24h: cachedMeta.priceChange24h || 0,
          marketCapUsd: cachedMeta.marketCapUsd || '$1.2M',
          liquidityUsd: cachedMeta.liquidityUsd || '$250.0K',
          riskRating: cachedMeta.riskRating || 'unknown',
        };
      }

      return {
        id: `t_${mint.slice(0, 8)}`,
        name: `Token ${mint.slice(0, 4)}`,
        symbol: mint.slice(0, 4).toUpperCase(),
        mint: mint,
        chain: 'solana',
        priceUsd: '0.0420',
        priceChange24h: 0,
        marketCapUsd: '$1.2M',
        liquidityUsd: '$250.0K',
        riskRating: 'unknown',
      };
    });
  }, [watchlistedMints, tokenMetaMap]);

  return (
    <WatchlistContext.Provider
      value={{
        watchlistedMints,
        addToWatchlist,
        removeFromWatchlist,
        toggleWatchlist,
        isWatchlisted: isWatchlistedCheck,
        getWatchlistTokens,
        isLoading,
        error,
        refresh,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return ctx;
}
