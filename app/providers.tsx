'use client';

import { AppStateProvider } from '@/lib/store';
import { SolanaWalletAdapterProviders } from '@/lib/wallet/adapter-context';
import { AuthProvider } from '@/components/auth/auth-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletAdapterProviders>
      <AppStateProvider>
        <AuthProvider>{children}</AuthProvider>
      </AppStateProvider>
    </SolanaWalletAdapterProviders>
  );
}
