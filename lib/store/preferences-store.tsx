'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserPreferences } from '@/lib/wallet/types';
import { useWalletState } from './wallet-store';

interface PreferencesState {
  preferences: UserPreferences;
  isSaving: boolean;
}

interface PreferencesActions {
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}

const PreferencesStateContext = createContext<PreferencesState | undefined>(undefined);
const PreferencesActionsContext = createContext<PreferencesActions | undefined>(undefined);

const defaultPreferences: UserPreferences = {
  slippageTolerance: 0.5,
  riskLevel: 'moderate',
  currencyDisplay: 'USD',
  rpcEndpoint: 'mainnet',
  theme: 'dark',
  density: 'standard',
  reducedMotion: false,
  autoLockMinutes: 30,
  notificationsEnabled: {
    security: true,
    priceAlerts: true,
    tradeExecution: true,
    system: true,
  },
};

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { sessionToken, authenticatedIdentity } = useWalletState();
  const [preferences, setPreferences] = useState<UserPreferences>(
    authenticatedIdentity?.preferences || defaultPreferences
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (authenticatedIdentity?.preferences) {
      setPreferences(authenticatedIdentity.preferences);
    }
  }, [authenticatedIdentity]);

  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      setIsSaving(true);
      setPreferences((prev) => ({
        ...prev,
        ...updates,
        notificationsEnabled: {
          ...prev.notificationsEnabled,
          ...(updates.notificationsEnabled || {}),
        },
      }));

      if (sessionToken) {
        try {
          await fetch('/api/v1/user/preferences', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify(updates),
          });
        } catch (err) {
          console.warn('[PreferencesProvider] API sync failed, cached locally.');
        }
      }

      setIsSaving(false);
    },
    [sessionToken]
  );

  return (
    <PreferencesStateContext.Provider value={{ preferences, isSaving }}>
      <PreferencesActionsContext.Provider value={{ updatePreferences }}>
        {children}
      </PreferencesActionsContext.Provider>
    </PreferencesStateContext.Provider>
  );
}

export function usePreferencesState() {
  const context = useContext(PreferencesStateContext);
  if (!context) throw new Error('usePreferencesState must be used within PreferencesProvider');
  return context;
}

export function usePreferencesActions() {
  const context = useContext(PreferencesActionsContext);
  if (!context) throw new Error('usePreferencesActions must be used within PreferencesProvider');
  return context;
}
