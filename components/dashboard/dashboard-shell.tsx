'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useAppState } from '@/lib/store';

/**
 * Shared fallback while a tab's code chunk loads (Sprint 31 — Item 8). Every
 * view below is code-split via `next/dynamic` — before this, all 13 tabs'
 * JS loaded eagerly into the initial `/terminal` bundle regardless of which
 * one was actually active.
 */
function ViewLoadingFallback() {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-24 text-slate-400">
      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading workspace…</span>
    </div>
  );
}

const DashboardView = dynamic(() => import('@/components/views/dashboard-view').then((m) => m.DashboardView), {
  loading: ViewLoadingFallback,
});
const TradeView = dynamic(() => import('@/components/views/trade-view').then((m) => m.TradeView), {
  loading: ViewLoadingFallback,
});
const DiscoverView = dynamic(() => import('@/components/views/discover-view').then((m) => m.DiscoverView), {
  loading: ViewLoadingFallback,
});
const PortfolioView = dynamic(() => import('@/components/views/portfolio-view').then((m) => m.PortfolioView), {
  loading: ViewLoadingFallback,
});
const WatchlistView = dynamic(() => import('@/components/views/watchlist-view').then((m) => m.WatchlistView), {
  loading: ViewLoadingFallback,
});
const AlertsView = dynamic(() => import('@/components/views/alerts-view').then((m) => m.AlertsView), {
  loading: ViewLoadingFallback,
});
const LaunchpadView = dynamic(() => import('@/components/views/launchpad-view').then((m) => m.LaunchpadView), {
  loading: ViewLoadingFallback,
});
const IntelligenceView = dynamic(() => import('@/components/views/intelligence-view').then((m) => m.IntelligenceView), {
  loading: ViewLoadingFallback,
});
const AiView = dynamic(() => import('@/components/views/ai-view').then((m) => m.AiView), {
  loading: ViewLoadingFallback,
});
const AnalyticsView = dynamic(() => import('@/components/views/analytics-view').then((m) => m.AnalyticsView), {
  loading: ViewLoadingFallback,
});
const SettingsView = dynamic(() => import('@/components/views/settings-view').then((m) => m.SettingsView), {
  loading: ViewLoadingFallback,
});
const DeveloperDashboardView = dynamic(
  () => import('@/components/views/developer-dashboard-view').then((m) => m.DeveloperDashboardView),
  { loading: ViewLoadingFallback },
);
const HelpView = dynamic(() => import('@/components/views/help-view').then((m) => m.HelpView), {
  loading: ViewLoadingFallback,
});
const AdminView = dynamic(() => import('@/components/views/admin-view').then((m) => m.AdminView), {
  loading: ViewLoadingFallback,
});

export function DashboardShell() {
  const { activeView } = useAppState();

  return (
    <div data-active-view={activeView} className={activeView === 'discover' ? 'flex flex-col w-full flex-1 min-w-0 min-h-0 h-full' : 'w-full min-w-0 flex-1'}>
      {activeView === 'dashboard' && <DashboardView />}
      {activeView === 'trade' && <TradeView />}
      {activeView === 'discover' && <DiscoverView />}
      {activeView === 'portfolio' && <PortfolioView />}
      {activeView === 'watchlist' && <WatchlistView />}
      {activeView === 'alerts' && <AlertsView />}
      {activeView === 'launchpad' && <LaunchpadView />}
      {activeView === 'intelligence' && <IntelligenceView />}
      {activeView === 'ai' && <AiView />}
      {activeView === 'analytics' && <AnalyticsView />}
      {activeView === 'settings' && <SettingsView />}
      {activeView === 'developers' && <DeveloperDashboardView />}
      {activeView === 'help' && <HelpView />}
      {activeView === 'admin' && <AdminView />}
    </div>
  );
}
