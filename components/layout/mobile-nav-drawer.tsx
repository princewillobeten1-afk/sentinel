'use client';

import React from 'react';
import Link from 'next/link';
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
  HelpCircle,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { useAppState, useAppActions, AppView } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/drawer';
import { useGlobalTicker } from '@/lib/hooks/use-global-ticker';
import { UserProfilePopover } from '@/components/layout/user-profile-popover';

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
  { id: 'discover', label: 'Discover', icon: Compass, hotkey: 'G D' },
  { id: 'trade', label: 'Trade', icon: Wallet, hotkey: 'G T' },
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, hotkey: 'G H' },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart, hotkey: 'G P' },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark, hotkey: 'G W' },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert, hotkey: 'G A', badgeVariant: 'danger' },
  { id: 'launchpad', label: 'Launchpad', icon: Rocket, hotkey: 'G L' },
  { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit, hotkey: 'G I' },
  { id: 'ai', label: 'AI Co-Pilot', icon: Sparkles, hotkey: 'G AI' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hotkey: 'G AN' },
];

export const lowerNavItems: NavItemConfig[] = [
  { id: 'settings', label: 'Settings', icon: Settings, hotkey: 'G S' },
  { id: 'help', label: 'Help & Docs', icon: HelpCircle, hotkey: 'G ?' },
];

export function MobileNavDrawer() {
  const { activeView, isMobileNavOpen, primaryWallet, connectedWallet } = useAppState();
  const { setMobileNavOpen } = useAppActions();
  const { threatCount } = useGlobalTicker();

  const activeWallet = primaryWallet || connectedWallet;

  return (
    <Drawer
      isOpen={isMobileNavOpen}
      onClose={() => setMobileNavOpen(false)}
      position="left"
      title={
        <span className="flex items-center gap-2 text-sky-400 font-bold text-sm font-mono">
          <Zap className="h-4 w-4 fill-current" /> SENTINEL NAV
        </span>
      }
    >
      <div className="space-y-4">
        <UserProfilePopover align="left" />
        {/* Active Wallet Box */}
        <div className="rounded-xl border border-white/[0.08] bg-sentinel-900/80 p-3 text-slate-300">
          <div className="flex items-center justify-between gap-2 text-2xs uppercase font-mono text-slate-400 mb-1">
            <span>Network</span>
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <CheckCircle2 className="h-3 w-3" />
              <span>Solana Mainnet</span>
            </span>
          </div>
          {activeWallet ? (
            <div className="flex items-center justify-between font-numeric mt-1">
              <div>
                <p className="text-xs font-bold text-white font-mono">
                  {activeWallet.address.slice(0, 4)}...{activeWallet.address.slice(-4)}
                </p>
                <p className="text-[11px] text-emerald-400 font-bold">
                  {activeWallet.balanceSol.toFixed(2)} SOL
                </p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-status-pulse shadow-[0_0_8px_rgba(0,229,153,0.8)]" />
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic mt-1">No Wallet Connected</p>
          )}
        </div>

        {/* Main Navigation Links */}
        <div className="space-y-1">
          <p className="px-2 py-1 label-micro whitespace-nowrap">
            Main Terminal
          </p>
          {mainNavItems.map((item) => {
            const isActive = activeView === item.id;
            const target = viewRouteMap[item.id] || `/${item.id}`;
            const badge =
              item.id === 'alerts'
                ? threatCount && threatCount > 0
                  ? String(threatCount)
                  : undefined
                : item.badge;

            return (
              <Link
                key={item.id}
                href={target}
                aria-current={isActive ? 'page' : undefined}
                prefetch={true}
                onClick={() => {
                  setMobileNavOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center justify-between rounded-xl p-2.5 text-xs font-medium transition',
                  isActive
                    ? 'bg-sky-500/15 text-white font-bold border border-sky-500/30'
                    : 'text-slate-300 hover:bg-sentinel-850'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-sky-400" />
                  <span>{item.label}</span>
                </div>
                {badge && (
                  <Badge variant={item.badgeVariant || 'neutral'} size="sm">
                    {badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>

        {/* Secondary Navigation */}
        <div className="pt-2 border-t border-sentinel-800 space-y-1">
          <p className="px-2 py-1 label-micro whitespace-nowrap">
            Preferences & Docs
          </p>
          {lowerNavItems.map((item) => {
            const isActive = activeView === item.id;
            const target = viewRouteMap[item.id] || `/${item.id}`;
            return (
              <Link
                key={item.id}
                href={target}
                aria-current={isActive ? 'page' : undefined}
                prefetch={true}
                onClick={() => {
                  setMobileNavOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center justify-between rounded-xl p-2.5 text-xs font-medium transition',
                  isActive
                    ? 'bg-sky-500/15 text-white font-bold border border-sky-500/30'
                    : 'text-slate-300 hover:bg-sentinel-850'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-slate-400" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}
