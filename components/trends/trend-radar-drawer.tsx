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
  Radio,
  ArrowRight,
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
    { id: 'all', label: 'All', icon: Sparkles, count: stats?.totalTrends },
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
        className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] md:w-[540px] bg-neutral-950/98 backdrop-blur-2xl border-l border-neutral-800 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right select-none font-mono"
        aria-label="Viral Meme Trends & Newsfeed"
      >
        {/* Top Header Bar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-warn-500/10 border border-warn-500/30 flex items-center justify-center font-bold text-warn-400 shadow-glow-amber">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm tracking-wide">Trends Radar</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-buy-500/10 border border-buy-500/30 text-3xs font-mono text-buy-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-buy-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-3xs text-neutral-400 font-sans">
                Real-time internet meme catalysts & on-chain tokens
              </p>
            </div>
          </div>

          {/* Top Right Controls */}
          <div className="flex items-center gap-1.5 text-neutral-400">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={clsx(
                'p-2 rounded-lg hover:text-white hover:bg-neutral-800 transition-colors',
                showSearch || searchQuery ? 'text-warn-400 bg-warn-500/10 border border-warn-500/30' : 'text-neutral-400'
              )}
              title="Search Trends"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg hover:text-white hover:bg-neutral-800 transition-colors"
              title="Refresh Trending Feeds"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin text-warn-400')} />
            </button>

            {/* Close Drawer */}
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ml-1"
              title="Close Drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Source Categories Tabs */}
        <div className="shrink-0 px-3 py-2 border-b border-neutral-800/80 bg-neutral-900/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {sources.map((src) => {
            const isSelected = activeSource === src.id;
            const Icon = src.icon;
            return (
              <button
                key={src.id}
                onClick={() => setActiveSource(src.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-semibold transition shrink-0 border',
                  isSelected
                    ? 'bg-warn-500/20 text-warn-300 border-warn-500/40 shadow-glow-amber'
                    : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
                )}
              >
                <Icon className="w-3 h-3" />
                <span>{src.label}</span>
                {src.count !== undefined && (
                  <span className="text-3xs text-neutral-500 font-normal">({src.count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar Input (collapsible or persistent if active) */}
        {(showSearch || searchQuery) && (
          <div className="shrink-0 p-3 bg-neutral-950 border-b border-neutral-800 animate-in fade-in duration-150">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search viral memes, TikTok sounds, 𝕏 topics, tokens..."
                className="w-full pl-9 pr-8 py-2 bg-neutral-900 border border-neutral-750 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-accent-500 font-mono"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Trends Feed List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 min-h-0 bg-neutral-950/40">
          {isLoading && trends.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-neutral-500 font-mono text-xs gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-warn-400" />
              <span>Scanning TikTok, 𝕏 & On-Chain Viral Feeds...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl border border-sell-500/30 bg-sell-500/10 text-sell-300 text-xs font-mono text-center space-y-2">
              <span>{error}</span>
              <button
                onClick={() => refetch()}
                className="block mx-auto px-3 py-1 rounded-lg bg-sell-500/20 hover:bg-sell-500/30 text-white font-bold"
              >
                Retry Scan
              </button>
            </div>
          ) : trends.length === 0 ? (
            <div className="py-20 text-center text-neutral-500 text-xs font-mono space-y-2">
              <Flame className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p>No trends found matching filter.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-warn-400 hover:underline"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            trends.map((item) => <TrendCard key={item.id} trend={item} />)
          )}
        </div>

        {/* Footer info bar with direct link to Full Trends Command Center */}
        <div className="shrink-0 px-4 py-2.5 border-t border-neutral-800 bg-neutral-900/80 flex items-center justify-between text-2xs font-mono text-neutral-400">
          <div className="flex items-center gap-2 text-3xs">
            <span className="w-2 h-2 rounded-full bg-warn-400" />
            <span>Updated in real-time</span>
          </div>

          <Link
            href="/trends"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 text-warn-300 hover:text-white transition-colors font-bold group"
          >
            <span>Full Trends Page</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </aside>
    </>
  );
}
