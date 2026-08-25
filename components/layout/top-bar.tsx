'use client';

import React from 'react';
import {
  Search,
  Wallet,
  Zap,
  Bell,
  Sliders,
  Menu,
  Activity,
  ShieldAlert,
  Flame,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { UserProfilePopover } from '@/components/layout/user-profile-popover';
import { NetworkSelectorPopover } from '@/components/layout/network-selector-popover';
import { useAppState, useAppActions, DensityMode } from '@/lib/store';
import { useGlobalTicker } from '@/lib/hooks/use-global-ticker';
import { useMarketData } from '@/lib/hooks/use-market-data';

export function TopBar() {
  const { density, notifications, isMobileNavOpen, primaryWallet } = useAppState();
  const {
    setDensity,
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
  const { marketSummary } = useMarketData();

  /** Unknown renders as an em dash — never a plausible-looking constant. */
  const tick = '—';

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-white/[0.08] bg-sentinel-950/90 backdrop-blur-2xl shadow-sm select-none">
      {/* Upper Global Market Ticker Ribbon */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 sm:px-4 py-1 text-[11px] font-numeric text-slate-400 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
          {/* Network Popover Dropdown */}
          <NetworkSelectorPopover />

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-500 font-mono text-2xs">SOL:</span>
            <span className="font-bold text-white">
              {/* `== null` catches both undefined (not loaded) and null (the
                  provider could not fetch it). Either way the honest render is
                  a dash, not the $142.50 literal that used to sit here. */}
              {marketSummary?.solPriceUsd == null
                ? tick
                : `$${marketSummary.solPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </span>
            {marketSummary?.solChange24h != null && (
              <span
                className={`font-bold text-2xs px-1 rounded border ${
                  marketSummary.solChange24h >= 0
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}
              >
                {marketSummary.solChange24h >= 0 ? '+' : ''}
                {marketSummary.solChange24h.toFixed(1)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 hidden sm:flex">
            <Activity className="h-3 w-3 text-sky-400 drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]" />
            <span className="text-slate-500 font-mono text-2xs">TPS:</span>
            <span className="font-bold text-sky-300" title="No network-stats endpoint yet">{tick}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 hidden md:flex">
            <Flame className="h-3 w-3 text-amber-400 drop-shadow-[0_0_5px_rgba(255,184,0,0.5)]" />
            <span className="text-slate-500 font-mono text-2xs">Fee:</span>
            <span className="font-bold text-amber-300" title="No network-stats endpoint yet">{tick}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 hidden lg:flex">
            <ShieldAlert className="h-3 w-3 text-rose-400 drop-shadow-[0_0_5px_rgba(255,59,105,0.5)]" />
            <span className="text-slate-500 font-mono text-2xs">Threats:</span>
            <span className={`font-bold ${threatCount ? 'text-rose-400' : 'text-slate-400'}`}>
              {threatCount === null ? tick : `${threatCount} Flagged`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-2">
          <Tooltip content={`Current Density: ${density.toUpperCase()} (Click to toggle)`}>
            <button
              onClick={cycleDensity}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-white/[0.08] bg-sentinel-900/80 hover:bg-sentinel-800 text-slate-300 transition-all uppercase font-mono text-2xs font-semibold"
            >
              <Sliders className="h-2.5 w-2.5 text-sky-400" />
              <span>{density}</span>
            </button>
          </Tooltip>

          <span className="hidden xl:inline-flex items-center gap-1 text-2xs text-slate-500 font-mono">
            <Globe className="h-3 w-3 text-emerald-400" /> US-East (18ms)
          </span>
        </div>
      </div>

      {/* Main Top Action Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 gap-3">
        {/* Left: Mobile Menu Toggle & Brand Title */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileNavOpen(!isMobileNavOpen)}
            className="lg:hidden rounded-lg p-1.5 text-slate-300 hover:bg-white/5 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_8px_rgba(0,240,255,0.3)]">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <span className="font-bold text-white tracking-wide text-sm">SENTINEL</span>
          </div>
        </div>

        {/* Center: Search / Command Bar Trigger */}
        <div
          onClick={() => setCommandPaletteOpen(true)}
          className="flex flex-1 items-center justify-between rounded-xl border border-white/[0.08] bg-sentinel-900/80 backdrop-blur-xl px-3.5 py-1.5 text-slate-300 shadow-inner hover:border-sky-500/40 hover:bg-sentinel-850 hover:shadow-glow transition-all duration-200 cursor-pointer max-w-xl group"
        >
          <div className="flex items-center gap-2.5 text-xs">
            <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
            <span className="text-slate-400 group-hover:text-slate-200 transition-colors font-medium">
              Global Search & Commands (⌘K)...
            </span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-sentinel-950 px-1.5 py-0.5 text-2xs text-slate-400 font-mono border border-sentinel-800">
            ⌘K
          </kbd>
        </div>

        {/* Right: Wallet Button, Quick Trade, Notifications, Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Wallet Connection Status Button */}
          {primaryWallet ? (
            <button
              onClick={() => setWalletModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-400 transition shadow-[0_0_10px_rgba(0,229,153,0.15)]"
            >
              <Wallet className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-[11px] text-sky-300 font-semibold">
                {primaryWallet.address.slice(0, 4)}...{primaryWallet.address.slice(-4)}
              </span>
              <span className="font-numeric font-bold text-emerald-400 border-l border-emerald-500/30 pl-2">
                {primaryWallet.balanceSol.toFixed(2)} SOL
              </span>
            </button>
          ) : (
            <Button
              onClick={() => setWalletModalOpen(true)}
              variant="buy"
              size="sm"
              leftIcon={<Wallet className="h-3.5 w-3.5" />}
            >
              Connect Wallet
            </Button>
          )}

          <Tooltip content="Quick Trade Terminal (Shift + B)">
            <Button
              onClick={() => setQuickBuyOpen(true)}
              variant="outline"
              size="sm"
              leftIcon={<Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
              className="hidden sm:inline-flex border-amber-500/30 text-amber-300 hover:bg-amber-950/30"
            >
              Quick Trade
            </Button>
          </Tooltip>

          <Tooltip content="Risk Notifications & Alerts">
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative rounded-xl border border-sentinel-750 bg-sentinel-850/80 p-2 text-slate-300 hover:border-sky-500/40 hover:text-white transition"
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
          <UserProfilePopover />
        </div>
      </div>
    </header>
  );
}
