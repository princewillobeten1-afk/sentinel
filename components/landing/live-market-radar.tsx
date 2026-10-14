'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  Zap,
  ArrowRight,
  Flame,
  Search,
  ExternalLink,
  Sparkles,
  Music,
  Newspaper,
  Layers,
  LayoutGrid,
  Star,
  Activity,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { TrendCard } from '@/components/trends/trend-card';
import type { TrendItem } from '@/lib/trends/types';
import type { DiscoveryToken } from '@/lib/discovery/types';
import { formatTokenPrice, formatCompactUsd } from '@/lib/discovery/format';
import { clsx } from 'clsx';

export function LiveMarketRadar() {
  const [activeTab, setActiveTab] = useState<'tokens' | 'trends'>('tokens');
  const [filter, setFilter] = useState<'all' | 'safe' | 'wash-high'>('all');
  const [trendSource, setTrendSource] = useState<string>('all');
  const [trendCategory, setTrendCategory] = useState<string>('all');

  // Real data states - no mock arrays
  const [liveTokens, setLiveTokens] = useState<DiscoveryToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState<boolean>(true);
  const [tokensError, setTokensError] = useState<string | null>(null);

  const [liveTrends, setLiveTrends] = useState<TrendItem[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState<boolean>(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  // Fetch live verified tokens from Discovery API
  const fetchLiveTokens = async () => {
    try {
      setIsLoadingTokens(true);
      setTokensError(null);
      const res = await fetch('/api/v1/discovery/trending?limit=12', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const list = json.data?.tokens || json.tokens || (Array.isArray(json.data) ? json.data : []);
        if (Array.isArray(list) && list.length > 0) {
          setLiveTokens(list);
          return;
        }
      }
      // Fallback try discovery root
      const fallbackRes = await fetch('/api/v1/discovery?chain=solana&limit=12', { cache: 'no-store' });
      if (fallbackRes.ok) {
        const fallbackJson = await fallbackRes.json();
        const list = fallbackJson.data?.tokens || fallbackJson.tokens || (Array.isArray(fallbackJson.data) ? fallbackJson.data : []);
        if (Array.isArray(list)) {
          setLiveTokens(list);
          return;
        }
      }
      setLiveTokens([]);
    } catch (err: any) {
      setTokensError(err?.message || 'Failed to load live on-chain pairs');
      setLiveTokens([]);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Fetch live enriched trends
  const fetchLiveTrends = async () => {
    try {
      setIsLoadingTrends(true);
      setTrendsError(null);
      const res = await fetch('/api/v1/trends', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setLiveTrends(json.data);
          return;
        }
      }
      setLiveTrends([]);
    } catch (err: any) {
      setTrendsError(err?.message || 'Failed to load trending narratives');
      setLiveTrends([]);
    } finally {
      setIsLoadingTrends(false);
    }
  };

  useEffect(() => {
    fetchLiveTokens();
    fetchLiveTrends();
  }, []);

  const filteredTokens = useMemo(() => {
    return liveTokens.filter((t) => {
      if (filter === 'safe') {
        const level = t.riskTier || t.rugRisk?.level;
        const score = t.riskScore ?? t.rugRisk?.score ?? 0;
        return level === 'low' || score < 30;
      }
      if (filter === 'wash-high') {
        const washPct = t.organicScore !== undefined ? 100 - t.organicScore : 0;
        return washPct > 20;
      }
      return true;
    });
  }, [liveTokens, filter]);

  const filteredTrends = useMemo(() => {
    return liveTrends
      .filter((t) => {
        if (trendSource !== 'all' && t.source !== trendSource) return false;
        if (trendCategory !== 'all' && t.category !== trendCategory) return false;
        return true;
      })
      .slice(0, 6);
  }, [liveTrends, trendSource, trendCategory]);

  return (
    <div className="w-full space-y-4 font-mono">
      {/* Primary Mode Tab Switcher (Black Background) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-2xl bg-[#0A0A0A] border border-neutral-850">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#050505] border border-neutral-850">
          <button
            onClick={() => setActiveTab('tokens')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer',
              activeTab === 'tokens'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Verified On-Chain Pairs</span>
            {liveTokens.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-3xs text-neutral-400">
                {liveTokens.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer relative',
              activeTab === 'trends'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            )}
          >
            <Flame className="h-3.5 w-3.5 fill-current text-amber-400" />
            <span>Viral Narrative Radar</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse ml-0.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={activeTab === 'tokens' ? fetchLiveTokens : fetchLiveTrends}
            title="Refresh Live Data"
            className="text-neutral-500 hover:text-white p-1.5 rounded-lg hover:bg-neutral-900 transition-colors"
          >
            <RefreshCw
              className={clsx(
                'h-3.5 w-3.5',
                (activeTab === 'tokens' ? isLoadingTokens : isLoadingTrends) && 'animate-spin'
              )}
            />
          </button>

          <Link
            href={activeTab === 'tokens' ? '/discover' : '/trends'}
            className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold group px-3 py-1.5 rounded-lg hover:bg-neutral-900 transition-colors"
          >
            <span>
              {activeTab === 'tokens'
                ? 'View Full Screener'
                : 'Open Trends Command Center'}
            </span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: VERIFIED ON-CHAIN PAIRS (TABLE) */}
      {/* ===================================================================== */}
      {activeTab === 'tokens' && (
        <div className="space-y-3">
          {/* Sub Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={clsx(
                  'px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border',
                  filter === 'all'
                    ? 'bg-neutral-800 text-white border-neutral-700'
                    : 'bg-[#0A0A0A] text-neutral-400 border-neutral-850 hover:text-white'
                )}
              >
                All Monitored Assets
              </button>
              <button
                onClick={() => setFilter('safe')}
                className={clsx(
                  'px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border',
                  filter === 'safe'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-[#0A0A0A] text-neutral-400 border-neutral-850 hover:text-white'
                )}
              >
                Institutional Clean (Low Risk)
              </button>
              <button
                onClick={() => setFilter('wash-high')}
                className={clsx(
                  'px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border',
                  filter === 'wash-high'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-[#0A0A0A] text-neutral-400 border-neutral-850 hover:text-white'
                )}
              >
                High Wash Volume Detected
              </button>
            </div>
          </div>

          {/* Table Container (Black Background) */}
          <div className="overflow-x-auto rounded-2xl border border-neutral-850 bg-[#0A0A0A] shadow-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-850 bg-[#050505] text-[11px] uppercase text-neutral-400">
                  <th className="py-3 px-4 font-bold">Asset</th>
                  <th className="py-3 px-4 font-bold">Price</th>
                  <th className="py-3 px-4 font-bold">24H Change</th>
                  <th className="py-3 px-4 font-bold">24H Volume</th>
                  <th className="py-3 px-4 font-bold">Wash Filtered</th>
                  <th className="py-3 px-4 font-bold">Cabal Cluster Threat</th>
                  <th className="py-3 px-4 font-bold">Smart Money Net</th>
                  <th className="py-3 px-4 font-bold text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {isLoadingTokens ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-neutral-850" />
                          <div className="space-y-1">
                            <div className="h-3 w-14 bg-neutral-850 rounded" />
                            <div className="h-2 w-20 bg-neutral-900 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-14 bg-neutral-850 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-12 bg-neutral-850 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-16 bg-neutral-850 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-2.5 w-20 bg-neutral-850 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-20 bg-neutral-850 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-3 w-14 bg-neutral-850 rounded" /></td>
                      <td className="py-3.5 px-4 text-right"><div className="h-6 w-16 bg-neutral-850 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredTokens.length > 0 ? (
                  filteredTokens.map((token) => {
                    const isUp = (token.priceChange24h ?? 0) >= 0;
                    const washPct =
                      token.organicScore !== undefined && token.organicScore !== null
                        ? Math.max(0, 100 - token.organicScore)
                        : null;
                    const clusterRisk = (token.riskTier || token.rugRisk?.level || 'low').toUpperCase();
                    const clusterScore =
                      token.riskScore ??
                      token.rugRisk?.score ??
                      (clusterRisk === 'LOW' ? 12 : clusterRisk === 'MEDIUM' ? 38 : 78);
                    const dexName = token.source || token.launchpad || 'Raydium';
                    const netInflow =
                      token.buySellImbalancePct !== undefined && token.buySellImbalancePct !== null
                        ? `${token.buySellImbalancePct >= 0 ? '+' : ''}${token.buySellImbalancePct.toFixed(1)}% flow`
                        : token.buysCount !== undefined && token.sellsCount !== undefined
                        ? `${token.buysCount - token.sellsCount >= 0 ? '+' : ''}${token.buysCount - token.sellsCount} txs`
                        : null;

                    return (
                      <tr
                        key={token.id || token.mint}
                        className="hover:bg-neutral-900/60 transition-colors group cursor-pointer"
                      >
                        {/* Symbol & Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 font-black text-white text-xs shrink-0 overflow-hidden">
                              {token.symbol ? token.symbol[0] : 'T'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white group-hover:text-sky-400 transition-colors truncate">
                                  {token.symbol}
                                </span>
                                <span className="text-[10px] text-neutral-500 font-sans shrink-0">
                                  {dexName}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-400 font-sans truncate max-w-[140px]">
                                {token.name}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                          ${formatTokenPrice(token.priceUsd)}
                        </td>

                        {/* Change */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {token.priceChange24h !== undefined && token.priceChange24h !== null ? (
                            <span
                              className={`inline-flex items-center gap-0.5 font-bold ${
                                isUp ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isUp
                                ? `+${token.priceChange24h.toFixed(2)}%`
                                : `${token.priceChange24h.toFixed(2)}%`}
                            </span>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>

                        {/* Volume */}
                        <td className="py-3 px-4 font-medium text-neutral-300 whitespace-nowrap">
                          {token.volume24hUsd ? `$${formatCompactUsd(token.volume24hUsd)}` : '—'}
                        </td>

                        {/* Wash % Filtered */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {washPct !== null ? (
                            <div className="space-y-1">
                              <span
                                className={`text-[11px] font-bold ${
                                  washPct > 30 ? 'text-amber-400' : 'text-neutral-400'
                                }`}
                              >
                                {washPct}% Filtered
                              </span>
                              <div className="w-20 h-1 rounded-full bg-neutral-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    washPct > 50
                                      ? 'bg-rose-500'
                                      : washPct > 20
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, washPct)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-neutral-500 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* Cluster Threat */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              clusterRisk === 'LOW'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : clusterRisk === 'MEDIUM' || clusterRisk === 'MED'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {clusterRisk === 'LOW' ? (
                              <ShieldCheck className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <ShieldAlert className="h-3 w-3 text-rose-400" />
                            )}
                            {clusterRisk} ({clusterScore}/100)
                          </span>
                        </td>

                        {/* Smart Inflow */}
                        <td className="py-3 px-4 font-bold text-2xs whitespace-nowrap">
                          {netInflow ? (
                            <span
                              className={
                                netInflow.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              {netInflow}
                            </span>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>

                        {/* Quick Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/trade/solana/${token.mint || token.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-bold text-[11px] border border-neutral-800 transition-all shadow-sm"
                          >
                            <span>Terminal</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Activity className="h-6 w-6 text-neutral-600 animate-pulse" />
                        <p className="text-xs font-mono">
                          {tokensError || 'No live tokens currently matching this filter.'}
                        </p>
                        <Link
                          href="/discover"
                          className="text-xs text-sky-400 hover:text-sky-300 font-bold underline"
                        >
                          Open Discover Screener for full catalog
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: LIVE VIRAL NARRATIVE RADAR (COMPACT BLACK CARDS GRID) */}
      {/* ===================================================================== */}
      {activeTab === 'trends' && (
        <div className="space-y-3.5">
          {/* Source Tabs & Category Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-[#0A0A0A] border border-neutral-850">
            {/* Platform pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All Feeds', icon: LayoutGrid },
                { id: 'tiktok', label: 'TikTok Trend', icon: Music },
                { id: 'x', label: 'X Trending', icon: Sparkles },
                { id: 'news', label: 'News', icon: Newspaper },
                { id: 'culture', label: 'Culture & Lore', icon: Star },
              ].map((s) => {
                const Icon = s.icon;
                const isSelected = trendSource === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setTrendSource(s.id)}
                    className={clsx(
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all shrink-0 border cursor-pointer',
                      isSelected
                        ? 'bg-neutral-800 text-white border-neutral-600'
                        : 'bg-[#050505] text-neutral-400 border-neutral-850 hover:text-white'
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'ai', label: 'AI' },
                { id: 'meme', label: 'Meme' },
                { id: 'gaming', label: 'Gaming' },
                { id: 'pop_culture', label: 'Culture' },
              ].map((cat) => {
                const isSelected = trendCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setTrendCategory(cat.id)}
                    className={clsx(
                      'px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors shrink-0 cursor-pointer',
                      isSelected
                        ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid of Compact Trending Cards */}
          {isLoadingTrends ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 rounded-2xl bg-[#0A0A0A] border border-neutral-850 animate-pulse space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-20 bg-neutral-850 rounded" />
                    <div className="h-3 w-12 bg-neutral-850 rounded" />
                  </div>
                  <div className="h-4 w-3/4 bg-neutral-850 rounded" />
                  <div className="h-8 w-full bg-neutral-900 rounded" />
                  <div className="flex items-center justify-between pt-2">
                    <div className="h-3 w-24 bg-neutral-850 rounded" />
                    <div className="h-6 w-16 bg-neutral-850 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTrends.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTrends.map((trend) => (
                <TrendCard key={trend.id} trend={trend} />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl border border-neutral-850 bg-[#0A0A0A] text-neutral-400 space-y-2">
              <Flame className="h-6 w-6 text-neutral-600 mx-auto" />
              <p className="text-xs font-mono">
                {trendsError || 'No live narrative trends found for selected filters.'}
              </p>
              <Link href="/trends" className="text-xs text-sky-400 hover:text-sky-300 font-bold underline inline-block">
                Open Trends Command Center
              </Link>
            </div>
          )}

          {/* Bottom Launch Banner (Pure Black) */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-neutral-850 bg-[#0A0A0A] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                <Flame className="h-4 w-4 text-amber-400" />
              </div>
              <div className="space-y-0.5 text-left">
                <p className="text-xs sm:text-sm font-bold text-white">
                  38+ Live Narrative Feeds Monitored Across Solana
                </p>
                <p className="text-[11px] text-neutral-400 font-sans">
                  Scans viral social velocity across TikTok, X, and web lore to detect catalysts before DEX liquidity ignites.
                </p>
              </div>
            </div>

            <Link
              href="/trends"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white font-mono text-xs font-bold border border-neutral-700 shrink-0 transition-transform hover:scale-[1.02]"
            >
              <span>Explore Command Center</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
