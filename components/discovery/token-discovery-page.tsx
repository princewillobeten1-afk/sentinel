'use client';

import React, { useState, useEffect } from 'react';
import {
  Compass,
  Flame,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Droplets,
  Activity,
  Filter,
  LayoutGrid,
  List,
  Search,
} from 'lucide-react';
import { rankingEngine } from '@/lib/market-data/rankings/ranking-engine';
import { RankedTokenItem } from '@/lib/market-data/types';
import { TokenDiscoveryCard } from './token-discovery-card';
import { PriceChange } from '../market/price-change';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type DiscoveryTab = 'trending' | 'new' | 'gainers' | 'losers' | 'liquid' | 'volume';

export function TokenDiscoveryPage() {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('trending');
  const [chainFilter, setChainFilter] = useState('all');
  const [minLiq, setMinLiq] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [items, setItems] = useState<RankedTokenItem[]>([]);

  useEffect(() => {
    let result: RankedTokenItem[] = [];

    if (activeTab === 'trending') {
      result = rankingEngine.getTrendingTokens(20);
    } else if (activeTab === 'new') {
      result = rankingEngine.getNewTokensFeed({ minLiquidityUsd: minLiq, limit: 20 });
    } else if (activeTab === 'gainers') {
      result = rankingEngine.getTopGainers('24h', 20);
    } else if (activeTab === 'losers') {
      result = rankingEngine.getTopLosers('24h', 20);
    } else if (activeTab === 'liquid') {
      result = rankingEngine.getMostLiquidTokens(20);
    } else if (activeTab === 'volume') {
      result = rankingEngine.getHighestVolumeTokens(20);
    }

    if (minLiq > 0) {
      result = result.filter((item) => item.liquidityUsd >= minLiq);
    }

    setItems(result);
  }, [activeTab, minLiq]);

  const tabs = [
    { id: 'trending', label: 'Trending', icon: Flame },
    { id: 'new', label: 'New Tokens', icon: Sparkles },
    { id: 'gainers', label: 'Top Gainers', icon: TrendingUp },
    { id: 'losers', label: 'Top Losers', icon: TrendingDown },
    { id: 'liquid', label: 'Most Liquid', icon: Droplets },
    { id: 'volume', label: 'Highest Volume', icon: Activity },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 font-mono">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
            <Compass className="h-6 w-6 text-sky-400" />
            Token Discovery & Markets
          </h1>
          <p className="text-xs text-slate-400 pt-1">
            Explore trending pools, freshly launched tokens, liquidity depth, and top market movers.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition ${
              viewMode === 'table' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Dense Table View"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition ${
              viewMode === 'grid' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Grid Cards View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category Tabs & Filter Matrix Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-2 border-b border-white/5">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DiscoveryTab)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                    : 'bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.05] border border-white/5'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Liquidity Minimum Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500 text-2xs">Min Liq:</span>
          <div className="flex items-center gap-1">
            {[0, 10000, 50000, 250000].map((val) => (
              <button
                key={val}
                onClick={() => setMinLiq(val)}
                className={`px-2 py-1 rounded-lg text-2xs font-bold transition ${
                  minLiq === val
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {val === 0 ? 'All' : `>$${val / 1000}K`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Rendering: Grid vs Dense Table */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((token) => (
            <TokenDiscoveryCard key={token.tokenId} token={token} />
          ))}
        </div>
      ) : (
        <div className="w-full rounded-2xl bg-sentinel-900/40 border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-slate-400 text-2xs uppercase border-b border-white/5">
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">Token Pair</th>
                  <th className="p-3.5">Price (USD)</th>
                  <th className="p-3.5">24h Change</th>
                  <th className="p-3.5">24h Volume</th>
                  <th className="p-3.5">Liquidity Depth</th>
                  <th className="p-3.5 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item, idx) => (
                  <tr key={item.tokenId} className="hover:bg-white/[0.02] transition group">
                    <td className="p-3.5 text-slate-500 font-bold">{idx + 1}</td>

                    <td className="p-3.5">
                      <Link href={`/trade/solana/${item.tokenId}`} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-600/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-300 text-xs shrink-0">
                          {item.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <p className="font-bold text-white group-hover:text-sky-300 transition font-sans">
                            {item.name}
                            <span className="text-xs text-sky-400 ml-1.5 font-mono">${item.symbol}</span>
                          </p>
                        </div>
                      </Link>
                    </td>

                    <td className="p-3.5 font-bold text-white">
                      ${item.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>

                    <td className="p-3.5">
                      <PriceChange changePct={item.changePct} size="sm" />
                    </td>

                    <td className="p-3.5 text-slate-200">
                      ${(item.volumeUsd / 1_000_000).toFixed(2)}M
                    </td>

                    <td className="p-3.5 text-slate-200">
                      ${(item.liquidityUsd / 1_000_000).toFixed(2)}M
                    </td>

                    <td className="p-3.5 text-right">
                      <Link href={`/trade/solana/${item.tokenId}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-2xs h-7 px-3 border-sky-500/30 text-sky-300 hover:bg-sky-500/20"
                        >
                          Trade Terminal
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
