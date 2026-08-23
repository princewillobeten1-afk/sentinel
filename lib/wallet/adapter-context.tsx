'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { blockchainProvider } from '@/lib/blockchain/provider';

/**
 * Real Solana wallet connection for the deposit/withdraw feature —
 * deliberately separate from `lib/wallet/solana-adapter.ts`'s hand-rolled
 * `SolanaWalletAdapterImpl` (which stays in place for the existing SIWS
 * ownership-proof flow only). Anything that touches a real balance read or
 * a real transaction — receive/send UI — uses `useWallet()`/`useConnection()`
 * from this provider, never the hand-rolled adapter, which fabricates fake
 * public keys/signatures when no extension is installed and must never be
 * reachable from a real-money code path.
 *
 * `PhantomWalletAdapter`/`SolflareWalletAdapter` are registered as an
 * explicit fallback for older extension versions; any Wallet-Standard-
 * compliant extension (Phantom, Solflare, and Backpack all qualify) also
 * auto-registers into `useWallet()`'s `wallets` array with no adapter
 * package needed — Phantom and Solflare are the supported wallets
 * package, Backpack is Standard-only.
 */
export function SolanaWalletAdapterProviders({ children }: { children: React.ReactNode }) {
  const endpoint = blockchainProvider.getRpcUrl();
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
