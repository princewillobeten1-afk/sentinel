'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export {
  type TrackedWalletCategory,
  type TrackedWallet,
  type TrackedWalletTrade,
  INITIAL_TRACKED_WALLETS,
  INITIAL_LIVE_TRADES,
} from '@/lib/wallet-tracker/types';
import {
  TrackedWallet,
  TrackedWalletTrade,
  INITIAL_TRACKED_WALLETS,
  INITIAL_LIVE_TRADES,
} from '@/lib/wallet-tracker/types';

const STORAGE_WALLETS_KEY = 'sentinel_tracked_wallets_v1';
const STORAGE_TRADES_KEY = 'sentinel_tracked_trades_v1';

interface TrackedWalletsContextType {
  trackedWallets: TrackedWallet[];
  liveTrades: TrackedWalletTrade[];
  isLoading: boolean;
  error: string | null;
  addTrackedWallet: (wallet: Omit<TrackedWallet, 'addedAt'>) => Promise<boolean>;
  removeTrackedWallet: (address: string) => Promise<boolean>;
  updateTrackedWallet: (address: string, updates: Partial<TrackedWallet>) => Promise<boolean>;
  isTracked: (address: string) => boolean;
  refreshWallets: () => Promise<void>;
  refreshLiveTrades: () => Promise<void>;
}

const TrackedWalletsContext = createContext<TrackedWalletsContextType | null>(null);

function readCachedWallets(): TrackedWallet[] {
  if (typeof window === 'undefined') return INITIAL_TRACKED_WALLETS;
  try {
    const raw = localStorage.getItem(STORAGE_WALLETS_KEY);
    if (!raw) return INITIAL_TRACKED_WALLETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TRACKED_WALLETS;
  } catch {
    return INITIAL_TRACKED_WALLETS;
  }
}

function writeCachedWallets(wallets: TrackedWallet[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_WALLETS_KEY, JSON.stringify(wallets));
  } catch {}
}

export function createTrackedWalletsManager(initialWallets: TrackedWallet[] = INITIAL_TRACKED_WALLETS) {
  let wallets = [...initialWallets];
  return {
    getWallets: () => [...wallets],
    add: (w: Omit<TrackedWallet, 'addedAt'>) => {
      const record: TrackedWallet = { ...w, addedAt: new Date().toISOString() };
      wallets = [record, ...wallets.filter((item) => item.address !== record.address)];
      return record;
    },
    remove: (addr: string) => {
      const prevLen = wallets.length;
      wallets = wallets.filter((item) => item.address.toLowerCase() !== addr.toLowerCase());
      return wallets.length < prevLen;
    },
    update: (addr: string, updates: Partial<TrackedWallet>) => {
      wallets = wallets.map((item) =>
        item.address.toLowerCase() === addr.toLowerCase() ? { ...item, ...updates } : item
      );
      return wallets.find((item) => item.address.toLowerCase() === addr.toLowerCase());
    },
    isTracked: (addr: string) =>
      wallets.some((item) => item.address.toLowerCase() === addr.toLowerCase()),
  };
}

export function TrackedWalletsProvider({ children }: { children: React.ReactNode }) {
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>(readCachedWallets);
  const [liveTrades, setLiveTrades] = useState<TrackedWalletTrade[]>(INITIAL_LIVE_TRADES);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with backend API on mount
  const refreshWallets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/tracked-wallets', { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        if (body.success && Array.isArray(body.data) && body.data.length > 0) {
          setTrackedWallets(body.data);
          writeCachedWallets(body.data);
        }
      }
    } catch (e: any) {
      // Offline fallback: keep cached items
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshLiveTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/tracked-wallets/activity', { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        if (body.success && Array.isArray(body.data) && body.data.length > 0) {
          setLiveTrades(body.data);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshWallets();
    refreshLiveTrades();
    const interval = setInterval(refreshLiveTrades, 15000);
    return () => clearInterval(interval);
  }, [refreshWallets, refreshLiveTrades]);

  const addTrackedWallet = useCallback(
    async (walletData: Omit<TrackedWallet, 'addedAt'>): Promise<boolean> => {
      const newWallet: TrackedWallet = {
        ...walletData,
        addedAt: new Date().toISOString(),
      };

      // Optimistic update
      const updated = [newWallet, ...trackedWallets.filter((w) => w.address !== newWallet.address)];
      setTrackedWallets(updated);
      writeCachedWallets(updated);

      try {
        await fetch('/api/v1/tracked-wallets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(newWallet),
        });
        return true;
      } catch {
        return true; // Still preserved locally
      }
    },
    [trackedWallets]
  );

  const removeTrackedWallet = useCallback(
    async (address: string): Promise<boolean> => {
      const updated = trackedWallets.filter((w) => w.address.toLowerCase() !== address.toLowerCase());
      setTrackedWallets(updated);
      writeCachedWallets(updated);

      try {
        await fetch(`/api/v1/tracked-wallets?address=${encodeURIComponent(address)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        return true;
      } catch {
        return true;
      }
    },
    [trackedWallets]
  );

  const updateTrackedWallet = useCallback(
    async (address: string, updates: Partial<TrackedWallet>): Promise<boolean> => {
      const updated = trackedWallets.map((w) =>
        w.address.toLowerCase() === address.toLowerCase() ? { ...w, ...updates } : w
      );
      setTrackedWallets(updated);
      writeCachedWallets(updated);

      try {
        await fetch('/api/v1/tracked-wallets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ address, updates }),
        });
        return true;
      } catch {
        return true;
      }
    },
    [trackedWallets]
  );

  const isTracked = useCallback(
    (address: string) => {
      return trackedWallets.some((w) => w.address.toLowerCase() === address.toLowerCase());
    },
    [trackedWallets]
  );

  return (
    <TrackedWalletsContext.Provider
      value={{
        trackedWallets,
        liveTrades,
        isLoading,
        error,
        addTrackedWallet,
        removeTrackedWallet,
        updateTrackedWallet,
        isTracked,
        refreshWallets,
        refreshLiveTrades,
      }}
    >
      {children}
    </TrackedWalletsContext.Provider>
  );
}

export function useTrackedWallets() {
  const context = useContext(TrackedWalletsContext);
  if (!context) {
    throw new Error('useTrackedWallets must be used within a TrackedWalletsProvider');
  }
  return context;
}
