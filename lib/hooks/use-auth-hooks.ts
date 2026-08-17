'use client';

import { useWalletState, useWalletActions } from '@/lib/store/wallet-store';

/**
 * Typed hook for accessing active session identity, authentication state, and token.
 */
export function useSession() {
  const { status, authenticatedIdentity, sessionToken, authError } = useWalletState();
  return {
    isAuthenticated: status === 'authenticated',
    isAuthenticating: status === 'authenticating' || status === 'connecting',
    status,
    user: authenticatedIdentity,
    token: sessionToken,
    error: authError,
  };
}

/**
 * Typed hook for accessing linked wallets list.
 */
export function useWallets() {
  const { linkedWallets } = useWalletState();
  const { linkSecondaryWallet, updateWalletLabel, unlinkWallet, setPrimaryWallet } = useWalletActions();

  return {
    wallets: linkedWallets,
    linkWallet: linkSecondaryWallet,
    renameWallet: updateWalletLabel,
    unlinkWallet,
    setPrimaryWallet,
  };
}

/**
 * Typed hook for retrieving current primary wallet.
 */
export function usePrimaryWallet() {
  const { primaryWallet } = useWalletState();
  return {
    primaryWallet,
    address: primaryWallet?.address || null,
    balanceSol: primaryWallet?.balanceSol || 0,
    label: primaryWallet?.label || 'Not Connected',
  };
}

/**
 * Typed hook for opening wallet connection UI and triggering provider connections.
 */
export function useConnectWallet() {
  const { connectWallet, authenticateSIWS, setWalletModalOpen, resetAuthError } = useWalletActions();
  const { status, adapters, selectedAdapter, isWalletModalOpen } = useWalletState();

  return {
    isOpen: isWalletModalOpen,
    openModal: () => setWalletModalOpen(true),
    closeModal: () => setWalletModalOpen(false),
    adapters,
    selectedAdapter,
    connect: connectWallet,
    authenticate: authenticateSIWS,
    resetError: resetAuthError,
    status,
  };
}

/**
 * Typed hook for disconnecting wallet and revoking session.
 */
export function useDisconnectWallet() {
  const { disconnectWallet } = useWalletActions();
  return {
    disconnect: disconnectWallet,
  };
}
