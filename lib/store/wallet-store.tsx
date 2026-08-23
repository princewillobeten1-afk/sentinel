'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  WalletAdapter,
  WalletProviderId,
  LinkedWallet,
  AuthenticatedIdentity,
  ConnectionStatus,
  SIWSChallenge,
  UserPreferences,
} from '@/lib/wallet/types';
import { getAvailableSolanaAdapters } from '@/lib/wallet/solana-adapter';
import { formatSIWSMessage, signatureToBase58 } from '@/lib/wallet/siws';
import { useAppActions } from './index';

export interface QuickBuyTokenData {
  name: string;
  symbol: string;
  mint: string;
  price: string;
  mcap: string;
  customAmountSol?: number;
  customAmountUsd?: number;
}

export type WalletTab = 'overview' | 'deposit' | 'withdraw' | 'history' | 'wallets';

export interface WalletTransactionRecord {
  id: string;
  userId: string;
  walletId: string;
  direction: 'DEPOSIT' | 'WITHDRAWAL' | 'SEND' | 'RECEIVE';
  asset: string;
  amount: number;
  destinationAddress?: string;
  sourceAddress?: string;
  signature: string;
  network: string;
  fee?: number;
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
  createdAt: string;
}

interface WalletState {
  status: ConnectionStatus;
  adapters: WalletAdapter[];
  selectedAdapter: WalletAdapter | null;
  activePublicKey: string | null;
  activeChallenge: SIWSChallenge | null;
  authenticatedIdentity: AuthenticatedIdentity | null;
  linkedWallets: LinkedWallet[];
  primaryWallet: LinkedWallet | null;
  sessionToken: string | null;
  isWalletModalOpen: boolean;
  activeWalletTab: WalletTab;
  isQuickBuyOpen: boolean;
  quickBuyToken: QuickBuyTokenData | null;
  authError: string | null;
  walletTransactions: WalletTransactionRecord[];
}

interface WalletActions {
  setWalletModalOpen: (open: boolean, tab?: WalletTab) => void;
  setActiveWalletTab: (tab: WalletTab) => void;
  setQuickBuyOpen: (open: boolean, token?: QuickBuyTokenData | null) => void;
  connectWallet: (adapterId: WalletProviderId) => Promise<void>;
  authenticateSIWS: () => Promise<void>;
  linkSecondaryWallet: (adapterId: WalletProviderId) => Promise<void>;
  setPrimaryWallet: (walletId: string) => Promise<void>;
  updateWalletLabel: (walletId: string, label: string) => Promise<void>;
  unlinkWallet: (walletId: string) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resetAuthError: () => void;
  depositCrypto: (params: {
    walletId?: string;
    walletAddress: string;
    asset: string;
    amount: number;
    network?: string;
    sourceAddress?: string;
  }) => Promise<{ success: boolean; transaction?: WalletTransactionRecord; error?: string }>;
  withdrawCrypto: (params: {
    walletId?: string;
    walletAddress: string;
    destinationAddress: string;
    asset: string;
    amount: number;
    network?: string;
    priorityFeeTier?: 'normal' | 'fast' | 'turbo';
  }) => Promise<{ success: boolean; signature?: string; error?: string }>;
  fetchWalletTransactions: () => Promise<void>;
}

const WalletStateContext = createContext<WalletState | undefined>(undefined);
const WalletActionsContext = createContext<WalletActions | undefined>(undefined);

const STORAGE_KEY_TOKEN = 'sentinel_session_token';

/**
 * Demo seeding.
 *
 * This store used to boot unconditionally as `authenticated`, with two invented
 * wallets, a `'demo-token'` session and a fabricated `user_001` identity. That
 * made the whole app look signed in to a user who did not exist, and — because
 * `usePrimaryWallet()` reads this store while `useAuth()` reads the real
 * `/api/v1/auth/me` source — every wallet-scoped API call went out with a
 * stranger's address. `7xK99zK8mP2xQ5wN3a19` is not even a valid Solana address
 * (see lib/wallet/__tests__/validation.test.ts), so those calls could only ever
 * 403 or 404.
 *
 * The seed is still useful for demos and screenshots, so it is kept — but only
 * when explicitly asked for, and never by default.
 */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const DEMO_WALLETS: LinkedWallet[] = [
  {
    id: 'w_001',
    address: '7xK99zK8mP2xQ5wN3a19',
    network: 'solana',
    label: 'Phantom Primary',
    isPrimary: true,
    balanceSol: 42.85,
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'w_002',
    address: '3mR88xK1pQ99zW5a71b2',
    network: 'solana',
    label: 'Solflare Trading',
    isPrimary: false,
    balanceSol: 18.4,
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];

export function WalletStoreProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(DEMO_MODE ? 'authenticated' : 'disconnected');
  const [adapters] = useState<WalletAdapter[]>(() => getAvailableSolanaAdapters());
  /**
   * No adapter until the user picks one.
   *
   * This defaulted to `adapters[4]` — the embedded stub, which returns a
   * hardcoded address and a forged signature. So the app booted "holding" a
   * wallet nobody connected, and the first real connect attempt was competing
   * with a selection the user never made.
   */
  const [selectedAdapter, setSelectedAdapter] = useState<WalletAdapter | null>(null);
  const [activePublicKey, setActivePublicKey] = useState<string | null>(DEMO_MODE ? DEMO_WALLETS[0].address : null);
  const [activeChallenge, setActiveChallenge] = useState<SIWSChallenge | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(DEMO_MODE ? 'demo-token' : null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>(DEMO_MODE ? DEMO_WALLETS : []);

  const [authenticatedIdentity, setAuthenticatedIdentity] = useState<AuthenticatedIdentity | null>(
    DEMO_MODE
      ? {
    userId: 'user_001',
    displayName: 'Sentinel Alpha Trader',
    email: 'trader@sentinel.local',
    role: 'user',
    primaryWallet: {
      id: 'w_001',
      address: '7xK99zK8mP2xQ5wN3a19',
      network: 'solana',
      label: 'Phantom Primary',
      isPrimary: true,
      balanceSol: 42.85,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    linkedWallets: [],
    preferences: {
      slippageTolerance: 0.5,
      riskLevel: 'moderate',
      currencyDisplay: 'USD',
      rpcEndpoint: 'mainnet',
      theme: 'dark',
      density: 'standard',
      autoLockMinutes: 30,
      notificationsEnabled: {
        security: true,
        priceAlerts: true,
        tradeExecution: true,
        system: true,
      },
    },
    authenticatedAt: new Date().toISOString(),
  }
      : null,
  );

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [activeWalletTab, setActiveWalletTab] = useState<WalletTab>('overview');
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionRecord[]>([
    {
      id: 'wtx_initial_dep_01',
      userId: 'user_001',
      walletId: 'w_001',
      direction: 'DEPOSIT',
      asset: 'SOL',
      amount: 45.0,
      sourceAddress: 'Binance Hot Wallet (0x3a...binance)',
      destinationAddress: '7xK99zK8mP2xQ5wN3a19',
      signature: '5dep_initial_sig_001',
      network: 'solana',
      status: 'CONFIRMED',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'wtx_initial_with_02',
      userId: 'user_001',
      walletId: 'w_001',
      direction: 'WITHDRAWAL',
      asset: 'SOL',
      amount: 2.15,
      destinationAddress: '8wJ33nN9pQ4xV6bM2c18',
      signature: '5wTx_initial_sig_002',
      network: 'solana',
      fee: 0.000005,
      status: 'CONFIRMED',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ]);
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false);
  const [quickBuyToken, setQuickBuyToken] = useState<QuickBuyTokenData | null>(null);

  const primaryWallet = linkedWallets.find((w) => w.isPrimary) || linkedWallets[0] || null;

  // Restore active session on mount
  useEffect(() => {
    async function recoverSession() {
      const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (!storedToken) return;

      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSessionToken(storedToken);
          setLinkedWallets(data.linkedWallets || []);
          if (data.user && data.primaryWallet) {
            setAuthenticatedIdentity({
              userId: data.user.userId,
              displayName: data.user.displayName || 'Sentinel Trader',
              email: data.user.email,
              role: data.user.role || 'user',
              primaryWallet: data.primaryWallet,
              linkedWallets: data.linkedWallets || [],
              preferences: data.preferences,
              authenticatedAt: new Date().toISOString(),
            });
            setActivePublicKey(data.primaryWallet.address);
            setStatus('authenticated');
          }
        }
      } catch (err) {
        console.warn('[WalletStore] Session recovery skipped or offline.');
      }
    }
    recoverSession();
  }, []);

  const resetAuthError = useCallback(() => setAuthError(null), []);

  const setQuickBuyOpen = useCallback((open: boolean, token?: QuickBuyTokenData | null) => {
    setIsQuickBuyOpen(open);
    if (token !== undefined) setQuickBuyToken(token);
  }, []);

  // Initiate wallet connection & fetch SIWS challenge
  const connectWallet = useCallback(
    async (adapterId: WalletProviderId) => {
      setAuthError(null);
      setStatus('connecting');
      // No silent fallback: connecting to a wallet other than the one the user
      // chose is never the right recovery.
      const adapter = adapters.find((a) => a.id === adapterId);
      if (!adapter) {
        setStatus('error');
        setAuthError(`${adapterId} is not available in this browser.`);
        return;
      }
      setSelectedAdapter(adapter);

      try {
        const publicKey = await adapter.connect();
        setActivePublicKey(publicKey);
        setStatus('authenticating');

        // Fetch SIWS challenge from backend
        const res = await fetch('/api/v1/auth/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey, network: 'solana:mainnet' }),
        });

        const challengeBody = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            challengeBody?.error?.message || 'Failed to request an authentication challenge.',
          );
        }
        // The API answers through the `{ success, data }` envelope.
        const challenge = challengeBody?.data?.challenge ?? challengeBody?.challenge;
        if (!challenge) throw new Error('Server returned no authentication challenge.');
        setActiveChallenge(challenge);
      } catch (err: any) {
        setStatus('error');
        setAuthError(err.message || 'Failed to connect wallet.');
      }
    },
    [adapters]
  );

  // Authenticate SIWS challenge signature
  const authenticateSIWS = useCallback(async () => {
    if (!selectedAdapter || !activePublicKey || !activeChallenge) {
      setAuthError('No active challenge ready for signing.');
      return;
    }

    setAuthError(null);
    setStatus('authenticating');

    try {
      const messageBytes = new TextEncoder().encode(activeChallenge.formattedMessage);
      const signatureBytes = await selectedAdapter.signMessage(messageBytes);
      const signatureBase58 = signatureToBase58(signatureBytes);

      const res = await fetch('/api/v1/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: activePublicKey,
          signature: signatureBase58,
          nonce: activeChallenge.nonce,
          message: activeChallenge.formattedMessage,
          label: selectedAdapter.name,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Authentication failed.');
      }

      const data = await res.json();
      setSessionToken(data.token);
      localStorage.setItem(STORAGE_KEY_TOKEN, data.token);

      setLinkedWallets(data.linkedWallets || []);
      setAuthenticatedIdentity({
        userId: data.user.userId,
        displayName: data.user.displayName || 'Sentinel Trader',
        email: data.user.email,
        role: data.user.role || 'user',
        primaryWallet: data.primaryWallet,
        linkedWallets: data.linkedWallets || [],
        preferences: data.preferences,
        authenticatedAt: new Date().toISOString(),
      });

      setStatus('authenticated');
      setActiveChallenge(null);
    } catch (err: any) {
      setStatus('error');
      setAuthError(err.message || 'SIWS Signature authentication failed.');
    }
  }, [selectedAdapter, activePublicKey, activeChallenge]);

  // Link secondary wallet
  const linkSecondaryWallet = useCallback(
    async (adapterId: WalletProviderId) => {
      if (!sessionToken) {
        setAuthError('You must be logged in to link additional wallets.');
        return;
      }

      const adapter = adapters.find((a) => a.id === adapterId) || adapters[0];
      try {
        const pubKey = await adapter.connect();

        const chRes = await fetch('/api/v1/auth/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: pubKey }),
        });

        if (!chRes.ok) throw new Error('Challenge request failed.');
        const chData = await chRes.json();

        const messageBytes = new TextEncoder().encode(chData.challenge.formattedMessage);
        const signatureBytes = await adapter.signMessage(messageBytes);
        const sigBase58 = signatureToBase58(signatureBytes);

        const linkRes = await fetch('/api/v1/user/wallets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            publicKey: pubKey,
            signature: sigBase58,
            nonce: chData.challenge.nonce,
            message: chData.challenge.formattedMessage,
            label: adapter.name,
          }),
        });

        if (!linkRes.ok) {
          const err = await linkRes.json();
          throw new Error(err.error?.message || 'Failed to link secondary wallet.');
        }

        const data = await linkRes.json();
        setLinkedWallets(data.wallets);
      } catch (err: any) {
        setAuthError(err.message || 'Could not link wallet.');
      }
    },
    [adapters, sessionToken]
  );

  // Set primary wallet
  const setPrimaryWallet = useCallback(
    async (walletId: string) => {
      setLinkedWallets((prev) =>
        prev.map((w) => ({
          ...w,
          isPrimary: w.id === walletId,
        }))
      );

      if (sessionToken) {
        try {
          await fetch(`/api/v1/user/wallets/${walletId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ isPrimary: true }),
          });
        } catch (err) {
          // Keep local state update
        }
      }
    },
    [sessionToken]
  );

  // Update wallet label
  const updateWalletLabel = useCallback(
    async (walletId: string, label: string) => {
      setLinkedWallets((prev) =>
        prev.map((w) => (w.id === walletId ? { ...w, label } : w))
      );

      if (sessionToken) {
        try {
          await fetch(`/api/v1/user/wallets/${walletId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ label }),
          });
        } catch (err) {
          // Keep local state update
        }
      }
    },
    [sessionToken]
  );

  // Unlink secondary wallet
  const unlinkWallet = useCallback(
    async (walletId: string) => {
      if (linkedWallets.length <= 1) {
        setAuthError('Cannot unlink sole primary wallet.');
        return;
      }

      setLinkedWallets((prev) => prev.filter((w) => w.id !== walletId));

      if (sessionToken) {
        try {
          await fetch(`/api/v1/user/wallets/${walletId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${sessionToken}` },
          });
        } catch (err) {
          // Keep local state update
        }
      }
    },
    [linkedWallets, sessionToken]
  );

  // Disconnect wallet & logout
  const disconnectWallet = useCallback(async () => {
    if (selectedAdapter) {
      await selectedAdapter.disconnect();
    }
    if (sessionToken) {
      try {
        await fetch('/api/v1/auth/logout', { method: 'POST' });
      } catch (err) {
        // Ignore
      }
    }

    localStorage.removeItem(STORAGE_KEY_TOKEN);
    setSessionToken(null);
    setAuthenticatedIdentity(null);
    setActivePublicKey(null);
    setActiveChallenge(null);
    setStatus('disconnected');
    setIsWalletModalOpen(false);
  }, [selectedAdapter, sessionToken]);

  // Listen for external wallet account change events
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).solana || typeof (window as any).solana.on !== 'function') return;

    const handleAccountChange = (publicKey: any) => {
      const newAddress = publicKey ? (publicKey.toBase58 ? publicKey.toBase58() : String(publicKey)) : null;
      if (newAddress && activePublicKey && newAddress.toLowerCase() !== activePublicKey.toLowerCase()) {
        setActivePublicKey(newAddress);
        setStatus('connecting');
        setAuthError('Wallet account changed externally. Re-authentication required.');
      }
    };

    (window as any).solana.on('accountChanged', handleAccountChange);
    return () => {
      if ((window as any).solana && typeof (window as any).solana.removeListener === 'function') {
        (window as any).solana.removeListener('accountChanged', handleAccountChange);
      }
    };
  }, [activePublicKey]);

  // Account Deletion Workflow
  const deleteAccount = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch('/api/v1/user/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ confirmDelete: true }),
      });
      if (res.ok) {
        await disconnectWallet();
      }
    } catch (err) {
      await disconnectWallet();
    }
  }, [sessionToken, disconnectWallet]);

  const setWalletModalOpenWithTab = useCallback((open: boolean, tab?: WalletTab) => {
    setIsWalletModalOpen(open);
    if (tab) {
      setActiveWalletTab(tab);
    }
  }, []);

  // Fetch transaction history
  const fetchWalletTransactions = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
      const res = await fetch('/api/v1/wallets/transactions', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.transactions && Array.isArray(data.transactions)) {
          setWalletTransactions(data.transactions);
        }
      }
    } catch {
      // Fallback
    }
  }, [sessionToken]);

  // Deposit Crypto
  const depositCrypto = useCallback(
    async (params: {
      walletId?: string;
      walletAddress: string;
      asset: string;
      amount: number;
      network?: string;
      sourceAddress?: string;
    }) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

        const res = await fetch('/api/v1/wallets/deposit', {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error?.message || 'Deposit simulation failed' };
        }

        // Update local wallet balance state
        setLinkedWallets((prev) =>
          prev.map((w) => {
            if (w.address.toLowerCase() === params.walletAddress.toLowerCase()) {
              const delta = params.asset.toUpperCase() === 'SOL' ? params.amount : 0;
              return { ...w, balanceSol: Number((w.balanceSol + delta).toFixed(4)) };
            }
            return w;
          })
        );

        setWalletTransactions((prev) => [data, ...prev]);
        return { success: true, transaction: data };
      } catch (err: any) {
        return { success: false, error: err.message || 'Deposit network error' };
      }
    },
    [sessionToken]
  );

  // Withdraw Crypto
  const withdrawCrypto = useCallback(
    async (params: {
      walletId?: string;
      walletAddress: string;
      destinationAddress: string;
      asset: string;
      amount: number;
      network?: string;
      priorityFeeTier?: 'normal' | 'fast' | 'turbo';
    }) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

        const res = await fetch('/api/v1/wallets/withdraw', {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error?.message || 'Withdrawal failed' };
        }

        // Update local wallet balance state
        setLinkedWallets((prev) =>
          prev.map((w) => {
            if (w.address.toLowerCase() === params.walletAddress.toLowerCase()) {
              const delta = params.asset.toUpperCase() === 'SOL' ? params.amount + (data.fee || 0.000005) : 0;
              return { ...w, balanceSol: Math.max(0, Number((w.balanceSol - delta).toFixed(4))) };
            }
            return w;
          })
        );

        const newTx: WalletTransactionRecord = {
          id: data.transactionId,
          userId: 'user_001',
          walletId: params.walletId || 'w_001',
          direction: 'WITHDRAWAL',
          asset: params.asset,
          amount: params.amount,
          destinationAddress: params.destinationAddress,
          signature: data.signature,
          network: params.network || 'solana',
          fee: data.fee,
          status: 'CONFIRMED',
          createdAt: data.timestamp || new Date().toISOString(),
        };

        setWalletTransactions((prev) => [newTx, ...prev]);
        return { success: true, signature: data.signature };
      } catch (err: any) {
        return { success: false, error: err.message || 'Withdrawal network error' };
      }
    },
    [sessionToken]
  );

  return (
    <WalletStateContext.Provider
      value={{
        status,
        adapters,
        selectedAdapter,
        activePublicKey,
        activeChallenge,
        authenticatedIdentity,
        linkedWallets,
        primaryWallet,
        sessionToken,
        isWalletModalOpen,
        activeWalletTab,
        isQuickBuyOpen,
        quickBuyToken,
        authError,
        walletTransactions,
      }}
    >
      <WalletActionsContext.Provider
        value={{
          setWalletModalOpen: setWalletModalOpenWithTab,
          setActiveWalletTab,
          setQuickBuyOpen,
          connectWallet,
          authenticateSIWS,
          linkSecondaryWallet,
          setPrimaryWallet,
          updateWalletLabel,
          unlinkWallet,
          disconnectWallet,
          deleteAccount,
          resetAuthError,
          depositCrypto,
          withdrawCrypto,
          fetchWalletTransactions,
        }}
      >
        {children}
      </WalletActionsContext.Provider>
    </WalletStateContext.Provider>
  );
}

export function useWalletState() {
  const context = useContext(WalletStateContext);
  if (!context) throw new Error('useWalletState must be used within WalletStoreProvider');
  return context;
}

export function useWalletActions() {
  const context = useContext(WalletActionsContext);
  if (!context) throw new Error('useWalletActions must be used within WalletStoreProvider');
  return context;
}
