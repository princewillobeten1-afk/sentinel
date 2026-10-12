'use client';

import React from 'react';
import {
  Flame,
  Search,
  RefreshCw,
  Sparkles,
  Music,
  Newspaper,
  TrendingUp,
  Layers,
  ArrowRight,
  X,
} from 'lucide-react';
import { useTrendRadar } from '@/lib/hooks/use-trend-radar';
import { useTrendRadarStore } from '@/lib/store/trend-radar-store';
import { TrendCard } from './trend-card';
import { clsx } from 'clsx';
import Link from 'next/link';

export function TrendIntelligenceTab() {
  const { activeSource, setActiveSource, searchQuery, setSearchQuery } = useTrendRadarStore();
  const { trends, stats, isLoading, error, refetch } = useTrendRadar();

  const sources = [
    { id: 'all', label: 'All Sources', icon: Layers, count: stats?.totalTrends },
    { id: 'tiktok', label: 'TikTok Viral', icon: Music, count: stats?.tiktokCount },
    { id: 'x', label: '𝕏 Trending', icon: Sparkles, count: stats?.xCount },
    { id: 'news', label: 'Global News', icon: Newspaper, count: stats?.newsCount },
    { id: 'culture', label: 'Culture & Lore', icon: TrendingUp, count: stats?.cultureCount },
  ];

  return (
    <div className="space-y-6 font-mono select-none">
      {/* Top Header & Pulse Cards */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-warn-400 text-2xs font-bold uppercase tracking-wider">
              <Flame className="w-4 h-4 fill-current" />
              <span>Real-Time Meme & Narrative Catalyst Radar</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Trending Social Phenomena & Solana Tokens
            </h2>
            <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed font-sans">
              Memecoins move on internet culture. Track breaking trends across TikTok, 𝕏, news headlines, and viral audio alongside their associated on-chain Solana tokens.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-center font-mono">
              <span className="block text-3xs text-neutral-500 uppercase">Top Virality</span>
              <span className="text-base font-bold text-warn-400">{stats?.topViralityScore ?? 99}/100</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-center font-mono">
              <span className="block text-3xs text-neutral-500 uppercase">Active Trends</span>
              <span className="text-base font-bold text-white">{trends.length}</span>
            </div>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 hover:text-white transition-colors font-mono text-xs border border-neutral-700 cursor-pointer"
              title="Refresh trends"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-warn-400')} />
              <span>Refresh</span>
            </button>
            <Link
              href="/trends"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-warn-500/10 hover:bg-warn-500/20 text-warn-300 hover:text-white transition-colors border border-warn-500/30 text-xs font-bold"
            >
              <span>Full Page</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="mt-5 pt-4 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {sources.map((s) => {
              const active = activeSource === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSource(s.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 border cursor-pointer',
                    active
                      ? 'bg-warn-500/20 text-warn-300 border-warn-500/50 shadow-glow-amber font-bold'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                  {s.count !== undefined && (
                    <span className="text-3xs text-neutral-500">({s.count})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trend, token symbol, or story..."
              className="w-full pl-8 pr-8 py-1.5 bg-neutral-950 border border-neutral-750 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-accent-500 font-mono transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Trending Topics */}
      {isLoading && trends.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-neutral-500 font-mono text-xs gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40">
          <RefreshCw className="w-6 h-6 animate-spin text-warn-400" />
          <span>Aggregating real-time trend signals across TikTok, 𝕏 & news media...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-sell-500/30 bg-sell-500/10 text-sell-300 text-xs font-mono text-center">
          <p>{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 rounded-lg bg-sell-500/20 hover:bg-sell-500/30 text-white font-bold cursor-pointer"
          >
            Retry Aggregator
          </button>
        </div>
      ) : trends.length === 0 ? (
        <div className="py-20 text-center text-neutral-500 text-xs font-mono rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30">
          <Flame className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
          <p>No trends found matching this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trends.map((item) => (
            <TrendCard key={item.id} trend={item} />
          ))}
        </div>
      )}
    </div>
  );
}
