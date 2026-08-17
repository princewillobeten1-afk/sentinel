'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { NormalizedSearchResult, TOKEN_DATABASE, searchTokens } from '@/lib/token/search-service';

const WATCHLIST_STORAGE_KEY = 'sentinel_watchlist_mints';

interface WatchlistContextType {
  watchlistedMints: string[];
  addToWatchlist: (mint: string) => void;
  removeFromWatchlist: (mint: string) => void;
  toggleWatchlist: (mint: string) => void;
  isWatchlisted: (mint: string) => boolean;
  getWatchlistTokens: () => NormalizedSearchResult[];
}

const WatchlistContext = createContext<WatchlistContextType | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlistedMints, setWatchlistedMints] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to load watchlist from localStorage', e);
      }
    }
    // Default initial watchlisted tokens
    return ['7xK99zK8mP2xQ5wN3a19', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistedMints));
      } catch (e) {
        console.warn('Failed to save watchlist to localStorage', e);
      }
    }
  }, [watchlistedMints]);

  const addToWatchlist = (mint: string) => {
    setWatchlistedMints((prev) => (prev.includes(mint) ? prev : [...prev, mint]));
  };

  const removeFromWatchlist = (mint: string) => {
    setWatchlistedMints((prev) => prev.filter((m) => m !== mint));
  };

  const toggleWatchlist = (mint: string) => {
    if (watchlistedMints.includes(mint)) {
      removeFromWatchlist(mint);
    } else {
      addToWatchlist(mint);
    }
  };

  const isWatchlistedCheck = (mint: string) => watchlistedMints.includes(mint);

  const getWatchlistTokens = (): NormalizedSearchResult[] => {
    const allTokens = searchTokens('');
    return allTokens.filter((t) => watchlistedMints.includes(t.mint));
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlistedMints,
        addToWatchlist,
        removeFromWatchlist,
        toggleWatchlist,
        isWatchlisted: isWatchlistedCheck,
        getWatchlistTokens,
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
