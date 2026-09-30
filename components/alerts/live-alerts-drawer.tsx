'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Search,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Sparkles,
  Coins,
  Brain,
  Crown,
  ShieldAlert,
  Zap,
  BarChart2,
  CheckCircle2,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveAlerts } from '@/lib/hooks/use-live-alerts';
import { useAppActions } from '@/lib/store';
import type { LiveAlertCategory, LiveTradeAlert } from '@/lib/alerts/live-alert-types';

export function LiveAlertsDrawer() {
  const router = useRouter();
  const {
    isHistoryDrawerOpen,
    setHistoryDrawerOpen,
    alertHistory,
    soundEnabled,
    toggleSound,
    isPaused,
    setPaused,
    filter,
    setCategoryFilter,
    setMinSolFilter,
    setSearchQuery,
    clearHistory,
    stats,
  } = useLiveAlerts();

  const { setQuickBuyOpen, setSelectedToken } = useAppActions();
  const [localSearch, setLocalSearch] = useState('');

  if (!isHistoryDrawerOpen) return null;

  const categories: { id: LiveAlertCategory; label: string; icon: any; count?: number }[] = [
    { id: 'all', label: 'All', icon: Radio, count: alertHistory.length },
    { id: 'calls', label: 'KOL Calls', icon: Sparkles, count: stats.callsCount },
    { id: 'trades', label: 'Whale Buys', icon: Coins, count: stats.whaleBuysCount },
    { id: 'smart_money', label: 'Smart Money', icon: Brain, count: stats.smartMoneyCount },
    { id: 'launchpad', label: 'Milestones', icon: Crown, count: stats.milestonesCount },
    { id: 'risks', label: 'Risks', icon: ShieldAlert, count: stats.risksCount },
  ];

  const handleQuickBuy = (item: LiveTradeAlert) => {
    setQuickBuyOpen(true, {
      mint: item.token.mint,
      symbol: item.token.symbol,
      name: item.token.name,
      price: String(item.token.priceUsd),
      mcap: String(item.token.marketCapUsd),
      customAmountSol: item.quickBuyDefaultSol || 0.5,
      liquidity: item.token.liquidityUsd ? String(item.token.liquidityUsd) : undefined,
      logoURI: item.token.avatarUrl,
    });
    setHistoryDrawerOpen(false);
  };

  const handleOpenChart = (item: LiveTradeAlert) => {
    setSelectedToken({
      mint: item.token.mint,
      symbol: item.token.symbol,
      name: item.token.name,
      priceUsd: String(item.token.priceUsd),
      marketCapUsd: String(item.token.marketCapUsd),
      logoUrl: item.token.avatarUrl,
      chain: 'solana',
    });
    router.push(`/trade?token=${encodeURIComponent(item.token.mint)}`);
    setHistoryDrawerOpen(false);
  };

  const filteredHistory = alertHistory.filter((alert) => {
    if (filter.category === 'calls' && alert.type !== 'CALL') return false;
    if (filter.category === 'trades' && alert.type !== 'WHALE_TRADE') return false;
    if (filter.category === 'smart_money' && alert.type !== 'SMART_MONEY') return false;
    if (filter.category === 'launchpad' && alert.type !== 'LAUNCHPAD_MILESTONE') return false;
    if (filter.category === 'risks' && alert.type !== 'RISK_ALERT') return false;

    if (filter.minSol > 0 && alert.trade && alert.trade.amountSol < filter.minSol) {
      return false;
    }

    if (localSearch) {
      const q = localSearch.toLowerCase();
      const matchSymbol = alert.token.symbol.toLowerCase().includes(q);
      const matchName = alert.token.name.toLowerCase().includes(q);
      const matchCaller = alert.caller?.name.toLowerCase().includes(q);
      const matchTrader = alert.trade?.traderLabel?.toLowerCase().includes(q);
      if (!matchSymbol && !matchName && !matchCaller && !matchTrader) return false;
    }

    return true;
  });

  const formatMarketCap = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  const formatTimeAgo = (timestampMs: number) => {
    const diffSec = Math.max(1, Math.round((Date.now() - timestampMs) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return (
    <div
      role="dialog"
      aria-label="Live Trade Alerts Feed"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] md:w-[500px] bg-sentinel-950/98 backdrop-blur-2xl border-l border-sentinel-800 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right"
    >
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-sentinel-800 bg-black/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-sm tracking-wide">Live Trade Alerts</h2>
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-[10px] font-mono text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                STREAM
              </span>
            </div>
            <p className="text-3xs text-slate-400 font-mono">Trojan & BullX Signal Engine</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 text-slate-400">
          {/* Pause / Resume */}
          <button
            onClick={() => setPaused(!isPaused)}
            className={clsx(
              'p-1.5 rounded hover:text-white hover:bg-white/[0.08] transition',
              isPaused ? 'text-amber-400 bg-amber-950/40' : 'text-slate-400'
            )}
            title={isPaused ? 'Stream paused (Click to resume)' : 'Stream live (Click to pause)'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={clsx(
              'p-1.5 rounded hover:text-white hover:bg-white/[0.08] transition',
              soundEnabled ? 'text-sky-400' : 'text-slate-500'
            )}
            title={soundEnabled ? 'Alert audio ON (Click to mute)' : 'Alert audio MUTED (Click to unmute)'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Clear History */}
          <button
            onClick={clearHistory}
            className="p-1.5 rounded hover:text-rose-400 hover:bg-white/[0.08] transition text-slate-400"
            title="Clear Feed History"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            onClick={() => setHistoryDrawerOpen(false)}
            className="p-1.5 rounded hover:text-white hover:bg-white/[0.08] transition ml-1"
            title="Close Drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Pills Strip */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-sentinel-800/80 bg-sentinel-950 overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = filter.category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium transition shrink-0',
                isActive
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
              )}
            >
              <Icon className="w-3 h-3" />
              <span>{cat.label}</span>
              {cat.count !== undefined && cat.count > 0 && (
                <span className="text-3xs font-mono opacity-80">({cat.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter / Search Bar */}
      <div className="shrink-0 px-3 py-2 border-b border-sentinel-800/80 bg-sentinel-900/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter by $token or caller..."
            className="w-full pl-8 pr-3 py-1 rounded bg-black/60 border border-sentinel-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        {/* Min Sol Size Filter */}
        <select
          value={filter.minSol}
          onChange={(e) => setMinSolFilter(Number(e.target.value))}
          className="bg-black/60 border border-sentinel-700 rounded px-2 py-1 text-2xs font-mono text-slate-300 focus:outline-none focus:border-sky-500"
        >
          <option value="0">All Sizes</option>
          <option value="1">&gt; 1 SOL</option>
          <option value="5">&gt; 5 SOL</option>
          <option value="10">&gt; 10 SOL</option>
        </select>
      </div>

      {/* Stream Feed List */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-white/[0.04]">
        {filteredHistory.length === 0 ? (
          <div className="py-20 px-6 text-center text-slate-500 space-y-2">
            <Radio className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-300">No alerts in this view</p>
            <p className="text-2xs text-slate-500">
              {localSearch ? `No matches for "${localSearch}"` : 'Waiting for incoming calls and trades...'}
            </p>
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isCall = item.type === 'CALL';
            const isWhale = item.type === 'WHALE_TRADE';
            const isSmart = item.type === 'SMART_MONEY';

            return (
              <div
                key={item.id}
                className="p-3.5 hover:bg-white/[0.02] transition space-y-2 group"
              >
                {/* Meta header */}
                <div className="flex items-center justify-between text-2xs">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={clsx(
                        'px-1.5 py-0.2 rounded font-mono text-3xs font-bold uppercase border',
                        isCall
                          ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50'
                          : isWhale
                          ? 'bg-purple-950/80 text-purple-300 border-purple-700/50'
                          : isSmart
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50'
                          : 'bg-amber-950/80 text-amber-300 border-amber-700/50'
                      )}
                    >
                      {item.type.replace('_', ' ')}
                    </span>

                    {item.caller && (
                      <span className="font-semibold text-slate-200 truncate flex items-center gap-1">
                        {item.caller.name}
                        {item.caller.isVerified && (
                          <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                        )}
                      </span>
                    )}

                    {item.trade && (
                      <span className="font-mono text-slate-400">
                        {item.trade.traderLabel || item.trade.traderAddress}
                      </span>
                    )}
                  </div>

                  <span className="text-3xs font-mono text-slate-500 shrink-0">
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </div>

                {/* Token & details */}
                <div className="flex items-center gap-3">
                  <img
                    src={item.token.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${item.token.symbol}`}
                    alt={item.token.symbol}
                    className="w-9 h-9 rounded-lg object-cover bg-sentinel-900 border border-white/10 shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${item.token.symbol}`;
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">${item.token.symbol}</span>
                      <span className="text-3xs font-numeric text-slate-400">
                        {formatMarketCap(item.token.marketCapUsd)}
                      </span>
                      {item.token.priceChange24h !== undefined && (
                        <span
                          className={clsx(
                            'text-3xs font-mono font-semibold',
                            item.token.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          )}
                        >
                          {item.token.priceChange24h >= 0 ? '+' : ''}
                          {item.token.priceChange24h}%
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-slate-300 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleQuickBuy(item)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-2xs font-bold transition shadow-sm"
                      title="Quick Buy"
                    >
                      <Zap className="w-3 h-3 fill-current" />
                      <span>Buy</span>
                    </button>

                    <button
                      onClick={() => handleOpenChart(item)}
                      className="p-1 rounded-md bg-sentinel-850 hover:bg-sentinel-800 border border-sentinel-700 text-slate-300 hover:text-white transition"
                      title="Open Chart"
                    >
                      <BarChart2 className="w-3.5 h-3.5 text-sky-400" />
                    </button>

                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-md bg-sentinel-850 hover:bg-sentinel-800 border border-sentinel-700 text-slate-400 hover:text-white transition"
                        title="View Signal Source"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Ribbon */}
      <div className="shrink-0 px-4 py-2 border-t border-sentinel-800 bg-black/60 flex items-center justify-between text-2xs font-numeric text-slate-400">
        <div>
          <span>Today: <strong className="text-white">{stats.totalAlertsToday}</strong></span>
          <span className="mx-2 text-slate-600">|</span>
          <span>Calls: <strong className="text-cyan-400">{stats.callsCount}</strong></span>
          <span className="mx-2 text-slate-600">|</span>
          <span>Whales: <strong className="text-purple-400">{stats.whaleBuysCount}</strong></span>
        </div>
        <span className="font-mono text-3xs text-emerald-400">Real-time Stream Active</span>
      </div>
    </div>
  );
}
