'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sentinel_token_filters_v1';

export interface TokenFiltersState {
  hiddenMints: string[];
  blacklistedDevs: string[];
  mutedSocials: string[];
}

export interface TokenFiltersContextValue extends TokenFiltersState {
  hideToken: (mint: string) => void;
  unhideToken: (mint: string) => void;
  isTokenHidden: (mint: string) => boolean;
  blacklistDev: (devAddress: string) => void;
  unblacklistDev: (devAddress: string) => void;
  isDevBlacklisted: (devAddress?: string) => boolean;
  muteSocial: (handle: string) => void;
  unmuteSocial: (handle: string) => void;
  isSocialMuted: (handle?: string) => boolean;
  clearAllFilters: () => void;
}

const TokenFiltersContext = createContext<TokenFiltersContextValue | undefined>(undefined);

export function TokenFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<TokenFiltersState>({
    hiddenMints: [],
    blacklistedDevs: [],
    mutedSocials: [],
  });

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFilters({
          hiddenMints: Array.isArray(parsed.hiddenMints) ? parsed.hiddenMints : [],
          blacklistedDevs: Array.isArray(parsed.blacklistedDevs) ? parsed.blacklistedDevs : [],
          mutedSocials: Array.isArray(parsed.mutedSocials) ? parsed.mutedSocials : [],
        });
      }
    } catch {
      // Ignore parse error
    }
  }, []);

  const saveToStorage = (updated: TokenFiltersState) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage full or unavailable
      }
    }
  };

  const hideToken = useCallback((mint: string) => {
    if (!mint) return;
    setFilters((prev) => {
      if (prev.hiddenMints.includes(mint)) return prev;
      const next = { ...prev, hiddenMints: [...prev.hiddenMints, mint] };
      saveToStorage(next);
      return next;
    });
  }, []);

  const unhideToken = useCallback((mint: string) => {
    setFilters((prev) => {
      const next = { ...prev, hiddenMints: prev.hiddenMints.filter((m) => m !== mint) };
      saveToStorage(next);
      return next;
    });
  }, []);

  const isTokenHidden = useCallback(
    (mint: string) => filters.hiddenMints.includes(mint),
    [filters.hiddenMints]
  );

  const blacklistDev = useCallback((devAddress: string) => {
    if (!devAddress) return;
    setFilters((prev) => {
      if (prev.blacklistedDevs.includes(devAddress)) return prev;
      const next = { ...prev, blacklistedDevs: [...prev.blacklistedDevs, devAddress] };
      saveToStorage(next);
      return next;
    });
  }, []);

  const unblacklistDev = useCallback((devAddress: string) => {
    setFilters((prev) => {
      const next = { ...prev, blacklistedDevs: prev.blacklistedDevs.filter((d) => d !== devAddress) };
      saveToStorage(next);
      return next;
    });
  }, []);

  const isDevBlacklisted = useCallback(
    (devAddress?: string) => Boolean(devAddress && filters.blacklistedDevs.includes(devAddress)),
    [filters.blacklistedDevs]
  );

  const muteSocial = useCallback((handle: string) => {
    if (!handle) return;
    const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
    setFilters((prev) => {
      if (prev.mutedSocials.includes(cleanHandle)) return prev;
      const next = { ...prev, mutedSocials: [...prev.mutedSocials, cleanHandle] };
      saveToStorage(next);
      return next;
    });
  }, []);

  const unmuteSocial = useCallback((handle: string) => {
    const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
    setFilters((prev) => {
      const next = { ...prev, mutedSocials: prev.mutedSocials.filter((s) => s !== cleanHandle) };
      saveToStorage(next);
      return next;
    });
  }, []);

  const isSocialMuted = useCallback(
    (handle?: string) => {
      if (!handle) return false;
      const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
      return filters.mutedSocials.includes(cleanHandle);
    },
    [filters.mutedSocials]
  );

  const clearAllFilters = useCallback(() => {
    const empty: TokenFiltersState = { hiddenMints: [], blacklistedDevs: [], mutedSocials: [] };
    setFilters(empty);
    saveToStorage(empty);
  }, []);

  return (
    <TokenFiltersContext.Provider
      value={{
        ...filters,
        hideToken,
        unhideToken,
        isTokenHidden,
        blacklistDev,
        unblacklistDev,
        isDevBlacklisted,
        muteSocial,
        unmuteSocial,
        isSocialMuted,
        clearAllFilters,
      }}
    >
      {children}
    </TokenFiltersContext.Provider>
  );
}

export function useTokenFilters(): TokenFiltersContextValue {
  const ctx = useContext(TokenFiltersContext);
  if (!ctx) {
    return {
      hiddenMints: [],
      blacklistedDevs: [],
      mutedSocials: [],
      hideToken: () => {},
      unhideToken: () => {},
      isTokenHidden: () => false,
      blacklistDev: () => {},
      unblacklistDev: () => {},
      isDevBlacklisted: () => false,
      muteSocial: () => {},
      unmuteSocial: () => {},
      isSocialMuted: () => false,
      clearAllFilters: () => {},
    };
  }
  return ctx;
}
