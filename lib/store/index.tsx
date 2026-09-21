'use client';

import React from 'react';
import { UIStoreProvider, useUIState, useUIActions, ThemeMode, SelectedToken } from './ui-store';
import { WalletStoreProvider, useWalletState, useWalletActions, QuickBuyTokenData } from './wallet-store';
import { NotificationsStoreProvider, useNotificationsState, useNotificationsActions, AppNotification, ExecutionLog } from './notifications-store';
import { PreferencesProvider, usePreferencesState, usePreferencesActions } from './preferences-store';
import { WatchlistProvider, useWatchlist } from './watchlist-store';
import { TradeHistoryProvider, useTradeHistory } from './trade-history-store';
import { TokenFiltersProvider, useTokenFilters } from './token-filters-store';

export type { ThemeMode, QuickBuyTokenData, AppNotification, ExecutionLog, SelectedToken };
export type AppView =
  | 'dashboard'
  | 'trade'
  | 'discover'
  | 'portfolio'
  | 'watchlist'
  | 'alerts'
  | 'launchpad'
  | 'intelligence'
  | 'ai'
  | 'analytics'
  | 'settings'
  | 'developers'
  | 'help'
  | 'admin';

export type DensityMode = 'compact' | 'standard' | 'spacious';
export type NetworkId = 'mainnet' | 'devnet' | 'testnet';

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  return (
    <UIStoreProvider>
      <WalletStoreProvider>
        <PreferencesProvider>
          <TokenFiltersProvider>
            <WatchlistProvider>
              <TradeHistoryProvider>
                <NotificationsStoreProvider>{children}</NotificationsStoreProvider>
              </TradeHistoryProvider>
            </WatchlistProvider>
          </TokenFiltersProvider>
        </PreferencesProvider>
      </WalletStoreProvider>
    </UIStoreProvider>
  );
}

// Unified Hooks for Backward Compatibility
export function useAppState() {
  const ui = useUIState();
  const wallet = useWalletState();
  const notifications = useNotificationsState();

  return {
    ...ui,
    ...wallet,
    connectedWallet: wallet.primaryWallet
      ? {
          address: wallet.primaryWallet.address,
          balanceSol: wallet.primaryWallet.balanceSol,
          label: wallet.primaryWallet.label,
          connectedAt: wallet.primaryWallet.createdAt,
        }
      : null,
    ...notifications,
    overview: [],
    isLoading: false,
    error: null,
  };
}

export function useAppActions() {
  const ui = useUIActions();
  const wallet = useWalletActions();
  const notifications = useNotificationsActions();

  return {
    ...ui,
    ...wallet,
    ...notifications,
    refreshOverview: async () => {},
  };
}

export {
  useUIState,
  useUIActions,
  useWalletState,
  useWalletActions,
  useNotificationsState,
  useNotificationsActions,
  usePreferencesState,
  usePreferencesActions,
};

export {
  useSession,
  useWallets,
  usePrimaryWallet,
  useConnectWallet,
  useDisconnectWallet,
} from '@/lib/hooks/use-auth-hooks';

export { useWatchlist } from './watchlist-store';
export { useTradeHistory } from './trade-history-store';
export { useTokenFilters } from './token-filters-store';

