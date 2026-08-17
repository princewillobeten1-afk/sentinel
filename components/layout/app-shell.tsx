'use client';

import React, { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { FooterStatusBar } from '@/components/layout/footer-status-bar';
import { CommandPalette } from '@/components/layout/command-palette';
import { WalletModal } from '@/components/layout/wallet-modal';
import { QuickBuyDrawer } from '@/components/layout/quick-buy-drawer';
import { HotkeyModal } from '@/components/layout/hotkey-modal';
import { NotificationsDrawer } from '@/components/layout/notifications-drawer';
import { ExecutionConsole } from '@/components/layout/execution-console';
import { useAppActions, AppView } from '@/lib/store';

export interface AppShellProps {
  initialView?: AppView;
  children: React.ReactNode;
}

export function AppShell({ initialView, children }: AppShellProps) {
  const { setActiveView } = useAppActions();

  useEffect(() => {
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialView, setActiveView]);

  return (
    <div className="min-h-screen bg-sentinel-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      <div className="flex min-h-screen w-full flex-1 min-w-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Application Container */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header Top Bar */}
          <TopBar />

          {/* Core Content Area - Optimized for 100% Laptop Zoom */}
          <main className="flex-1 p-3 sm:p-4 lg:p-5 max-w-[1680px] w-full mx-auto">
            {children}
          </main>

          {/* Bottom Terminal Status Bar */}
          <FooterStatusBar />
        </div>
      </div>

      {/* Global Modals & Drawers */}
      <CommandPalette />
      <WalletModal />
      <QuickBuyDrawer />
      <HotkeyModal />
      <NotificationsDrawer />
      <ExecutionConsole />
    </div>
  );
}
