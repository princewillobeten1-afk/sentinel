'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Wallet, UserSession } from '@/lib/auth/types';

interface AuthContextValue {
  user: User | null;
  session: UserSession | null;
  wallets: Wallet[];
  primaryWallet: Wallet | null;
  status: 'UNKNOWN' | 'AUTHENTICATED' | 'UNAUTHENTICATED';
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  connectWallet: (walletAddress: string, chainId: string, signature: string, challengeId: string) => Promise<void>;
  disconnectWallet: (walletId: string) => Promise<void>;
  setDefaultWallet: (walletId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [status, setStatus] = useState<'UNKNOWN' | 'AUTHENTICATED' | 'UNAUTHENTICATED'>('UNKNOWN');
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setWallets(data.linkedWallets || []);
        setStatus('AUTHENTICATED');
      } else {
        setUser(null);
        setWallets([]);
        setStatus('UNAUTHENTICATED');
      }
    } catch {
      setUser(null);
      setWallets([]);
      setStatus('UNAUTHENTICATED');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || error.message || 'Login failed');
      }

      const data = await res.json();
      setUser(data.user);
      setSession(data.session);
      setStatus('AUTHENTICATED');
      await refreshProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || error.message || 'Registration failed');
      }

      const data = await res.json();
      setUser(data.user);
      setSession(data.session);
      setStatus('AUTHENTICATED');
      await refreshProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      setSession(null);
      setWallets([]);
      setStatus('UNAUTHENTICATED');
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async (walletAddress: string, chainId: string, signature: string, challengeId: string) => {
    const res = await fetch('/api/v1/wallets/connect/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, signature }),
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || error.message || 'Failed to verify wallet');
    }

    await refreshProfile();
  };

  const disconnectWallet = async (walletId: string) => {
    const res = await fetch(`/api/v1/wallets/${walletId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || error.message || 'Failed to disconnect wallet');
    }

    await refreshProfile();
  };

  const setDefaultWallet = async (walletId: string) => {
    const res = await fetch(`/api/v1/wallets/${walletId}/default`, {
      method: 'PATCH',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || error.message || 'Failed to set default wallet');
    }

    await refreshProfile();
  };

  const primaryWallet = wallets.find((w) => w.isPrimary) || wallets[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        wallets,
        primaryWallet,
        status,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        connectWallet,
        disconnectWallet,
        setDefaultWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
