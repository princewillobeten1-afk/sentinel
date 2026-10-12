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
} from 'lucide-react';
import { TrendCard } from '@/components/trends/trend-card';
import { INITIAL_TREND_ITEMS } from '@/lib/trends/mock-trends-data';
import type { TrendItem } from '@/lib/trends/types';
import { clsx } from 'clsx';

interface RadarToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: string;
  washFilteredPct: number;
  clusterRisk: 'LOW' | 'MED' | 'HIGH';
  clusterScore: number;
  smartInflow: string;
  dex: string;
}

const RADAR_TOKENS: RadarToken[] = [
  {
    symbol: 'SOL',
    name: 'Solana Native',
    price: 154.2,
    change24h: 4.82,
    volume24h: '$3.8B',
    washFilteredPct: 4.2,
    clusterRisk: 'LOW',
    clusterScore: 6,
    smartInflow: '+$42.5M',
    dex: 'Raydium/Orca',
  },
  {
    symbol: 'JUP',
    name: 'Jupiter Exchange',
    price: 1.12,
    change24h: 8.41,
    volume24h: '$412M',
    washFilteredPct: 8.6,
    clusterRisk: 'LOW',
    clusterScore: 12,
    smartInflow: '+$8.9M',
    dex: 'Meteora/Jup',
  },
  {
    symbol: 'RAY',
    name: 'Raydium Protocol',
    price: 2.38,
    change24h: -2.15,
    volume24h: '$84M',
    washFilteredPct: 14.2,
    clusterRisk: 'MED',
    clusterScore: 28,
    smartInflow: '+$1.4M',
    dex: 'Raydium CPMM',
  },
  {
    symbol: 'PYTH',
    name: 'Pyth Network',
    price: 0.42,
    change24h: 3.19,
    volume24h: '$62M',
    washFilteredPct: 6.8,
    clusterRisk: 'LOW',
    clusterScore: 9,
    smartInflow: '+$3.2M',
    dex: 'Whirlpools',
  },
  {
    symbol: 'BONK',
    name: 'Bonk Community',
    price: 0.000024,
    change24h: 12.45,
    volume24h: '$195M',
    washFilteredPct: 32.4,
    clusterRisk: 'MED',
    clusterScore: 42,
    smartInflow: '+$4.1M',
    dex: 'Raydium/Orca',
  },
  {
    symbol: 'WIF',
    name: 'Dogwifhat',
    price: 2.84,
    change24h: -5.4,
    volume24h: '$340M',
    washFilteredPct: 22.1,
    clusterRisk: 'MED',
    clusterScore: 35,
    smartInflow: '-$2.8M',
    dex: 'Raydium CLMM',
  },
  {
    symbol: 'NOVA',
    name: 'Nova AI Agent',
    price: 0.084,
    change24h: 84.2,
    volume24h: '$12.4M',
    washFilteredPct: 68.5,
    clusterRisk: 'HIGH',
    clusterScore: 84,
    smartInflow: '-$420K (Exiting)',
    dex: 'Pump.fun',
  },
];

export function LiveMarketRadar() {
  const [activeTab, setActiveTab] = useState<'tokens' | 'trends'>('tokens');
  const [filter, setFilter] = useState<'all' | 'safe' | 'wash-high'>('all');
  const [trendSource, setTrendSource] = useState<string>('all');
  const [trendCategory, setTrendCategory] = useState<string>('all');
  const [liveTrends, setLiveTrends] = useState<TrendItem[]>(INITIAL_TREND_ITEMS);

  // Fetch live enriched trends on mount
  useEffect(() => {
    let isMounted = true;
    async function loadTrends() {
      try {
        const res = await fetch('/api/v1/trends');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0 && isMounted) {
            setLiveTrends(json.data);
          }
        }
      } catch (err) {
        // Fallback silently to initial curated trends
      }
    }
    loadTrends();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTokens = RADAR_TOKENS.filter((t) => {
    if (filter === 'safe') return t.clusterRisk === 'LOW';
    if (filter === 'wash-high') return t.washFilteredPct > 20;
    return true;
  });

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

        <Link
          href={activeTab === 'tokens' ? '/discover' : '/trends'}
          className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold group px-3 py-1.5 rounded-lg hover:bg-neutral-900 transition-colors"
        >
          <span>
            {activeTab === 'tokens'
              ? 'View Full Screener (2,400+ Pairs)'
              : 'Open Trends Command Center (38+ Feeds)'}
          </span>
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
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
                {filteredTokens.map((token) => {
                  const isUp = token.change24h >= 0;

                  return (
                    <tr
                      key={token.symbol}
                      className="hover:bg-neutral-900/60 transition-colors group cursor-pointer"
                    >
                      {/* Symbol & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 font-black text-white text-xs">
                            {token.symbol[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white group-hover:text-sky-400 transition-colors">
                                {token.symbol}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-sans">{token.dex}</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 font-sans">{token.name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-bold text-white">
                        ${token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(2)}
                      </td>

                      {/* Change */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isUp ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isUp ? `+${token.change24h}%` : `${token.change24h}%`}
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="py-3 px-4 font-medium text-neutral-300">
                        {token.volume24h}
                      </td>

                      {/* Wash % Filtered */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span
                            className={`text-[11px] font-bold ${
                              token.washFilteredPct > 30 ? 'text-amber-400' : 'text-neutral-400'
                            }`}
                          >
                            {token.washFilteredPct}% Filtered
                          </span>
                          <div className="w-20 h-1 rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                token.washFilteredPct > 50
                                  ? 'bg-rose-500'
                                  : token.washFilteredPct > 20
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, token.washFilteredPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Cluster Threat */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            token.clusterRisk === 'LOW'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : token.clusterRisk === 'MED'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {token.clusterRisk === 'LOW' ? (
                            <ShieldCheck className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="h-3 w-3 text-rose-400" />
                          )}
                          {token.clusterRisk} ({token.clusterScore}/100)
                        </span>
                      </td>

                      {/* Smart Inflow */}
                      <td className="py-3 px-4 font-bold text-2xs">
                        <span className={token.smartInflow.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}>
                          {token.smartInflow}
                        </span>
                      </td>

                      {/* Quick Action */}
                      <td className="py-3 px-4 text-right">
                        <Link
                          href="/trade"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-bold text-[11px] border border-neutral-800 transition-all shadow-sm"
                        >
                          <span>Terminal</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredTrends.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>

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
