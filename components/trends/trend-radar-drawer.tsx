'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Search,
  Flame,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Music,
  Newspaper,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import { useTrendRadarStore } from '@/lib/store/trend-radar-store';
import { useTrendRadar } from '@/lib/hooks/use-trend-radar';
import { TrendCard } from './trend-card';
import Link from 'next/link';
import { clsx } from 'clsx';

export function TrendRadarDrawer() {
  const {
    isOpen,
    setOpen,
    activeSource,
    setActiveSource,
    searchQuery,
    setSearchQuery,
  } = useTrendRadarStore();

  const { trends, stats, isLoading, error, refetch } = useTrendRadar();
  const [showSearch, setShowSearch] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  const sources = [
    { id: 'all', label: 'All', icon: Sparkles },
    { id: 'tiktok', label: 'TikTok', icon: Music, count: stats?.tiktokCount },
    { id: 'x', label: '𝕏 Trends', icon: Sparkles, count: stats?.xCount },
    { id: 'news', label: 'News', icon: Newspaper, count: stats?.newsCount },
    { id: 'culture', label: 'Culture', icon: TrendingUp, count: stats?.cultureCount },
  ];

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] md:w-[480px] bg-sentinel-950/98 backdrop-blur-xl border-l border-sentinel-800 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right select-none"
        aria-label="Viral Meme Trends & Newsfeed"
      >
        {/* Top Header Bar */}
        <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 border-b border-sentinel-800/80 bg-black/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400">
              <Flame className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-wide">Meme Trends Radar</span>
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-950/70 border border-emerald-800/50 text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
          </div>

          {/* Top Right Controls */}
          <div className="flex items-center gap-1 text-slate-400">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={clsx(
                'p-1.5 rounded hover:text-white hover:bg-white/[0.06] transition',
                showSearch || searchQuery ? 'text-amber-400 bg-amber-950/30' : 'text-slate-400'
              )}
              title="Search Trends"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded hover:text-white hover:bg-white/[0.06] transition"
              title="Refresh Trending Feeds"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin text-amber-400')} />
            </button>

            {/* Close Drawer */}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition ml-1"
              title="Close Drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Source Categories Tabs */}
        <div className="shrink-0 px-3 py-2 border-b border-sentinel-800/60 bg-sentinel-900/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {sources.map((src) => {
            const isSelected = activeSource === src.id;
            const Icon = src.icon;
            return (
              <button
                key={src.id}
                onClick={() => setActiveSource(src.id)}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-mono font-semibold transition shrink-0 border',
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-sentinel-900/80 text-slate-400 border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700'
                )}
              >
                <Icon className="w-3 h-3" />
                <span>{src.label}</span>
                {src.count !== undefined && (
                  <span className="text-3xs text-slate-500 font-normal">({src.count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar Input (collapsible or persistent if active) */}
        {(showSearch || searchQuery) && (
          <div className="shrink-0 p-2.5 bg-black/50 border-b border-sentinel-800/60 animate-in fade-in duration-150">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search viral memes, TikTok sounds, 𝕏 topics, tokens..."
                className="w-full pl-8 pr-7 py-1.5 bg-sentinel-950 border border-sentinel-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 font-mono"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Trends Feed List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {isLoading && trends.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              <span>Scanning TikTok, 𝕏 & Web Feeds...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-mono text-center">
              <span>{error}</span>
              <button
                onClick={() => refetch()}
                className="block mx-auto mt-2 px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-white"
              >
                Retry Scan
              </button>
            </div>
          ) : trends.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs font-mono">
              <Flame className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p>No trends found matching filter.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-amber-400 hover:underline"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            trends.map((item) => <TrendCard key={item.id} trend={item} />)
          )}
        </div>

        {/* Footer info bar with Intelligence Layer link */}
        <div className="shrink-0 px-3.5 py-2 border-t border-sentinel-800/80 bg-black/60 flex items-center justify-between text-2xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5 text-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Updated in real-time</span>
          </div>

          <Link
            href="/intelligence"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 hover:underline transition font-bold"
          >
            <span>Full Intelligence View</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        </div>
      </aside>
    </>
  );
}
