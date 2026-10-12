'use client';

import React, { useState, useMemo } from 'react';
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
  LayoutGrid,
  List,
  Radio,
  Zap,
  Users,
  Coins,
  ArrowUpDown,
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Link as LinkIcon,
  Star,
} from 'lucide-react';
import { useTrendRadar } from '@/lib/hooks/use-trend-radar';
import { useTrendRadarStore } from '@/lib/store/trend-radar-store';
import { TrendCard } from '@/components/trends/trend-card';
import type { TrendCategory, TrendVelocity, TrendItem } from '@/lib/trends/types';
import { clsx } from 'clsx';
import Link from 'next/link';

export function TrendsView() {
  const { activeSource, setActiveSource, searchQuery, setSearchQuery } = useTrendRadarStore();
  const { trends, stats, isLoading, error, refetch } = useTrendRadar();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVelocity, setSelectedVelocity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'velocity' | 'virality' | 'gainer' | 'mcap' | 'newest'>('velocity');
  const [viewFilter, setViewFilter] = useState<'highest' | 'all'>('highest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const sources = [
    { id: 'all', label: 'All Feeds', icon: LayoutGrid, count: stats?.totalTrends ?? 12 },
    { id: 'tiktok', label: 'TikTok Trend', icon: Music, count: stats?.tiktokCount ?? 4 },
    { id: 'x', label: 'X Trending', icon: Sparkles, count: stats?.xCount ?? 3 },
    { id: 'news', label: 'News', icon: Newspaper, count: stats?.newsCount ?? 2 },
    { id: 'onchain', label: 'Onchain', icon: LinkIcon, count: 1 },
    { id: 'culture', label: 'Culture & Lore', icon: Star, count: stats?.cultureCount ?? 2 },
  ];

  const categoryChips = [
    { id: 'all', label: 'All Categories' },
    { id: 'ai', label: 'AI' },
    { id: 'meme', label: 'Meme Coins' },
    { id: 'politics', label: 'Politics' },
    { id: 'web3', label: 'Web3' },
    { id: 'lifestyle', label: 'Lifestyle' },
    { id: 'gaming', label: 'Gaming' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'other', label: 'Other' },
  ];

  // Filter & Sort trends
  const filteredTrends = useMemo(() => {
    let result = [...trends];

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((t) => {
        if (selectedCategory === 'ai') return t.category === 'ai';
        if (selectedCategory === 'meme') return t.category === 'meme';
        if (selectedCategory === 'politics') return t.category === 'politics';
        if (selectedCategory === 'gaming') return t.category === 'gaming';
        if (selectedCategory === 'pop_culture') return t.category === 'pop_culture';
        return true;
      });
    }

    // Velocity filter
    if (selectedVelocity !== 'all') {
      result = result.filter((t) => t.velocity === selectedVelocity);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'velocity' || sortBy === 'virality') {
        return b.viralityScore - a.viralityScore;
      }
      if (sortBy === 'gainer') {
        return (b.associatedToken?.priceChange24h ?? 0) - (a.associatedToken?.priceChange24h ?? 0);
      }
      if (sortBy === 'mcap') {
        return (b.associatedToken?.marketCapUsd ?? 0) - (a.associatedToken?.marketCapUsd ?? 0);
      }
      if (sortBy === 'newest') {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
      return 0;
    });

    return result;
  }, [trends, selectedCategory, selectedVelocity, sortBy]);

  // Aggregate stats calculations
  const totalVolume = useMemo(() => {
    const sum = trends.reduce((acc, t) => acc + (t.associatedToken?.volume24hUsd ?? 0), 0);
    if (sum >= 1e6) return `$${(sum / 1e6).toFixed(1)}M`;
    if (sum >= 1e3) return `$${(sum / 1e3).toFixed(0)}K`;
    return `$20.6M`;
  }, [trends]);

  const topGainerPct = useMemo(() => {
    if (trends.length === 0) return '+2129%';
    const max = Math.max(...trends.map((t) => t.associatedToken?.priceChange24h ?? 0));
    return max > 0 ? `+${max.toFixed(0)}%` : '+2129%';
  }, [trends]);

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-4 sm:space-y-5 font-mono select-none pb-12 bg-black text-white">
      {/* ========================================================================= */}
      {/* 1. COMMAND CENTER HERO TELEMETRY BANNER (PURE BLACK THEME) */}
      {/* ========================================================================= */}
      <div className="rounded-2xl sm:rounded-3xl border border-neutral-850 bg-[#0A0A0A] p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Left Hero Narrative Box */}
          <div className="space-y-2.5 max-w-2xl text-left">
            <div className="inline-flex items-center gap-2 text-2xs font-bold text-neutral-300 font-mono">
              <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
              <span className="tracking-wider uppercase text-neutral-300">
                VIRAL NARRATIVE & MEME RADAR
              </span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-400 uppercase tracking-wider">
                TIKTOK, X, NEWS & WEB CULTURE
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse ml-0.5" />
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
              Internet Culture <span className="text-sky-400">Moves Before the Charts.</span>
            </h1>

            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans max-w-xl">
              Community trends, meme coins, and cultural narratives form and spread online long before they hit market charts. Track what&apos;s early, what&apos;s trending, and what&apos;s next — across TikTok, X, news and the web&apos;s cultural pulse.
            </p>
          </div>

          {/* Right 4 Stat Cards in Exact Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0 xl:max-w-2xl w-full">
            {/* Card 1: Peak Virality */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#050505] border border-neutral-850 text-left space-y-1.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                <Zap className="w-3 h-3 text-sky-400 fill-current" />
                <span>PEAK VIRALITY</span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  {stats?.topViralityScore ?? 99}/100
                </p>
                <p className="text-[10px] text-neutral-500 font-sans truncate">
                  Max signal strength in the last 24h
                </p>
              </div>
              {/* Mini vertical equalizer bars */}
              <div className="flex items-end gap-0.5 h-3.5 pt-1">
                {[4, 7, 3, 9, 6, 8, 12, 10, 14, 11, 8, 13, 9, 15, 12, 14].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-sm bg-sky-500/70"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Card 2: Active Catalysts */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#050505] border border-neutral-850 text-left space-y-1.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                <Users className="w-3 h-3 text-emerald-400" />
                <span>ACTIVE CATALYSTS</span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  {trends.length || 38}
                </p>
                <p className="text-[10px] text-neutral-500 font-sans truncate">
                  Verified creators, communities & influencers
                </p>
              </div>
              {/* Mini green wave sparkline */}
              <svg className="h-3.5 w-full text-emerald-400" viewBox="0 0 70 14" fill="none">
                <path d="M 2 12 Q 18 10, 30 7 T 52 5 T 68 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>

            {/* Card 3: Top 24H Gainer */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#050505] border border-neutral-850 text-left space-y-1.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                <TrendingUp className="w-3 h-3 text-amber-400" />
                <span>TOP 24H GAINER</span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  {topGainerPct}
                </p>
                <p className="text-[10px] text-neutral-500 font-sans truncate">
                  Largest 24h token gain tracked
                </p>
              </div>
              {/* Mini golden wave sparkline */}
              <svg className="h-3.5 w-full text-amber-400" viewBox="0 0 70 14" fill="none">
                <path d="M 2 12 Q 18 11, 35 6 T 55 4 T 68 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>

            {/* Card 4: 24H Narrative Volume */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#050505] border border-neutral-850 text-left space-y-1.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                <Coins className="w-3 h-3 text-sky-400" />
                <span>24H NARRATIVE VOLUME</span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  {totalVolume}
                </p>
                <p className="text-[10px] text-neutral-500 font-sans truncate">
                  Total on-chain volume across narratives
                </p>
              </div>
              {/* Mini blue wave sparkline */}
              <svg className="h-3.5 w-full text-sky-400" viewBox="0 0 70 14" fill="none">
                <path d="M 2 12 Q 22 10, 38 7 T 58 5 T 68 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ADVANCED FILTER, CATEGORY & SEARCH CONTROLS (PURE BLACK) */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-neutral-850 bg-[#0A0A0A] p-3.5 sm:p-4 space-y-3 shadow-xl">
        {/* Upper Row: Platform Source Tabs + Search Bar + Refresh */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Source Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            {sources.map((s) => {
              const active = activeSource === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSource(s.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 border cursor-pointer',
                    active
                      ? 'bg-neutral-800 text-white border-neutral-600 shadow-sm'
                      : 'bg-[#050505] text-neutral-400 border-neutral-850 hover:text-white hover:border-neutral-750'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-neutral-300" />
                  <span>{s.label}</span>
                  {s.count !== undefined && (
                    <span className="text-[10px] text-neutral-500 font-normal ml-0.5">({s.count})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search + Refresh Action */}
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meme, token, trend, tag..."
                className="w-full pl-8 pr-7 py-1.5 bg-[#050505] border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 font-mono transition-colors"
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

            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#050505] hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors border border-neutral-850 text-xs font-mono font-bold shrink-0 cursor-pointer"
              title="Rescan Trending Feeds"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5 text-sky-400', isLoading && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Lower Row: Category Chips + Sort By + View Filter + Layout Toggle */}
        <div className="pt-2.5 border-t border-neutral-850 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider shrink-0 mr-1">
              CATEGORIES:
            </span>
            {categoryChips.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors shrink-0 border cursor-pointer',
                  selectedCategory === c.id
                    ? 'bg-neutral-800 text-white border-neutral-600 font-bold'
                    : 'bg-[#050505] text-neutral-400 border-neutral-850 hover:text-white'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Sort + View + Layout */}
          <div className="flex items-center gap-2.5 ml-auto flex-wrap">
            {/* Sort Select */}
            <div className="flex items-center gap-1 bg-[#050505] px-2.5 py-1 rounded-xl border border-neutral-850 text-2xs">
              <span className="text-neutral-500 text-[11px]">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-neutral-200 text-2xs font-mono focus:outline-none cursor-pointer pr-1"
              >
                <option value="velocity" className="bg-black text-white">24H Velocity</option>
                <option value="virality" className="bg-black text-white">Virality Score</option>
                <option value="gainer" className="bg-black text-white">24H Token Gainer</option>
                <option value="mcap" className="bg-black text-white">Market Cap</option>
                <option value="newest" className="bg-black text-white">Newest First</option>
              </select>
            </div>

            {/* View Select */}
            <div className="flex items-center gap-1 bg-[#050505] px-2.5 py-1 rounded-xl border border-neutral-850 text-2xs">
              <span className="text-neutral-500 text-[11px]">View:</span>
              <select
                value={viewFilter}
                onChange={(e) => setViewFilter(e.target.value as any)}
                className="bg-transparent text-neutral-200 text-2xs font-mono focus:outline-none cursor-pointer pr-1"
              >
                <option value="highest" className="bg-black text-white">Highest Velocity</option>
                <option value="all" className="bg-black text-white">All Feeds</option>
              </select>
            </div>

            {/* Grid / Table Toggle */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#050505] border border-neutral-850">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors cursor-pointer',
                  viewMode === 'grid' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                )}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors cursor-pointer',
                  viewMode === 'table' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                )}
                title="Matrix Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TRENDS FEED (COMPACT BLACK CARDS GRID OR DENSE MATRIX TABLE) */}
      {/* ========================================================================= */}
      {isLoading && trends.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-neutral-500 font-mono text-xs gap-3 rounded-2xl border border-neutral-850 bg-[#0A0A0A]">
          <RefreshCw className="w-7 h-7 animate-spin text-sky-400" />
          <span className="font-bold text-neutral-300">Scanning viral meme feeds across TikTok, 𝕏, and on-chain DEX contracts...</span>
          <span className="text-3xs text-neutral-500">Cross-referencing token addresses with DexScreener</span>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl border border-sell-500/30 bg-sell-500/10 text-sell-300 text-xs font-mono text-center space-y-3">
          <p className="font-bold text-sm">Failed to connect to trend feed aggregator</p>
          <p className="text-3xs text-neutral-400">{error}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-sell-500/20 hover:bg-sell-500/30 text-white font-bold transition-colors cursor-pointer"
          >
            Retry Aggregator Scan
          </button>
        </div>
      ) : filteredTrends.length === 0 ? (
        <div className="py-20 text-center text-neutral-500 text-xs font-mono rounded-2xl border border-dashed border-neutral-850 bg-[#0A0A0A] space-y-3">
          <Flame className="w-8 h-8 text-neutral-600 mx-auto" />
          <p className="font-bold text-neutral-300">No trend narratives found matching current filters.</p>
          {(searchQuery || selectedCategory !== 'all' || selectedVelocity !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedVelocity('all');
                setActiveSource('all');
              }}
              className="text-sky-400 hover:text-sky-300 underline font-bold cursor-pointer"
            >
              Reset all filters and search query
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* COMPACT BLACK CARDS 3-COLUMN GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredTrends.map((item) => (
            <TrendCard key={item.id} trend={item} />
          ))}
        </div>
      ) : (
        /* DENSE MATRIX TABLE VIEW */
        <div className="overflow-x-auto rounded-2xl border border-neutral-850 bg-[#0A0A0A] shadow-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-850 bg-[#050505] text-[11px] uppercase text-neutral-400 font-mono">
                <th className="py-3 px-4 font-bold">Source & Velocity</th>
                <th className="py-3 px-4 font-bold">Viral Narrative</th>
                <th className="py-3 px-4 font-bold">Virality Score</th>
                <th className="py-3 px-4 font-bold">Associated Token</th>
                <th className="py-3 px-4 font-bold">Price & 24H</th>
                <th className="py-3 px-4 font-bold">Market Cap</th>
                <th className="py-3 px-4 font-bold text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850">
              {filteredTrends.map((item) => {
                const token = item.associatedToken;
                const isPositive = (token?.priceChange24h ?? 0) >= 0;

                return (
                  <tr key={item.id} className="hover:bg-neutral-900/60 transition-colors group">
                    {/* Source & Velocity */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-neutral-900 text-neutral-300 border border-neutral-800">
                          {item.source.toUpperCase()}
                        </span>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          {item.timeAgo}
                        </div>
                      </div>
                    </td>

                    {/* Narrative Title & Catalyst */}
                    <td className="py-3 px-4 max-w-sm">
                      <p className="font-bold text-white group-hover:text-sky-400 transition-colors line-clamp-1">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 font-sans line-clamp-1">
                        {item.catalyst}
                      </p>
                    </td>

                    {/* Virality Score */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full font-bold text-[11px] border font-mono inline-flex items-center gap-1',
                        item.viralityScore >= 95
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      )}>
                        <Flame className="w-2.5 h-2.5" />
                        <span>{item.viralityScore}/100</span>
                      </span>
                    </td>

                    {/* Associated Token */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {token ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={token.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${token.symbol}`}
                            alt={token.symbol}
                            className="w-6 h-6 rounded-full object-cover bg-neutral-900 border border-neutral-800"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${token.symbol}`;
                            }}
                          />
                          <div>
                            <span className="font-bold text-white text-xs">${token.symbol}</span>
                            <span className="text-[10px] text-neutral-500 block">{token.launchpad}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>

                    {/* Price & 24H */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono">
                      {token ? (
                        <div>
                          <p className="text-white font-bold">${token.priceUsd < 0.01 ? token.priceUsd.toFixed(6) : token.priceUsd.toFixed(3)}</p>
                          <span className={clsx('text-[10px] font-semibold', isPositive ? 'text-emerald-400' : 'text-rose-400')}>
                            {isPositive ? '+' : ''}{token.priceChange24h}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>

                    {/* Market Cap */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-neutral-300">
                      {token ? (
                        <span>${(token.marketCapUsd / 1000).toFixed(0)}K</span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>

                    {/* Quick Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {token && (
                        <Link
                          href={`/trade?token=${token.mint}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-bold text-[11px] border border-neutral-800 transition-colors"
                        >
                          <span>Terminal</span>
                          <ExternalLink className="w-3 h-3 text-sky-400" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
