'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Search,
  Wallet,
  Zap,
  Bell,
  Sliders,
  Menu,
  ShieldAlert,
  Compass,
  LayoutDashboard,
  PieChart,
  Bookmark,
  Rocket,
  BrainCircuit,
  Sparkles,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { Popover } from '@/components/ui/popover';
import { UserProfilePopover } from '@/components/layout/user-profile-popover';
import { NetworkSelectorPopover } from '@/components/layout/network-selector-popover';
import { useAppState, useAppActions, DensityMode, AppView } from '@/lib/store';
import { useGlobalTicker } from '@/lib/hooks/use-global-ticker';
import { useMarketSummary } from '@/lib/hooks/use-market-summary';
import { viewRouteMap, NavItemConfig } from '@/components/layout/mobile-nav-drawer';

export const primaryNavItems: NavItemConfig[] = [
  { id: 'discover', label: 'Discover', icon: Compass, hotkey: 'G D' },
  { id: 'trade', label: 'Trade', icon: Wallet, hotkey: 'G T' },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart, hotkey: 'G P' },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark, hotkey: 'G W' },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert, hotkey: 'G A', badgeVariant: 'danger' },
];

export const secondaryNavItems: NavItemConfig[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, hotkey: 'G H' },
  { id: 'launchpad', label: 'Launchpad', icon: Rocket, hotkey: 'G L' },
  { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit, hotkey: 'G I' },
  { id: 'ai', label: 'AI Co-Pilot', icon: Sparkles, hotkey: 'G AI' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hotkey: 'G AN' },
  { id: 'settings', label: 'Settings', icon: Settings, hotkey: 'G S' },
  { id: 'help', label: 'Help & Docs', icon: HelpCircle, hotkey: 'G ?' },
];

export function TopBar() {
  const pathname = usePathname();
  const { density, notifications, isMobileNavOpen, primaryWallet, activeView } = useAppState();
  const {
    setDensity,
    setActiveView,
    setMobileNavOpen,
    setCommandPaletteOpen,
    setQuickBuyOpen,
    setNotificationsOpen,
    setWalletModalOpen,
  } = useAppActions();

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const cycleDensity = () => {
    const modes: DensityMode[] = ['compact', 'standard', 'spacious'];
    const nextIdx = (modes.indexOf(density) + 1) % modes.length;
    setDensity(modes[nextIdx]);
  };

  const { threatCount } = useGlobalTicker();
  const { marketSummary } = useMarketSummary();

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

  const tick = '—';
  const isSecondaryActive = secondaryNavItems.some((item) => item.id === activeView);

  return (
    <header className="terminal-header sticky top-0 z-30 flex shrink-0 min-w-0 flex-col border-b border-sentinel-700 bg-sentinel-950/95 backdrop-blur-md select-none">
      {/* Upper Global Market Ticker Ribbon */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 sm:px-4 py-1 text-[11px] font-numeric text-slate-400 bg-black/40">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
          {/* Network Popover Dropdown */}
          <NetworkSelectorPopover />

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-500 font-mono text-2xs">SOL:</span>
            <span className="font-bold text-white">
              {marketSummary?.solPriceUsd == null
                ? tick
                : `$${marketSummary.solPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </span>
            {marketSummary?.solChange24h != null && (
              <span
                className={clsx(
                  'font-bold text-2xs px-1 rounded border',
                  marketSummary.solChange24h >= 0
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                )}
              >
                {marketSummary.solChange24h >= 0 ? '+' : ''}
                {marketSummary.solChange24h.toFixed(1)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 hidden lg:flex">
            <ShieldAlert className="h-3 w-3 text-rose-400 drop-shadow-[0_0_5px_rgba(255,59,105,0.5)]" />
            <span className="text-slate-500 font-mono text-2xs">Threats:</span>
            <span className={clsx('font-bold', threatCount ? 'text-rose-400' : 'text-slate-400')}>
              {threatCount === null ? tick : `${threatCount} Flagged`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-2">
          <Tooltip content={`Current Density: ${density.toUpperCase()} (Click to toggle)`}>
            <button
              aria-label={`Display density: ${density}. Change density`}
              onClick={cycleDensity}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-white/[0.08] bg-sentinel-900/80 hover:bg-sentinel-800 text-slate-300 transition-all uppercase font-mono text-2xs font-semibold"
            >
              <Sliders className="h-2.5 w-2.5 text-sky-400" />
              <span>{density}</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Axiom-Style Navigation & Action Header */}
      <div className="terminal-header-actions flex items-center justify-between px-3 sm:px-4 py-2 gap-3 min-w-0">
        {/* Left: Brand Identity & Horizontal Navigation Tabs */}
        <div className="flex items-center gap-3 xl:gap-4 shrink-0 min-w-0">
          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileNavOpen(!isMobileNavOpen)}
            aria-label={isMobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isMobileNavOpen}
            className="xl:hidden flex items-center justify-center h-8 w-8 rounded-lg text-slate-300 hover:bg-sentinel-850 hover:text-white border border-sentinel-750 transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Sentinel Brand Logo */}
          <Link
            href="/discover"
            prefetch={true}
            aria-label="Sentinel home"
            className="flex items-center gap-2.5 group shrink-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/25 shrink-0">
              <Zap className="h-4 w-4 fill-current text-sky-400" />
            </div>
            <div className="hidden sm:flex items-center">
              <span className="font-semibold text-lg tracking-tight text-white">Sentinel</span>
            </div>
          </Link>

          {/* Desktop Horizontal Navigation Bar (Axiom Style) */}
          <nav aria-label="Main navigation" className="hidden xl:flex items-center gap-1 border-l border-sentinel-800/80 pl-3">
            {primaryNavItems.map((item) => {
              const isActive = activeView === item.id;
              const target = viewRouteMap[item.id] || `/${item.id}`;
              const badge =
                item.id === 'alerts'
                  ? threatCount && threatCount > 0
                    ? String(threatCount)
                    : undefined
                  : item.badge;

              return (
                <Tooltip key={item.id} content={`${item.label} (${item.hotkey || ''})`}>
                  <Link
                    href={target}
                    prefetch={true}
                    aria-current={isActive ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-9 items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                    )}
                  >
                    <item.icon
                      className={clsx(
                        'h-3.5 w-3.5 shrink-0 transition-colors',
                        isActive ? 'text-sky-400 drop-shadow-[0_0_6px_rgba(0,240,255,0.5)]' : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />
                    <span>{item.label}</span>
                    {badge && (
                      <Badge variant={item.badgeVariant || 'neutral'} size="sm">
                        {badge}
                      </Badge>
                    )}
                  </Link>
                </Tooltip>
              );
            })}

            {/* "More" Secondary Navigation Popover */}
            <Popover
              align="start"
              trigger={
                <button
                  type="button"
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none border',
                    isSecondaryActive
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 font-bold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border-transparent'
                  )}
                >
                  <span>More</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              }
            >
              <div className="w-48 py-1 space-y-0.5">
                <p className="px-2.5 py-1 label-micro whitespace-nowrap text-slate-400">
                  Terminal & Preferences
                </p>
                {secondaryNavItems.map((item) => {
                  const isActive = activeView === item.id;
                  const target = viewRouteMap[item.id] || `/${item.id}`;
                  return (
                    <Link
                      key={item.id}
                      aria-current={isActive ? 'page' : undefined}
                      href={target}
                      prefetch={true}
                      className={clsx(
                        'flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors',
                        isActive
                          ? 'bg-sky-500/15 text-sky-300 font-bold'
                          : 'text-slate-300 hover:bg-sentinel-800 hover:text-white font-medium'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className={clsx('h-3.5 w-3.5', isActive ? 'text-sky-400' : 'text-slate-400')} />
                        <span>{item.label}</span>
                      </div>
                      {item.hotkey && (
                        <span className="font-mono text-3xs text-slate-500 bg-sentinel-950 px-1 py-0.5 rounded border border-sentinel-800">
                          {item.hotkey}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </Popover>
          </nav>
        </div>

        {/* Center: Command Palette Trigger Search Box */}
        <button
          type="button"
          aria-label="Search tokens and commands"
          onClick={() => setCommandPaletteOpen(true)}
          className="terminal-search flex h-9 w-9 shrink-0 items-center justify-center xl:justify-between rounded-md border border-sentinel-700/80 bg-sentinel-900 px-2 xl:px-3 text-slate-300 hover:border-sky-400 transition-colors xl:w-52 group"
        >
          <div className="flex items-center gap-2 text-xs truncate">
            <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-400 transition-colors shrink-0" />
            <span className="hidden xl:inline text-slate-400 group-hover:text-slate-200 transition-colors truncate">
              Search tokens...
            </span>
          </div>
          <kbd className="hidden xl:inline-flex items-center gap-1 rounded bg-sentinel-950 px-1.5 py-0.5 text-2xs text-slate-400 font-mono border border-sentinel-800 shrink-0">
            ⌘K
          </kbd>
        </button>

        {/* Right: Quick Trade, Notifications, Wallet Connection, User Profile */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* Active Wallet Connection Button */}
          {primaryWallet ? (
            <button
              onClick={() => setWalletModalOpen(true)}
              className="h-8 flex items-center gap-2 rounded-lg border border-sentinel-700 bg-sentinel-900/90 px-2.5 py-1 text-xs text-slate-200 hover:border-sky-400 transition-colors"
            >
              <Wallet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono text-xs text-sky-300 font-semibold">
                {primaryWallet.address.slice(0, 4)}...{primaryWallet.address.slice(-4)}
              </span>
              <span className="hidden sm:inline font-numeric font-semibold text-emerald-400 border-l border-sentinel-700 pl-2">
                {primaryWallet.balanceSol.toFixed(2)} SOL
              </span>
            </button>
          ) : (
            <Button
              onClick={() => setWalletModalOpen(true)}
              variant="primary"
              size="sm"
              leftIcon={<Wallet className="h-3.5 w-3.5" />}
              className="h-8 text-xs font-bold"
            >
              Connect Wallet
            </Button>
          )}

          <Tooltip content="Quick Trade Terminal (Shift + B)">
            <Button
              onClick={() => setQuickBuyOpen(true)}
              variant="outline"
              size="sm"
              leftIcon={<Zap className="h-3.5 w-3.5" />}
              className="h-8 text-xs hidden xl:inline-flex"
            >
              Quick Trade
            </Button>
          </Tooltip>

          <Tooltip content="Risk Notifications & Alerts">
            <button
              onClick={() => setNotificationsOpen(true)}
              aria-label={`Notifications${unreadNotifs ? ` (${unreadNotifs} unread)` : ''}`}
              className="relative h-8 w-8 flex items-center justify-center rounded-lg border border-sentinel-700 bg-sentinel-900/90 text-slate-300 hover:border-sky-400 transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-2xs font-bold text-white shadow-[0_0_8px_rgba(255,59,105,0.6)]">
                  {unreadNotifs}
                </span>
              )}
            </button>
          </Tooltip>

          {/* User Profile Popover */}
          <div className="hidden sm:block"><UserProfilePopover /></div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
