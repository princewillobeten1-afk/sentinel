'use client';

import React, { useState } from 'react';
import {
  X,
  Search,
  Volume2,
  VolumeX,
  Type,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Star,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useXTrackerStore, type XTextSize } from '@/lib/store/x-tracker-store';
import { useXTracker } from '@/lib/hooks/use-x-tracker';
import { XTrackerCard } from './x-tracker-card';
import type { XCallCategory } from '@/lib/x-tracker/types';
import Link from 'next/link';
import { clsx } from 'clsx';

export function XTrackerDrawer() {
  const {
    isOpen,
    setOpen,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    soundEnabled,
    toggleSound,
    textSize,
    cycleTextSize,
  } = useXTrackerStore();

  const { calls, stats, isLoading, error, refetch } = useXTracker();
  const [showFilterBar, setShowFilterBar] = useState(false);

  if (!isOpen) return null;

  const categories: { id: XCallCategory; label: string; icon: any }[] = [
    { id: 'all', label: 'All', icon: Sparkles },
    { id: 'kol', label: 'KOL Calls', icon: CheckCircle2 },
    { id: 'trending', label: 'Trending', icon: Flame },
    { id: 'mylist', label: 'My List', icon: Star },
  ];

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] md:w-[440px] bg-sentinel-950/98 backdrop-blur-xl border-l border-sentinel-800 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right"
      aria-label="X Tracker Social Feed"
    >
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 border-b border-sentinel-800/80 bg-black/40">
        <div className="flex items-center gap-2">
          {/* Twitter / X Logo Icon */}
          <div className="w-6 h-6 rounded bg-white/[0.08] border border-white/10 flex items-center justify-center font-bold text-white text-xs">
            𝕏
          </div>
          <span className="font-bold text-white text-sm tracking-wide">Social Tracker</span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/50 text-[10px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 text-slate-400">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={clsx(
              'p-1.5 rounded hover:text-white hover:bg-white/[0.06] transition',
              soundEnabled ? 'text-sky-400' : 'text-slate-500'
            )}
            title={soundEnabled ? 'Sound alerts on (click to mute)' : 'Sound alerts muted (click to enable)'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Text Size Scale Toggle */}
          <button
            onClick={cycleTextSize}
            className="p-1.5 rounded hover:text-white hover:bg-white/[0.06] transition text-xs font-mono font-bold"
            title={`Text size: ${textSize} (click to cycle)`}
          >
            AA
          </button>

          {/* Filter Bar Toggle */}
          <button
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={clsx(
              'p-1.5 rounded hover:text-white hover:bg-white/[0.06] transition',
              showFilterBar ? 'text-sky-400 bg-sky-950/40' : 'text-slate-400'
            )}
            title="Search & Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Close Button */}
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded hover:text-white hover:bg-white/[0.06] transition ml-1"
            title="Close X Tracker (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Categories Tab Strip */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-sentinel-800/60 bg-sentinel-950 text-xs">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium transition',
                isActive
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              )}
            >
              <Icon className="w-3 h-3" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      {(showFilterBar || searchQuery) && (
        <div className="shrink-0 px-3 py-2 border-b border-sentinel-800/60 bg-sentinel-900/50 flex items-center gap-2 animate-in fade-in duration-150">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token, @handle, or narrative..."
              className="w-full pl-8 pr-3 py-1 rounded bg-black/60 border border-sentinel-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/60 font-mono"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-2xs text-slate-400 hover:text-white px-1.5 py-1"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Main Feed Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-white/[0.04]">
        {isLoading && calls.length === 0 ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-sentinel-800" />
                  <div className="space-y-1 flex-1">
                    <div className="w-20 h-3 bg-sentinel-800 rounded" />
                    <div className="w-32 h-2.5 bg-sentinel-800/60 rounded" />
                  </div>
                </div>
                <div className="w-full h-8 bg-sentinel-900 rounded" />
              </div>
            ))}
          </div>
        ) : calls.length === 0 ? (
          <div className="py-16 px-6 text-center text-slate-500 space-y-2">
            <div className="w-10 h-10 rounded-full bg-sentinel-900 border border-sentinel-800 flex items-center justify-center mx-auto text-slate-400">
              𝕏
            </div>
            <p className="text-xs font-medium text-slate-300">No calls found in this feed</p>
            <p className="text-2xs text-slate-500">
              {searchQuery ? `No results matching "${searchQuery}"` : 'Waiting for new alpha callouts...'}
            </p>
          </div>
        ) : (
          calls.map((call) => <XTrackerCard key={call.id} call={call} />)
        )}
      </div>

      {/* Bottom Sticky Status Ribbon */}
      <div className="shrink-0 px-3 py-2 border-t border-sentinel-800/80 bg-black/60 flex items-center justify-between text-2xs font-numeric text-slate-400">
        <div className="flex items-center gap-2">
          <span>Calls Today: <strong className="text-white">{stats?.totalCallsToday ?? calls.length}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Avg Mult: <strong className="text-emerald-400 font-mono">{stats?.averageMultiplier ?? '2.4'}x</strong></span>
        </div>

        <Link
          href="/social"
          onClick={() => setOpen(false)}
          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition text-2xs font-mono"
        >
          <span>Full View</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </Link>
      </div>
    </aside>
  );
}
