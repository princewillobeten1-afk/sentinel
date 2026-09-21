'use client';

import React, { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/top-bar';
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer';
import { FooterStatusBar } from '@/components/layout/footer-status-bar';
import { CommandPalette } from '@/components/layout/command-palette';
import { WalletModal } from '@/components/layout/wallet-modal';
import { QuickBuyDrawer } from '@/components/layout/quick-buy-drawer';
import { HotkeyModal } from '@/components/layout/hotkey-modal';
import { NotificationsDrawer } from '@/components/layout/notifications-drawer';
import { ExecutionConsole } from '@/components/layout/execution-console';
import { useAppActions, useAppState, AppView } from '@/lib/store';
import { clsx } from 'clsx';

export interface AppShellProps {
  initialView?: AppView;
  layout?: 'page' | 'workspace';
  children: React.ReactNode;
}

export function AppShell({ initialView, layout = 'page', children }: AppShellProps) {
  const [hydrated, setHydrated] = useState(false);
  const { setActiveView } = useAppActions();
  const { density, activeView } = useAppState();
  const fitted = layout === 'workspace' || (initialView ?? activeView) === 'discover';

  useEffect(() => {
    setHydrated(true);
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialView, setActiveView]);

  return (
    <div
      data-density={density}
      data-hydrated={hydrated}
      data-layout={fitted ? 'workspace' : 'page'}
      className={clsx(
        'terminal-shell bg-sentinel-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30',
        fitted ? 'h-dvh overflow-hidden' : 'min-h-dvh'
      )}
    >
      <a href="#main-content" className="terminal-skip-link">Skip to content</a>
      {/* Axiom-Style Full-Width Header Navigation */}
      <TopBar />

      {/* Core Workspace / Main Page Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className={clsx(
          'terminal-main flex-1 min-w-0 w-full mx-auto',
          fitted ? 'flex min-h-0 overflow-hidden p-2 md:p-3' : 'p-3 sm:p-4 max-w-[1920px]'
        )}
      >
        {children}
      </main>

      {/* Bottom Terminal Status Bar */}
      <FooterStatusBar />

      {/* Mobile Navigation Drawer for Handheld / Smaller Viewports */}
      <MobileNavDrawer />

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

export default AppShell;
