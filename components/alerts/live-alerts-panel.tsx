'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Coins,
  Brain,
  Crown,
  ShieldAlert,
  Zap,
  BarChart2,
  CheckCircle2,
  Radio,
  Search,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveAlerts } from '@/lib/hooks/use-live-alerts';
import { useAppActions } from '@/lib/store';
import type { LiveAlertCategory, LiveTradeAlert } from '@/lib/alerts/live-alert-types';

export function LiveAlertsPanel() {
  const router = useRouter();
  const {
    alertHistory,
    soundEnabled,
    toggleSound,
    isPaused,
    setPaused,
    filter,
    setCategoryFilter,
    setMinSolFilter,
    stats,
  } = useLiveAlerts();

  const { setQuickBuyOpen, setSelectedToken } = useAppActions();
  const [search, setSearch] = useState('');

  const categories: { id: LiveAlertCategory; label: string; icon: any; count?: number }[] = [
    { id: 'all', label: 'All Live Signals', icon: Radio, count: alertHistory.length },
    { id: 'calls', label: 'Alpha Calls & KOLs', icon: Sparkles, count: stats.callsCount },
    { id: 'trades', label: 'Whale Swaps', icon: Coins, count: stats.whaleBuysCount },
    { id: 'smart_money', label: 'Smart Money Inflow', icon: Brain, count: stats.smartMoneyCount },
    { id: 'launchpad', label: 'Pump.fun & KotH', icon: Crown, count: stats.milestonesCount },
    { id: 'risks', label: 'Security Threats', icon: ShieldAlert, count: stats.risksCount },
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
  };

  const filtered = alertHistory.filter((alert) => {
    if (filter.category === 'calls' && alert.type !== 'CALL') return false;
    if (filter.category === 'trades' && alert.type !== 'WHALE_TRADE') return false;
    if (filter.category === 'smart_money' && alert.type !== 'SMART_MONEY') return false;
    if (filter.category === 'launchpad' && alert.type !== 'LAUNCHPAD_MILESTONE') return false;
    if (filter.category === 'risks' && alert.type !== 'RISK_ALERT') return false;

    if (filter.minSol > 0 && alert.trade && alert.trade.amountSol < filter.minSol) {
      return false;
    }

    if (search) {
      const q = search.toLowerCase();
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
    <div className="space-y-4">
      {/* Top Banner Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-900/60 flex items-center justify-between">
          <div>
            <span className="text-3xs font-mono uppercase text-slate-400">Total Live Alerts</span>
            <div className="text-xl font-bold font-numeric text-white">{stats.totalAlertsToday}</div>
          </div>
          <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
        </div>

        <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-900/60 flex items-center justify-between">
          <div>
            <span className="text-3xs font-mono uppercase text-cyan-400">KOL Alpha Calls</span>
            <div className="text-xl font-bold font-numeric text-cyan-300">{stats.callsCount}</div>
          </div>
          <Sparkles className="w-5 h-5 text-cyan-400" />
        </div>

        <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-900/60 flex items-center justify-between">
          <div>
            <span className="text-3xs font-mono uppercase text-purple-400">Whale Buys</span>
            <div className="text-xl font-bold font-numeric text-purple-300">{stats.whaleBuysCount}</div>
          </div>
          <Coins className="w-5 h-5 text-purple-400" />
        </div>

        <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-900/60 flex items-center justify-between">
          <div>
            <span className="text-3xs font-mono uppercase text-amber-400">KotH & Milestones</span>
            <div className="text-xl font-bold font-numeric text-amber-300">{stats.milestonesCount}</div>
          </div>
          <Crown className="w-5 h-5 text-amber-400" />
        </div>
      </div>

      {/* Control Bar: Categories, Filters, Search & Sound */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-900/40">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = filter.category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 border select-none',
                  isActive
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border-transparent'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                {cat.count !== undefined && cat.count > 0 && (
                  <span className="font-mono text-3xs opacity-75">({cat.count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token or caller..."
              className="pl-8 pr-2 py-1 rounded-lg bg-black/60 border border-sentinel-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono w-44"
            />
          </div>

          {/* Min SOL Filter */}
          <select
            value={filter.minSol}
            onChange={(e) => setMinSolFilter(Number(e.target.value))}
            className="bg-black/60 border border-sentinel-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="0">All Sizes</option>
            <option value="1">&gt; 1 SOL</option>
            <option value="5">&gt; 5 SOL</option>
            <option value="10">&gt; 10 SOL</option>
          </select>

          {/* Stream Pause/Play */}
          <button
            onClick={() => setPaused(!isPaused)}
            className={clsx(
              'p-1.5 rounded-lg border transition',
              isPaused
                ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                : 'bg-sentinel-850 border-sentinel-700 text-slate-300 hover:text-white'
            )}
            title={isPaused ? 'Resume live feed' : 'Pause live feed'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Audio Mute/Unmute */}
          <button
            onClick={toggleSound}
            className={clsx(
              'p-1.5 rounded-lg border transition',
              soundEnabled
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                : 'bg-sentinel-850 border-sentinel-700 text-slate-500 hover:text-slate-300'
            )}
            title={soundEnabled ? 'Alert audio ON' : 'Alert audio MUTED'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Live Alerts Stream Feed */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-500 rounded-xl border border-dashed border-sentinel-800">
            <Radio className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-300">No live alerts matching criteria</p>
            <p className="text-xs text-slate-500">Listening to Telegram alpha channels, smart wallets, and launchpad feeds...</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isCall = item.type === 'CALL';
            const isWhale = item.type === 'WHALE_TRADE';
            const isSmart = item.type === 'SMART_MONEY';
            const isKoth = item.type === 'LAUNCHPAD_MILESTONE';

            return (
              <div
                key={item.id}
                className={clsx(
                  'p-3.5 rounded-xl border bg-sentinel-950/80 backdrop-blur-md transition-all hover:bg-sentinel-900/60',
                  isCall && 'border-cyan-500/25 hover:border-cyan-500/50',
                  isWhale && 'border-purple-500/25 hover:border-purple-500/50',
                  isSmart && 'border-emerald-500/25 hover:border-emerald-500/50',
                  isKoth && 'border-amber-500/25 hover:border-amber-500/50',
                  item.type === 'RISK_ALERT' && 'border-rose-500/25 hover:border-rose-500/50'
                )}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left: Token info + caller */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <img
                      src={item.token.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${item.token.symbol}`}
                      alt={item.token.symbol}
                      className="w-10 h-10 rounded-lg object-cover bg-sentinel-900 border border-white/10 shrink-0 mt-0.5"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${item.token.symbol}`;
                      }}
                    />

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Type badge */}
                        <span
                          className={clsx(
                            'px-1.5 py-0.2 rounded font-mono text-3xs font-bold uppercase border',
                            isCall && 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50',
                            isWhale && 'bg-purple-950/80 text-purple-300 border-purple-700/50',
                            isSmart && 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
                            isKoth && 'bg-amber-950/80 text-amber-300 border-amber-700/50',
                            item.type === 'RISK_ALERT' && 'bg-rose-950/80 text-rose-300 border-rose-700/50'
                          )}
                        >
                          {item.type.replace('_', ' ')}
                        </span>

                        <span className="font-bold text-sm text-white">${item.token.symbol}</span>
                        <span className="text-xs text-slate-400 truncate max-w-[140px]">{item.token.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/[0.08] text-slate-300 font-numeric text-2xs">
                          {formatMarketCap(item.token.marketCapUsd)}
                        </span>

                        {item.caller && (
                          <span className="flex items-center gap-1 text-2xs text-cyan-300 font-medium">
                            • Caller: <strong>{item.caller.name}</strong>
                            {item.caller.isVerified && <CheckCircle2 className="w-3 h-3 text-cyan-400" />}
                            {item.caller.winRate && (
                              <span className="px-1 rounded bg-cyan-950 text-cyan-400 text-3xs font-mono">
                                {item.caller.winRate}% WR
                              </span>
                            )}
                          </span>
                        )}

                        {item.trade && (
                          <span className="flex items-center gap-1 text-2xs text-purple-300 font-mono">
                            • {item.trade.traderLabel || item.trade.traderAddress} (+{item.trade.amountSol} SOL)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.message}</p>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-3xs font-mono text-slate-500 mr-1">
                      {formatTimeAgo(item.timestamp)}
                    </span>

                    <button
                      onClick={() => handleQuickBuy(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition shadow-md active:scale-95"
                      title="Quick Buy Token"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Buy {item.quickBuyDefaultSol || 0.5}</span>
                    </button>

                    <button
                      onClick={() => handleOpenChart(item)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sentinel-850 hover:bg-sentinel-800 border border-sentinel-700 text-slate-300 hover:text-white transition font-mono text-xs"
                      title="Open Terminal Chart"
                    >
                      <BarChart2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Chart</span>
                    </button>

                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-sentinel-850 hover:bg-sentinel-800 border border-sentinel-700 text-slate-400 hover:text-white transition"
                        title="View Call Source"
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
    </div>
  );
}
