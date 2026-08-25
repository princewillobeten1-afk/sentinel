'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Wallet,
  Compass,
  PieChart,
  Bookmark,
  ShieldAlert,
  Rocket,
  BrainCircuit,
  Sparkles,
  BarChart3,
  Settings,
  Code2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useAppState, useAppActions, AppView } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { useGlobalTicker } from '@/lib/hooks/use-global-ticker';
import { Tooltip } from '@/components/ui/tooltip';
import { Drawer } from '@/components/ui/drawer';

export interface NavItemConfig {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hotkey?: string;
  badge?: string;
  badgeVariant?: 'info' | 'warning' | 'danger' | 'success' | 'cyan' | 'purple';
}

export const viewRouteMap: Record<AppView, string> = {
  dashboard: '/terminal',
  trade: '/trade',
  discover: '/discover',
  portfolio: '/portfolio',
  watchlist: '/watchlist',
  alerts: '/alerts',
  launchpad: '/launchpad',
  intelligence: '/intelligence',
  ai: '/ai',
  analytics: '/analytics',
  admin: '/admin',
  developers: '/developers',
  settings: '/settings',
  help: '/help',
};

export const mainNavItems: NavItemConfig[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, hotkey: 'G H' },
  { id: 'trade', label: 'Trade', icon: Wallet, hotkey: 'G T' },
  { id: 'discover', label: 'Discover', icon: Compass, hotkey: 'G D', badge: 'LIVE', badgeVariant: 'cyan' },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart, hotkey: 'G P' },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark, hotkey: 'G W' },
  // No badge literal here. It read '4' unconditionally — for signed-out
  // visitors, and while the Overview reported "0 Flagged — Clear" on the same
  // screen. The real count is injected at render from useGlobalTicker.
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert, hotkey: 'G A', badgeVariant: 'danger' },
  { id: 'launchpad', label: 'Launchpad', icon: Rocket, hotkey: 'G L' },
  { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit, hotkey: 'G I' },
  { id: 'ai', label: 'AI Co-Pilot', icon: Sparkles, hotkey: 'G AI', badge: 'NEW', badgeVariant: 'purple' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hotkey: 'G AN' },
];

export const lowerNavItems: NavItemConfig[] = [
  { id: 'admin', label: 'Admin Ops', icon: ShieldCheck, hotkey: 'G ADM', badge: 'OPS', badgeVariant: 'warning' },
  { id: 'developers', label: 'Developers', icon: Code2, hotkey: 'G DEV' },
  { id: 'settings', label: 'Settings', icon: Settings, hotkey: 'G S' },
  { id: 'help', label: 'Help & Docs', icon: HelpCircle, hotkey: 'G ?' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { activeView, isSidebarCollapsed, isMobileNavOpen, connectedWallet, primaryWallet } = useAppState();
  const { setActiveView, toggleSidebar, setMobileNavOpen } = useAppActions();

  const activeWallet = primaryWallet || connectedWallet;

  /**
   * Real unread critical/high alert count, from the same source the Overview
   * tile reads. Null when signed out or unavailable — and null renders no
   * badge at all, rather than the literal '4' that used to sit here while the
   * Overview said "0 Flagged" two inches away.
   */
  const { threatCount } = useGlobalTicker();

  // Keep activeView synchronized with current browser URL path
  useEffect(() => {
    if (!pathname) return;
    for (const [view, route] of Object.entries(viewRouteMap)) {
      if (pathname === route || (route !== '/' && pathname.startsWith(route))) {
        setActiveView(view as AppView);
        break;
      }
    }
  }, [pathname, setActiveView]);

  const renderNavButton = (item: NavItemConfig) => {
    const isActive = activeView === item.id;
    // Alerts carries a measured count; everything else keeps its static label.
    const badge =
      item.id === 'alerts'
        ? threatCount && threatCount > 0
          ? String(threatCount)
          : undefined
        : item.badge;
    const target = viewRouteMap[item.id] || `/${item.id}`;
    const btn = (
      <Link
        key={item.id}
        href={target}
        prefetch={true}
        onClick={() => {
          setActiveView(item.id);
          setMobileNavOpen(false);
        }}
        className={clsx(
          'w-full flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-150 text-xs select-none group',
          isActive
            ? 'bg-gradient-to-r from-sky-500/20 via-sky-500/5 to-transparent text-white font-bold border-l-2 border-l-sky-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100 font-medium'
        )}
      >
        <div className="flex items-center gap-2.5">
          <item.icon
            className={clsx(
              'h-4 w-4 shrink-0 transition-all duration-150',
              isActive ? 'text-sky-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]' : 'text-slate-400 group-hover:text-sky-300'
            )}
          />
          {!isSidebarCollapsed && <span className="tracking-wide">{item.label}</span>}
        </div>

        {!isSidebarCollapsed && (
          <div className="flex items-center gap-1.5">
            {badge && (
              <Badge variant={item.badgeVariant || 'neutral'} size="sm">
                {badge}
              </Badge>
            )}
          </div>
        )}
      </Link>
    );

    if (isSidebarCollapsed) {
      return (
        <Tooltip key={item.id} content={`${item.label} (${item.hotkey || ''})`} position="right">
          {btn}
        </Tooltip>
      );
    }

    return btn;
  };

  return (
    <>
      {/* Desktop Navigation Sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col border-r border-white/[0.08] bg-sentinel-950/80 backdrop-blur-3xl transition-all duration-200 z-20 sticky top-0 h-screen select-none overflow-y-auto no-scrollbar',
          isSidebarCollapsed ? 'w-16 px-2 py-3' : 'w-52 xl:w-56 px-3 py-3'
        )}
      >
        {/* Header Logo */}
        <div className="flex items-center justify-between mb-3 px-1">
          <Link
            href="/discover"
            prefetch={true}
            onClick={() => {
              setActiveView('discover');
              setMobileNavOpen(false);
            }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/30 to-emerald-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_12px_rgba(0,240,255,0.3)] group-hover:scale-105 transition-transform shrink-0">
              <Zap className="h-4 w-4 fill-current text-sky-400" />
            </div>
            {!isSidebarCollapsed && (
              <div>
                <p className="text-2xs uppercase font-bold tracking-[0.14em] text-slate-400 whitespace-nowrap">PROJECT</p>
                <h1 className="text-sm font-extrabold text-white tracking-wider">SENTINEL</h1>
              </div>
            )}
          </Link>

          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1 text-slate-400 hover:bg-sentinel-850 hover:text-slate-200 transition"
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Main Navigation Items */}
        <div className="space-y-0.5 flex-1">
          {!isSidebarCollapsed && (
            <p className="px-2.5 py-1 label-micro whitespace-nowrap">
              Main Terminal
            </p>
          )}
          {mainNavItems.map(renderNavButton)}
        </div>

        {/* Lower Section (Settings & Help) */}
        <div className="pt-2.5 mt-2 border-t border-sentinel-800/80 space-y-0.5">
          {!isSidebarCollapsed && (
            <p className="px-2.5 py-1 label-micro whitespace-nowrap">
              Preferences & Docs
            </p>
          )}
          {lowerNavItems.map(renderNavButton)}
        </div>

        {/* Wallet Account Status Box */}
        {!isSidebarCollapsed && (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-sentinel-900/80 p-2.5 text-slate-300 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 text-2xs uppercase font-mono text-slate-400 mb-1">
              <span className="shrink-0">Network</span>
              <span className="text-emerald-400 flex items-center gap-1 font-bold min-w-0">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span className="truncate">Solana Mainnet</span>
              </span>
            </div>
            {activeWallet ? (
              <div className="flex items-center justify-between font-numeric mt-1">
                <div>
                  <p className="text-xs font-bold text-white font-mono">{activeWallet.address.slice(0, 4)}...{activeWallet.address.slice(-4)}</p>
                  <p className="text-[11px] text-emerald-400 font-bold">{activeWallet.balanceSol.toFixed(2)} SOL</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-status-pulse shadow-[0_0_8px_rgba(0,229,153,0.8)]" />
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mt-1">No Wallet Connected</p>
            )}
          </div>
        )}
      </aside>

      {/* Mobile Navigation Drawer */}
      <Drawer
        isOpen={isMobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        position="left"
        title={
          <span className="flex items-center gap-2 text-sky-400 font-bold text-sm">
            <Zap className="h-4 w-4 fill-current" /> SENTINEL MOBILE NAV
          </span>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="px-2 py-1 label-micro whitespace-nowrap">
              Main Terminal
            </p>
            {mainNavItems.map((item) => {
              const isActive = activeView === item.id;
              const target = viewRouteMap[item.id] || `/${item.id}`;
              return (
                <Link
                  key={item.id}
                  href={target}
                  prefetch={true}
                  onClick={() => {
                    setActiveView(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center justify-between rounded-xl p-2.5 text-xs font-medium transition',
                    isActive ? 'bg-sky-500/15 text-white font-bold border border-sky-500/30' : 'text-slate-300 hover:bg-sentinel-850'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-sky-400" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && <Badge variant={item.badgeVariant || 'neutral'}>{item.badge}</Badge>}
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-sentinel-800 space-y-1">
            <p className="px-2 py-1 label-micro whitespace-nowrap">
              System
            </p>
            {lowerNavItems.map((item) => {
              const target = viewRouteMap[item.id] || `/${item.id}`;
              return (
                <Link
                  key={item.id}
                  href={target}
                  prefetch={true}
                  onClick={() => {
                    setActiveView(item.id);
                    setMobileNavOpen(false);
                  }}
                  className="w-full flex items-center gap-3 rounded-xl p-2.5 text-xs font-medium text-slate-300 hover:bg-sentinel-850"
                >
                  <item.icon className="h-4 w-4 text-slate-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </Drawer>
    </>
  );
}
