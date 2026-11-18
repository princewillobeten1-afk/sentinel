'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PhivexLogoMark } from '@/components/ui/phivex-logo';
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
  ChevronDown,
  Users,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { Popover } from '@/components/ui/popover';
import { UserProfilePopover } from '@/components/layout/user-profile-popover';
import { NetworkSelectorPopover } from '@/components/layout/network-selector-popover';
import { useAppState, useAppActions, useWalletState, DensityMode, AppView } from '@/lib/store';
import { useGlobalTicker } from '@/lib/hooks/use-global-ticker';
import { useMarketSummary } from '@/lib/hooks/use-market-summary';
import { viewRouteMap, NavItemConfig } from '@/components/layout/mobile-nav-drawer';
import { LiveAlertsTopbarButton } from '@/components/alerts/live-alerts-topbar-button';

export const primaryNavItems: NavItemConfig[] = [
  { id: 'discover', label: 'Discover', icon: Compass, hotkey: 'G D' },
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, hotkey: 'G H' },
  { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit, hotkey: 'G I' },
  { id: 'trade', label: 'Trade', icon: Wallet, hotkey: 'G T' },
  { id: 'wallets', label: 'Smart Wallets', icon: Users, hotkey: 'G M' },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart, hotkey: 'G P' },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark, hotkey: 'G W' },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert, hotkey: 'G A', badgeVariant: 'danger' },
];

export const secondaryNavItems: NavItemConfig[] = [
  { id: 'launchpad', label: 'Launchpad', icon: Rocket, hotkey: 'G L' },
  { id: 'ai', label: 'AI Co-Pilot', icon: Sparkles, hotkey: 'G AI' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hotkey: 'G AN' },
];

export function TopBar() {
  const pathname = usePathname();
  const { density, notifications, isMobileNavOpen, primaryWallet, activeView, selectedToken, activeChain } = useAppState();
  const { evmAddress, evmBalanceEth, isWrongEvmNetwork } = useWalletState();
  const {
    setDensity,
    setActiveView,
    setActiveChain,
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
    <header className="terminal-header sticky top-0 z-30 flex shrink-0 min-w-0 flex-col border-b border-[#1E222D] bg-[#06070B]/95 backdrop-blur-md select-none">
      {/* Upper Global Market Ticker Ribbon (28px Institutional Ribbon) */}
      <div className="flex items-center justify-between border-b border-[#1E222D] px-3 sm:px-4 h-7 text-[11px] font-numeric text-[#828598] bg-[#090B10]">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
          {/* Compact Multi-Chain Terminal Switcher: [ SOLANA ] [ ROBINHOOD ] */}
          <div
            role="group"
            aria-label="Active blockchain"
            className="inline-flex items-center rounded-[6px] border border-[#1E222D] bg-[#0D1015] p-0.5 shrink-0 font-mono"
          >
            <button
              type="button"
              onClick={() => setActiveChain('solana')}
              aria-pressed={activeChain === 'solana'}
              className={clsx(
                'flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-all',
                activeChain === 'solana'
                  ? 'bg-[#526FFF]/15 text-[#F7F8F9] border border-[#526FFF]/40 shadow-[0_0_10px_rgba(82,111,255,0.2)]'
                  : 'text-[#828598] hover:text-[#F7F8F9] border border-transparent'
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', activeChain === 'solana' ? 'bg-[#2FE3AC] shadow-[0_0_5px_#2FE3AC]' : 'bg-[#525866]')} />
              <span>SOLANA</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveChain('robinhood')}
              aria-pressed={activeChain === 'robinhood'}
              className={clsx(
                'flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-all',
                activeChain === 'robinhood'
                  ? 'bg-[#2FE3AC]/15 text-[#2FE3AC] border border-[#2FE3AC]/40 shadow-[0_0_10px_rgba(47,227,172,0.16)]'
                  : 'text-[#828598] hover:text-[#F7F8F9] border border-transparent'
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', activeChain === 'robinhood' ? 'bg-[#2FE3AC] shadow-[0_0_5px_#2FE3AC]' : 'bg-[#525866]')} />
              <span>ROBINHOOD</span>
            </button>
          </div>

          <span className="h-3 w-px bg-[#1E222D] shrink-0" aria-hidden="true" />

          {/* Network Popover Dropdown */}
          <NetworkSelectorPopover />

          {activeChain === 'robinhood' ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[#525866] font-mono text-[10px]">EVM L2:</span>
              <span className="font-semibold text-[#2FE3AC] font-mono text-[11px]">ETH · Chain 4663</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[#525866] font-mono text-[10px]">SOL:</span>
              <span className="font-semibold text-[#F7F8F9]">
                {marketSummary?.solPriceUsd == null
                  ? tick
                  : `$${marketSummary.solPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              </span>
              {marketSummary?.solChange24h != null && (
                <span
                  className={clsx(
                    'font-semibold text-[10px] px-1.5 py-px rounded border',
                    marketSummary.solChange24h >= 0
                      ? 'text-[#2FE3AC] bg-[#2FE3AC]/10 border-[#2FE3AC]/25'
                      : 'text-[#FF6166] bg-[#EC397A]/12 border-[#EC397A]/25'
                  )}
                >
                  {marketSummary.solChange24h >= 0 ? '+' : ''}
                  {marketSummary.solChange24h.toFixed(1)}%
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0 hidden lg:flex border-l border-[#1E222D] pl-3">
            <ShieldAlert className="h-3 w-3 text-[#FF6166]" />
            <span className="text-[#525866] font-mono text-[10px]">Threats:</span>
            <span className={clsx('font-semibold', threatCount ? 'text-[#FF6166]' : 'text-[#828598]')}>
              {threatCount === null ? tick : `${threatCount} Flagged`}
            </span>
          </div>

          {/* Live Alerts Stream Ticker & Audio Control */}
          <LiveAlertsTopbarButton variant="ticker" className="hidden sm:flex" />
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Tooltip content={`Current Density: ${density.toUpperCase()} (Click to toggle)`}>
            <button
              aria-label={`Display density: ${density}. Change density`}
              onClick={cycleDensity}
              className="flex items-center gap-1 rounded-[4px] px-2 py-0.5 border border-[#1E222D] bg-[#11141B] hover:bg-[#1C202B] hover:border-[#32374A] text-[#C8C9D1] hover:text-[#F7F8F9] transition-all uppercase font-mono text-[10px] font-semibold"
            >
              <Sliders className="h-2.5 w-2.5 text-[#526FFF]" />
              <span>{density}</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Axiom-Style Navigation & Action Header (52px) */}
      <div className="terminal-header-actions flex items-center justify-between px-3 sm:px-4 h-[52px] gap-3 min-w-0">
        {/* Left: Brand Identity & Horizontal Navigation Tabs */}
        <div className="flex items-center gap-3 xl:gap-4 shrink-0 min-w-0">
          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileNavOpen(!isMobileNavOpen)}
            aria-label={isMobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isMobileNavOpen}
            className="xl:hidden flex items-center justify-center h-8 w-8 rounded-[8px] text-[#C8C9D1] hover:bg-[#151821] hover:text-[#F7F8F9] border border-[#1E222D] transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Phivex Brand Logo */}
          <Link
            href="/discover"
            prefetch={true}
            aria-label="Phivex home"
            className="flex items-center gap-2.5 group shrink-0"
          >
            <PhivexLogoMark size="sm" className="group-hover:scale-105 group-hover:border-[#526FFF]/50 transition-transform" />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-semibold text-[15px] tracking-[0.14em] text-[#F7F8F9]">PHIVEX</span>
            </div>
          </Link>

          {/* Desktop Horizontal Navigation Bar (Axiom Style) */}
          <div className="hidden xl:flex items-center gap-0.5 2xl:gap-1 border-l border-[#1E222D] pl-2.5 2xl:pl-3 shrink-0">
            <nav aria-label="Main navigation" className="flex items-center gap-0.5 2xl:gap-1">
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
                        'flex h-8 items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[12.5px] font-medium transition-all duration-150 whitespace-nowrap shrink-0',
                        isActive
                          ? 'bg-[#526FFF]/15 text-[#F7F8F9] border border-[#526FFF]/35 shadow-[0_0_12px_rgba(82,111,255,0.18)] font-semibold'
                          : 'text-[#828598] hover:text-[#F7F8F9] hover:bg-white/[0.04] border border-transparent'
                      )}
                    >
                      <item.icon
                        className={clsx(
                          'h-3.5 w-3.5 shrink-0 transition-colors',
                          isActive ? 'text-[#6683FF]' : 'text-[#828598] group-hover:text-[#F7F8F9]'
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
            </nav>

            {/* "More" Secondary Navigation Popover */}
            <Popover
              align="start"
              trigger={
                <button
                  type="button"
                  id="topbar-more-button"
                  className={clsx(
                    'flex h-8 items-center gap-1 px-2.5 py-1 rounded-[6px] text-[12.5px] font-medium transition-all duration-150 select-none border shrink-0',
                    isSecondaryActive
                      ? 'bg-[#526FFF]/15 text-[#F7F8F9] border-[#526FFF]/35 font-semibold'
                      : 'text-[#828598] hover:text-[#F7F8F9] hover:bg-white/[0.04] border-transparent'
                  )}
                >
                  <span>More</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#828598] transition-transform duration-200 [[aria-expanded=true]_&]:rotate-180" />
                </button>
              }
            >
              <div className="w-52 py-1 space-y-0.5 bg-[#0D1015]">
                <p className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-mono text-[#828598] font-semibold border-b border-[#1E222D] mb-1">
                  Terminal & Tools
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
                        'flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors',
                        isActive
                          ? 'bg-[#526FFF]/15 text-[#F7F8F9] font-semibold'
                          : 'text-[#C8C9D1] hover:bg-[#151821] hover:text-[#F7F8F9] font-medium'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className={clsx('h-3.5 w-3.5', isActive ? 'text-[#6683FF]' : 'text-[#828598]')} />
                        <span>{item.label}</span>
                      </div>
                      {item.hotkey && (
                        <span className="font-mono text-[10px] text-[#828598] bg-[#06070B] px-1.5 py-0.5 rounded border border-[#1E222D]">
                          {item.hotkey}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </Popover>
          </div>
        </div>

        {/* Right: Search, Wallet Connection, Quick Trade, Notifications, Alerts, User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          {/* Command Palette Trigger Search Box */}
          <Tooltip content="Search tokens, pairs, commands (Ctrl + K)">
            <button
              type="button"
              aria-label="Search tokens and commands"
              onClick={() => setCommandPaletteOpen(true)}
              className="terminal-search group flex h-8 items-center gap-2 rounded-full border border-[#1E222D] bg-[#11141B] px-3 text-xs text-[#828598] transition-all hover:border-[#526FFF]/50 hover:text-[#F7F8F9] shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-[#828598] transition-colors group-hover:text-[#6683FF] shrink-0" />
              <span className="hidden 2xl:inline text-[#828598] group-hover:text-[#C8C9D1] font-medium">Search ticker or CA...</span>
              <kbd className="hidden 2xl:inline-flex items-center rounded border border-[#222634] bg-[#06070B] px-1.5 py-0.5 text-[10px] font-mono text-[#828598]">
                ⌘K
              </kbd>
            </button>
          </Tooltip>

          {/* Active Wallet Connection Button */}
          {activeChain === 'robinhood' ? (
            evmAddress ? (
              <button
                onClick={() => setWalletModalOpen(true)}
                className={clsx(
                  'h-8 flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-all shrink-0',
                  isWrongEvmNetwork
                    ? 'border-[#FFB224]/50 bg-[#FFB224]/10 text-[#FFC453] hover:border-[#FFB224]'
                    : 'border-[#222634] bg-[#11141B] text-[#F7F8F9] hover:border-[#2FE3AC]/50'
                )}
              >
                <Wallet className={clsx('h-3.5 w-3.5 shrink-0', isWrongEvmNetwork ? 'text-[#FFB224]' : 'text-[#2FE3AC]')} />
                <span className="font-mono text-xs text-[#F7F8F9] font-semibold">
                  {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
                </span>
                <span className="hidden sm:inline font-numeric font-semibold text-[#2FE3AC] border-l border-[#222634] pl-2">
                  {isWrongEvmNetwork
                    ? 'Wrong Net'
                    : evmBalanceEth === null
                      ? '— ETH'
                      : `${evmBalanceEth.toFixed(4)} ETH`}
                </span>
              </button>
            ) : (
              <Button
                onClick={() => setWalletModalOpen(true)}
                variant="primary"
                size="sm"
                leftIcon={<Wallet className="h-3.5 w-3.5" />}
                className="h-8 rounded-full bg-[#415CF2] hover:bg-[#526FFF] border border-[#6683FF]/50 text-white text-xs font-semibold px-3.5 shadow-[0_0_14px_rgba(65,92,242,0.38)] active:scale-[0.98] shrink-0"
              >
                Connect EVM
              </Button>
            )
          ) : primaryWallet ? (
            <button
              onClick={() => setWalletModalOpen(true)}
              className="h-8 flex items-center gap-2 rounded-full border border-[#222634] bg-[#11141B] px-3 py-1 text-xs text-[#F7F8F9] hover:border-[#526FFF]/50 transition-all shrink-0"
            >
              <Wallet className="h-3.5 w-3.5 text-[#2FE3AC] shrink-0" />
              <span className="font-mono text-xs text-[#F7F8F9] font-semibold">
                {primaryWallet.address.slice(0, 4)}...{primaryWallet.address.slice(-4)}
              </span>
              <span className="hidden sm:inline font-numeric font-semibold text-[#2FE3AC] border-l border-[#222634] pl-2">
                {primaryWallet.balanceSol.toFixed(2)} SOL
              </span>
            </button>
          ) : (
            <Button
              onClick={() => setWalletModalOpen(true)}
              variant="primary"
              size="sm"
              leftIcon={<Wallet className="h-3.5 w-3.5" />}
              className="h-8 rounded-full bg-[#415CF2] hover:bg-[#526FFF] border border-[#6683FF]/50 text-white text-xs font-semibold px-3.5 shadow-[0_0_14px_rgba(65,92,242,0.38)] active:scale-[0.98] shrink-0"
            >
              Connect Wallet
            </Button>
          )}

          <Tooltip content="Quick Trade Terminal (Shift + B)">
            <Button
              onClick={() => {
                if (selectedToken && selectedToken.mint) {
                  setQuickBuyOpen(true, {
                    name: selectedToken.name,
                    symbol: selectedToken.symbol,
                    mint: selectedToken.mint,
                    price: selectedToken.priceUsd || '0',
                    mcap: selectedToken.marketCapUsd || '0',
                    logoURI: selectedToken.logoUrl,
                  });
                } else {
                  setQuickBuyOpen(true);
                }
              }}
              variant="outline"
              size="sm"
              leftIcon={<Zap className="h-3.5 w-3.5 text-[#526FFF]" />}
              className="h-8 rounded-[8px] border-[#1E222D] bg-[#11141B] hover:bg-[#1C202B] hover:border-[#32374A] text-xs text-[#F7F8F9] hidden 2xl:inline-flex shrink-0"
            >
              Quick Trade
            </Button>
          </Tooltip>

          <Tooltip content="Risk Notifications & Alerts">
            <button
              onClick={() => setNotificationsOpen(true)}
              aria-label={`Notifications${unreadNotifs ? ` (${unreadNotifs} unread)` : ''}`}
              className="relative h-8 w-8 flex items-center justify-center rounded-[8px] border border-[#1E222D] bg-[#11141B] text-[#C8C9D1] hover:border-[#32374A] hover:text-[#F7F8F9] transition-colors shrink-0"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EC397A] text-[10px] font-bold text-white shadow-[0_0_8px_rgba(236,57,122,0.6)]">
                  {unreadNotifs}
                </span>
              )}
            </button>
          </Tooltip>

          {/* Live Trade & Call Alerts Drawer Trigger */}
          <LiveAlertsTopbarButton variant="button" className="hidden 2xl:flex shrink-0" />

          {/* User Profile Popover */}
          <div className="hidden sm:block shrink-0"><UserProfilePopover /></div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
