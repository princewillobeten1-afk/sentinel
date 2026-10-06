'use client';

import React, { useState } from 'react';
import {
  Flame,
  Search,
  RefreshCw,
  Sparkles,
  Music,
  Newspaper,
  TrendingUp,
  Filter,
  BarChart3,
  Layers,
} from 'lucide-react';
import { useTrendRadar } from '@/lib/hooks/use-trend-radar';
import { useTrendRadarStore } from '@/lib/store/trend-radar-store';
import { TrendCard } from './trend-card';
import { clsx } from 'clsx';

export function TrendIntelligenceTab() {
  const { activeSource, setActiveSource, searchQuery, setSearchQuery } = useTrendRadarStore();
  const { trends, stats, isLoading, error, refetch } = useTrendRadar();

  const sources = [
    { id: 'all', label: 'All Sources', icon: Layers, count: stats?.totalTrends },
    { id: 'tiktok', label: '🎵 TikTok Viral', icon: Music, count: stats?.tiktokCount },
    { id: 'x', label: '🐦 𝕏 Trending Topics', icon: Sparkles, count: stats?.xCount },
    { id: 'news', label: '📰 Global News & Politics', icon: Newspaper, count: stats?.newsCount },
    { id: 'culture', label: '🎭 Web Culture & Lore', icon: TrendingUp, count: stats?.cultureCount },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Pulse Cards */}
      <div className="rounded-2xl border border-sentinel-800 bg-sentinel-900/60 p-4 sm:p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-mono text-2xs font-bold uppercase tracking-wider mb-1">
              <Flame className="w-4 h-4 fill-current" />
              <span>Real-Time Narrative & Meme Catalyst Radar</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Trending Topics & Associated Solana Tokens
            </h2>
            <p className="mt-1 text-xs text-slate-300 max-w-2xl leading-relaxed">
              Memecoins move on internet culture. Track breaking trends across TikTok, 𝕏, news headlines, and viral audio alongside their associated on-chain Solana tokens.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="px-3.5 py-2 rounded-xl bg-sentinel-950/80 border border-sentinel-800 text-center font-mono">
              <span className="block text-3xs text-slate-500 uppercase">Top Virality</span>
              <span className="text-base font-bold text-amber-400">{stats?.topViralityScore ?? 99}/100</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-sentinel-950/80 border border-sentinel-800 text-center font-mono">
              <span className="block text-3xs text-slate-500 uppercase">Active Trends</span>
              <span className="text-base font-bold text-white">{trends.length}</span>
            </div>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sentinel-800 hover:bg-sentinel-700 text-slate-200 hover:text-white transition font-mono text-xs border border-sentinel-700"
              title="Refresh trends"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-amber-400')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="mt-5 pt-4 border-t border-sentinel-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition shrink-0 border',
                    active
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm font-bold'
                      : 'bg-sentinel-950 text-slate-400 border-sentinel-800 hover:text-white hover:border-sentinel-700'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                  {s.count !== undefined && (
                    <span className="text-3xs text-slate-500">({s.count})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trend, token symbol, or story..."
              className="w-full pl-8 pr-3 py-1.5 bg-sentinel-950 border border-sentinel-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Grid of Trending Topics */}
      {isLoading && trends.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span>Aggregating real-time trend signals across TikTok, 𝕏 & news media...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-mono text-center">
          <p>{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white font-bold"
          >
            Retry Aggregator
          </button>
        </div>
      ) : trends.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-xs font-mono rounded-2xl border border-dashed border-sentinel-800">
          <Flame className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p>No trends found matching this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trends.map((item) => (
            <TrendCard key={item.id} trend={item} />
          ))}
        </div>
      )}
    </div>
  );
}
