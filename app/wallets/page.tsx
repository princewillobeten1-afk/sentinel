'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { WalletTrackerView } from '@/components/views/wallet-tracker-view';

export default function WalletsPage() {
  return (
    <AppShell initialView="wallets" layout="workspace">
      <WalletTrackerView />
    </AppShell>
  );
}
