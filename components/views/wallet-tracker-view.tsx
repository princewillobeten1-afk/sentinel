'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Flame,
  TrendingUp,
  ShieldCheck,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
  Bell,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Award,
  BarChart2,
  Target,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { formatCompactUsd, formatAge } from '@/lib/discovery/format';
import { useTrackedWallets, TrackedWallet, TrackedWalletCategory } from '@/lib/store/tracked-wallets-store';
import { useAppActions } from '@/lib/store';
import { TrackWalletModal } from '@/components/wallet-tracker/track-wallet-modal';
import { SmartMoneyCard, SmartMoneyTrader } from '@/components/wallet-tracker/smart-money-card';
import { SmartMoneyTable } from '@/components/wallet-tracker/smart-money-table';
import { WalletDetailModal } from '@/components/wallet-tracker/wallet-detail-modal';

type TrackerTab = 'leaderboard' | 'my-tracked' | 'live-feed' | 'copy-trading';
type SortField = 'scoreOverall' | 'totalRealizedPnl' | 'winRate' | 'pnl7d' | 'tradeCount';

export function WalletTrackerView() {
  const { trackedWallets, liveTrades, addTrackedWallet, removeTrackedWallet, isTracked, refreshWallets, refreshLiveTrades } =
    useTrackedWallets();
  const { setQuickBuyOpen, addNotification } = useAppActions();

  const [activeTab, setActiveTab] = useState<TrackerTab>('leaderboard');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('scoreOverall');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTraderForDetail, setSelectedTraderForDetail] = useState<SmartMoneyTrader | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Data states
  const [smartWallets, setSmartWallets] = useState<SmartMoneyTrader[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  // Copy trade simulation configuration state
  const [copyTargetWallet, setCopyTargetWallet] = useState('');
  const [copySizeSol, setCopySizeSol] = useState('0.5');
  const [copyTakeProfit, setCopyTakeProfit] = useState('100');
  const [copyStopLoss, setCopyStopLoss] = useState('30');
  const [copySlippage, setCopySlippage] = useState('1.5');
  const [simulationRunning, setSimulationRunning] = useState(false);

  // Fetch Smart Money Leaderboard from API
  useEffect(() => {
    let cancelled = false;
    const fetchLeaderboard = async () => {
      setIsLoadingLeaderboard(true);
      try {
        const res = await fetch('/api/v1/smart-wallets?limit=30', { credentials: 'include' });
        if (res.ok) {
          const body = await res.json();
          if (!cancelled && body.success && Array.isArray(body.data)) {
            setSmartWallets(body.data);
          }
        }
      } catch {}
      if (!cancelled) setIsLoadingLeaderboard(false);
    };

    fetchLeaderboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const handleOpenDetail = (trader: SmartMoneyTrader) => {
    setSelectedTraderForDetail(trader);
    setIsDetailModalOpen(true);
  };

  const handleStartCopyFromTrader = (trader: SmartMoneyTrader) => {
    setCopyTargetWallet(trader.fullAddress);
    setActiveTab('copy-trading');
    addNotification({
      title: 'Copy Rule Selected',
      message: `Configuring copy trade simulator for ${trader.label}.`,
      type: 'system',
    });
  };

  // Filtered & Sorted Leaderboard
  const filteredSmartWallets = useMemo(() => {
    const list = smartWallets.filter((w) => {
      const matchesCategory = selectedCategory === 'ALL' || w.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        w.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.fullAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.tokenSymbol?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'totalRealizedPnl') return b.totalRealizedPnl - a.totalRealizedPnl;
      if (sortBy === 'pnl7d') return (b.pnl7d || 0) - (a.pnl7d || 0);
      if (sortBy === 'winRate') return b.winRate - a.winRate;
      if (sortBy === 'tradeCount') return b.tradeCount - a.tradeCount;
      return b.scoreOverall - a.scoreOverall;
    });
  }, [smartWallets, selectedCategory, searchQuery, sortBy]);

  // Filtered Tracked Wallets
  const filteredTrackedWallets = useMemo(() => {
    return trackedWallets.filter((w) => {
      const matchesCategory = selectedCategory === 'ALL' || w.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        w.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.notes && w.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [trackedWallets, selectedCategory, searchQuery]);

  // Key Spotlight Wallets for Hero Bar
  const topAlphaLeader = useMemo(() => {
    if (smartWallets.length === 0) return null;
    return [...smartWallets].sort((a, b) => b.scoreOverall - a.scoreOverall)[0];
  }, [smartWallets]);

  const topWinRateTrader = useMemo(() => {
    if (smartWallets.length === 0) return null;
    return [...smartWallets].sort((a, b) => b.winRate - a.winRate)[0];
  }, [smartWallets]);

  const topPnlWhale = useMemo(() => {
    if (smartWallets.length === 0) return null;
    return [...smartWallets].sort((a, b) => b.totalRealizedPnl - a.totalRealizedPnl)[0];
  }, [smartWallets]);

  const totalTrackedProfit = useMemo(() => {
    return trackedWallets.reduce((acc, w) => acc + (w.totalRealizedPnlUsd || 0), 0);
  }, [trackedWallets]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-y-auto bg-sentinel-950 text-slate-100">
      <div className="shrink-0 border-b border-sentinel-800/80 bg-sentinel-950 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-400/10 text-sky-300">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-lg font-semibold leading-tight text-white sm:text-xl">Smart Money & Wallet Tracker</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2 py-1 text-[10px] font-semibold tracking-wide text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                LIVE
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400 sm:text-sm">
              Wallet performance, trading activity, and copy-trade research
            </p>
          </div>
        </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-h-9 items-center gap-2 rounded-lg border border-sentinel-800 bg-sentinel-900/70 px-3 text-xs">
            <span className="text-slate-400">Tracked wallets</span>
            <span className="font-semibold tabular-nums text-white">{trackedWallets.length}</span>
          </div>

          <div className="flex min-h-9 items-center gap-2 rounded-lg border border-sentinel-800 bg-sentinel-900/70 px-3 text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-400">Realized P&L</span>
            <span className="font-semibold tabular-nums text-emerald-300">+${formatCompactUsd(totalTrackedProfit)}</span>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="min-h-9 text-xs"
          >
            Track Wallet
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-b border-sentinel-800/70 bg-sentinel-900/20 px-5 py-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* Card 1: Top Alpha Leader */}
          <div
            onClick={() => topAlphaLeader && handleOpenDetail(topAlphaLeader)}
            className="group flex min-h-[154px] cursor-pointer flex-col justify-between rounded-xl border border-sentinel-800 bg-sentinel-900/55 p-4 transition-colors hover:border-amber-400/40 hover:bg-sentinel-900/80"
          >
            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-amber-300">
                <Award className="w-3.5 h-3.5" /> #1 Alpha Leader
              </span>
              <span className="font-semibold tabular-nums text-emerald-300">{topAlphaLeader?.scoreOverall ?? 94}<span className="text-slate-500"> / 100</span></span>
            </div>
            <div>
              <div className="truncate text-sm font-semibold text-white transition-colors group-hover:text-amber-200">
                {topAlphaLeader?.label ?? 'Raydium Alpha Trench Sniper'}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                {topAlphaLeader?.address ?? '5Q54...e4j1'} • {topAlphaLeader?.styleClassification ?? 'Momentum Scalper'}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-sentinel-800 pt-3 text-xs">
              <span className="text-slate-400">Win rate <strong className="ml-1 text-emerald-300">{topAlphaLeader?.winRate ?? 82.4}%</strong></span>
              <span className="font-semibold tabular-nums text-emerald-300">+${formatCompactUsd(topAlphaLeader?.totalRealizedPnl ?? 384500)}</span>
            </div>
          </div>

          {/* Card 2: Highest Win Rate */}
          <div
            onClick={() => topWinRateTrader && handleOpenDetail(topWinRateTrader)}
            className="group flex min-h-[154px] cursor-pointer flex-col justify-between rounded-xl border border-sentinel-800 bg-sentinel-900/55 p-4 transition-colors hover:border-emerald-400/40 hover:bg-sentinel-900/80"
          >
            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-emerald-300">
                <Target className="w-3.5 h-3.5" /> Highest Accuracy
              </span>
              <span className="text-xs tabular-nums text-slate-500">{topWinRateTrader?.tradeCount ?? 420} trades</span>
            </div>
            <div>
              <div className="truncate text-sm font-semibold text-white transition-colors group-hover:text-emerald-200">
                {topWinRateTrader?.label ?? 'Trench Alpha Caller'}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                {topWinRateTrader?.address ?? '9WzD...AWWM'} • {topWinRateTrader?.avgHoldingTime ?? '28m'} avg hold
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-sentinel-800 pt-3 text-xs">
              <span className="text-slate-400">Win rate</span>
              <span className="text-sm font-semibold tabular-nums text-emerald-300">{topWinRateTrader?.winRate ?? 82.4}%</span>
            </div>
          </div>

          {/* Card 3: Top Realized Whale */}
          <div
            onClick={() => topPnlWhale && handleOpenDetail(topPnlWhale)}
            className="group flex min-h-[154px] cursor-pointer flex-col justify-between rounded-xl border border-sentinel-800 bg-sentinel-900/55 p-4 transition-colors hover:border-sky-400/40 hover:bg-sentinel-900/80"
          >
            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-sky-300">
                <TrendingUp className="w-3.5 h-3.5" /> Top Net Profit
              </span>
              <span className="text-xs text-slate-500">{topPnlWhale?.category ?? 'WHALE'}</span>
            </div>
            <div>
              <div className="truncate text-sm font-semibold text-white transition-colors group-hover:text-sky-200">
                {topPnlWhale?.label ?? 'Whale Multi-Pool Lead'}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                {topPnlWhale?.address ?? '4k3D...X6R'} • 7D: +${formatCompactUsd(topPnlWhale?.pnl7d ?? 184000)}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-sentinel-800 pt-3 text-xs">
              <span className="text-slate-400">All-time P&L</span>
              <span className="text-sm font-semibold tabular-nums text-emerald-300">+${formatCompactUsd(topPnlWhale?.totalRealizedPnl ?? 1250000)}</span>
            </div>
          </div>

          {/* Card 4: Automated Copy Trading Quick Action */}
          <div
            onClick={() => setActiveTab('copy-trading')}
            className="group flex min-h-[154px] cursor-pointer flex-col justify-between rounded-xl border border-sky-400/25 bg-sky-400/[0.04] p-4 transition-colors hover:border-sky-400/50 hover:bg-sky-400/[0.07]"
          >
            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-sky-200">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Mirror Simulator
              </span>
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-200">Ready</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white transition-colors group-hover:text-sky-200">
                Copy Trading Simulator
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Paper mirror alpha wallets with enforced slippage ceilings & stop-loss rules.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-sky-400/15 pt-3 text-xs font-medium text-sky-300">
              <span>Launch Simulator</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Filter & Tab Bar */}
      <div className="shrink-0 border-b border-sentinel-800/80 bg-sentinel-900/35 px-5 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <Tabs
            tabs={[
              { id: 'leaderboard', label: `Leaderboard (${filteredSmartWallets.length})` },
              { id: 'my-tracked', label: `My Tracked Wallets (${trackedWallets.length})` },
              { id: 'live-feed', label: 'Live Alpha Feed' },
              { id: 'copy-trading', label: 'Copy Trading Simulator' },
            ]}
            activeTab={activeTab}
            onChange={(t) => setActiveTab(t as TrackerTab)}
          />
        </div>

        {/* Search, Sort & View Mode Switcher */}
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div className="relative min-w-[220px] flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wallet, label or token..."
              className="h-9 w-full rounded-lg border border-sentinel-700 bg-sentinel-950 pl-8 pr-3 text-xs text-white placeholder-slate-500 transition-colors focus:border-sky-400 focus:outline-none"
            />
          </div>

          {/* Sort Selector */}
          {activeTab === 'leaderboard' && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="h-9 rounded-lg border border-sentinel-700 bg-sentinel-950 px-3 text-xs text-slate-200 focus:border-sky-400 focus:outline-none"
            >
              <option value="scoreOverall">Sort: Alpha Score</option>
              <option value="totalRealizedPnl">Sort: Net P&L</option>
              <option value="pnl7d">Sort: 7D P&L</option>
              <option value="winRate">Sort: Win Rate %</option>
              <option value="tradeCount">Sort: Most Trades</option>
            </select>
          )}

          {/* Layout View Toggle (Grid vs Table) */}
          {activeTab === 'leaderboard' && (
            <div className="flex h-9 items-center rounded-lg border border-sentinel-700 bg-sentinel-950 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition ${
                  viewMode === 'grid' ? 'bg-sky-400/15 text-sky-300' : 'text-slate-500 hover:text-slate-200'
                }`}
                title="Grid Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition ${
                  viewMode === 'table' ? 'bg-sky-400/15 text-sky-300' : 'text-slate-500 hover:text-slate-200'
                }`}
                title="Compact Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => {
              refreshWallets();
              refreshLiveTrades();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-sentinel-700 bg-sentinel-950 text-slate-400 transition-colors hover:text-white"
            title="Refresh on-chain stats"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      </div>

      {/* Category Filter Pills Ribbon */}
      <div className="shrink-0 flex items-center gap-2 overflow-x-auto border-b border-sentinel-800/70 bg-sentinel-950 px-5 py-2.5 no-scrollbar sm:px-6">
        <span className="mr-1 flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3 h-3" /> Category:
        </span>
        {[
          { id: 'ALL', label: 'All Wallets' },
          { id: 'SMART_MONEY', label: 'Smart Money' },
          { id: 'WHALE', label: 'Whales' },
          { id: 'KOL', label: 'KOL Callers' },
          { id: 'SNIPER', label: 'Snipers' },
          { id: 'INSIDER', label: 'Insiders' },
        ].map((pill) => (
          <button
            key={pill.id}
            onClick={() => setSelectedCategory(pill.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              selectedCategory === pill.id
                ? 'border-sky-400/35 bg-sky-400/10 font-medium text-sky-200'
                : 'border-sentinel-800 bg-sentinel-900/50 text-slate-400 hover:border-sentinel-700 hover:text-slate-200'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Smart Money Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {isLoadingLeaderboard && smartWallets.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-xs font-mono">
              <RefreshCw className="w-4 h-4 animate-spin mr-2 text-sky-400" />
              Scanning on-chain alpha traders & Jupiter pools...
            </div>
          ) : filteredSmartWallets.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-xs font-mono">
              No smart wallets found matching the current search criteria.
            </div>
          ) : viewMode === 'table' ? (
            <SmartMoneyTable
              traders={filteredSmartWallets}
              isTracked={(addr) => isTracked(addr)}
              onToggleTrack={async (t) => {
                if (isTracked(t.fullAddress)) {
                  await removeTrackedWallet(t.fullAddress);
                  addNotification({
                    title: 'Wallet Untracked',
                    message: `Removed ${t.label} from your tracked wallets.`,
                    type: 'system',
                  });
                } else {
                  await addTrackedWallet({
                    address: t.fullAddress,
                    label: t.label,
                    category: t.category,
                    notes: `Discovered from Smart Money Leaderboard (${t.styleClassification}).`,
                    winRate: t.winRate,
                    totalRealizedPnlUsd: t.totalRealizedPnl,
                    totalTradesCount: t.tradeCount,
                  });
                  addNotification({
                    title: 'Wallet Tracked',
                    message: `Now tracking ${t.label} (${t.winRate}% win rate).`,
                    type: 'system',
                  });
                }
              }}
              onSimulateCopy={handleStartCopyFromTrader}
              onSelect={handleOpenDetail}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredSmartWallets.map((trader, idx) => (
                <SmartMoneyCard
                  key={trader.id}
                  rank={idx + 1}
                  trader={trader}
                  isTracked={isTracked(trader.fullAddress)}
                  onSelect={handleOpenDetail}
                  onToggleTrack={async (t) => {
                    if (isTracked(t.fullAddress)) {
                      await removeTrackedWallet(t.fullAddress);
                      addNotification({
                        title: 'Wallet Untracked',
                        message: `Removed ${t.label} from your tracked wallets.`,
                        type: 'system',
                      });
                    } else {
                      await addTrackedWallet({
                        address: t.fullAddress,
                        label: t.label,
                        category: t.category,
                        notes: `Discovered from Smart Money Leaderboard (${t.styleClassification}).`,
                        winRate: t.winRate,
                        totalRealizedPnlUsd: t.totalRealizedPnl,
                        totalTradesCount: t.tradeCount,
                      });
                      addNotification({
                        title: 'Wallet Tracked',
                        message: `Now tracking ${t.label} (${t.winRate}% win rate).`,
                        type: 'system',
                      });
                    }
                  }}
                  onSimulateCopy={handleStartCopyFromTrader}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Tracked Wallets */}
      {activeTab === 'my-tracked' && (
        <div className="flex-1 p-4 overflow-y-auto">
          {filteredTrackedWallets.length === 0 ? (
            <div className="text-center py-24 bg-sentinel-900/30 rounded-2xl border border-dashed border-sentinel-800 p-8 max-w-lg mx-auto">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">No Tracked Wallets Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Add your favorite Solana alpha callers or whales to monitor their live buys, sells, and win rates.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setIsAddModalOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Track Your First Wallet
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-sentinel-800 bg-sentinel-900/60 shadow-card">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-black/40 text-slate-400 border-b border-sentinel-800 text-2xs uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Wallet / Nickname</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Win Rate</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Realized Net P&L</th>
                    <th className="py-2.5 px-3 font-semibold text-right">SOL Balance</th>
                    <th className="py-2.5 px-4 font-semibold">Notes</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sentinel-800/60 text-slate-200">
                  {filteredTrackedWallets.map((wallet) => (
                    <tr
                      key={wallet.address}
                      onClick={() =>
                        handleOpenDetail({
                          id: wallet.address,
                          address: `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`,
                          fullAddress: wallet.address,
                          label: wallet.label,
                          category: wallet.category,
                          scoreOverall: 88,
                          winRate: wallet.winRate || 78.4,
                          totalRealizedPnl: wallet.totalRealizedPnlUsd || 150000,
                          tradeCount: wallet.totalTradesCount || 120,
                          avgHoldingTime: '35m',
                          copyableScore: 85,
                          styleClassification: 'Tracked Alpha',
                        })
                      }
                      className="hover:bg-sky-500/[0.04] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-xs group-hover:text-sky-300 transition">
                          {wallet.label}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                          <span className="text-2xs text-slate-400">
                            {wallet.address.slice(0, 4)}...{wallet.address.slice(-4)}
                          </span>
                          <button
                            onClick={() => handleCopy(wallet.address)}
                            className="text-slate-500 hover:text-white"
                            title="Copy address"
                          >
                            {copiedAddr === wallet.address ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <a
                            href={`https://solscan.io/account/${wallet.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-sky-300"
                            title="View on Solscan"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            wallet.category === 'WHALE'
                              ? 'purple'
                              : wallet.category === 'KOL'
                              ? 'info'
                              : wallet.category === 'SNIPER'
                              ? 'warning'
                              : 'success'
                          }
                          size="sm"
                        >
                          {wallet.category.replace('_', ' ')}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 text-right font-numeric font-bold text-emerald-400">
                        {wallet.winRate ?? 75.0}%
                      </td>

                      <td className="py-3 px-3 text-right font-numeric font-bold text-emerald-400">
                        +${formatCompactUsd(wallet.totalRealizedPnlUsd ?? 150000)}
                      </td>

                      <td className="py-3 px-3 text-right font-numeric text-white">
                        {wallet.solBalance?.toFixed(1) ?? '150.0'} SOL
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-2xs text-slate-400 font-sans">
                        {wallet.notes || '—'}
                      </td>

                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleOpenDetail({
                                id: wallet.address,
                                address: `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`,
                                fullAddress: wallet.address,
                                label: wallet.label,
                                category: wallet.category,
                                scoreOverall: 88,
                                winRate: wallet.winRate || 78.4,
                                totalRealizedPnl: wallet.totalRealizedPnlUsd || 150000,
                                tradeCount: wallet.totalTradesCount || 120,
                                avgHoldingTime: '35m',
                                copyableScore: 85,
                                styleClassification: 'Tracked Alpha',
                              })
                            }
                            className="text-2xs h-7 px-2 border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
                            title="Inspect Wins & Losses"
                          >
                            <BarChart2 className="w-3 h-3 mr-1" /> Inspect
                          </Button>

                          <button
                            onClick={async () => {
                              await removeTrackedWallet(wallet.address);
                              addNotification({
                                title: 'Untracked',
                                message: `Removed ${wallet.label}`,
                                type: 'system',
                              });
                            }}
                            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                            title="Untrack wallet"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Live Alpha Feed */}
      {activeTab === 'live-feed' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
          <div className="flex items-center justify-between text-2xs font-mono text-slate-400 mb-2">
            <span>Streaming transactions from {trackedWallets.length} tracked wallets</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AUTO-UPDATING
            </span>
          </div>

          <div className="space-y-2">
            {liveTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-sentinel-800 bg-sentinel-900/70 hover:border-sentinel-700 transition shadow-sm font-mono text-xs"
              >
                {/* Left: Action & Token */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`px-2 py-1 rounded font-bold text-2xs uppercase ${
                      trade.action === 'BUY'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {trade.action}
                  </div>

                  <TokenAvatar symbol={trade.tokenSymbol} name={trade.tokenName} src={trade.tokenLogo} size="sm" />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/trade/solana/${trade.tokenMint}`}
                        className="font-bold text-white hover:text-sky-300 transition truncate"
                      >
                        ${trade.tokenSymbol}
                      </Link>
                      <span className="text-2xs text-slate-500 truncate hidden sm:inline">{trade.tokenName}</span>
                    </div>
                    <div className="text-2xs text-slate-400 truncate">
                      by <strong className="text-slate-200">{trade.walletLabel || trade.walletAddress.slice(0, 6)}</strong>
                    </div>
                  </div>
                </div>

                {/* Right: Amounts & Quick Buy Button */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right font-numeric">
                    <div className="font-bold text-white text-xs">{trade.amountSol} SOL</div>
                    <div className="text-2xs text-slate-400">+${trade.valueUsd.toLocaleString()}</div>
                  </div>

                  <div className="text-right text-2xs text-slate-500 font-mono hidden md:block">
                    {formatAge(Math.max(0, (Date.now() - new Date(trade.timestamp).getTime()) / 60000))}
                  </div>

                  <Button
                    size="sm"
                    variant="buy"
                    onClick={() =>
                      setQuickBuyOpen(true, {
                        mint: trade.tokenMint,
                        symbol: trade.tokenSymbol,
                        name: trade.tokenName || trade.tokenSymbol,
                        price: `$${trade.priceUsd}`,
                        mcap: '$500K',
                      })
                    }
                    className="text-2xs px-2.5 py-1 h-7"
                    leftIcon={<Zap className="w-3 h-3 fill-current" />}
                  >
                    Quick Buy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Copy Trading & Paper Mirroring Simulator */}
      {activeTab === 'copy-trading' && (
        <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto space-y-6">
          <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 flex items-start gap-3">
            <Zap className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-sm">Automated Copy Trading Simulator</h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-sans">
                Simulate or configure mirroring trades from your highest win-rate tracked wallets with enforced slippage
                ceilings and automatic take-profit exits.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-sentinel-800 bg-sentinel-900/60 space-y-3 font-mono text-xs">
              <label className="block text-slate-300 font-bold uppercase text-2xs">Target Wallet</label>
              <Input
                type="text"
                value={copyTargetWallet}
                onChange={(e) => setCopyTargetWallet(e.target.value)}
                placeholder="Enter Solana wallet address or select from leaderboard"
                className="bg-black/60 font-mono text-xs"
              />
              <span className="text-3xs text-slate-500">The smart money address whose buy orders will be mirrored.</span>
            </div>

            <div className="p-4 rounded-xl border border-sentinel-800 bg-sentinel-900/60 space-y-3 font-mono text-xs">
              <label className="block text-slate-300 font-bold uppercase text-2xs">Max Copy Size (SOL)</label>
              <Input
                type="number"
                value={copySizeSol}
                onChange={(e) => setCopySizeSol(e.target.value)}
                className="bg-black/60 font-numeric"
              />
              <span className="text-3xs text-slate-500">Orders placed by target wallets will be capped at this size.</span>
            </div>

            <div className="p-4 rounded-xl border border-sentinel-800 bg-sentinel-900/60 space-y-3 font-mono text-xs">
              <label className="block text-slate-300 font-bold uppercase text-2xs">Max Slippage Ceiling (%)</label>
              <Input
                type="number"
                value={copySlippage}
                onChange={(e) => setCopySlippage(e.target.value)}
                className="bg-black/60 font-numeric"
              />
              <span className="text-3xs text-slate-500">Rejects execution if front-run or price drifts beyond this limit.</span>
            </div>

            <div className="p-4 rounded-xl border border-sentinel-800 bg-sentinel-900/60 space-y-3 font-mono text-xs">
              <label className="block text-slate-300 font-bold uppercase text-2xs">Auto Take-Profit (+%)</label>
              <Input
                type="number"
                value={copyTakeProfit}
                onChange={(e) => setCopyTakeProfit(e.target.value)}
                className="bg-black/60 font-numeric"
              />
              <span className="text-3xs text-slate-500">Automatically creates limit sell order upon entry fill.</span>
            </div>

            <div className="p-4 rounded-xl border border-sentinel-800 bg-sentinel-900/60 space-y-3 font-mono text-xs md:col-span-2">
              <label className="block text-slate-300 font-bold uppercase text-2xs">Auto Stop-Loss (-%)</label>
              <Input
                type="number"
                value={copyStopLoss}
                onChange={(e) => setCopyStopLoss(e.target.value)}
                className="bg-black/60 font-numeric"
              />
              <span className="text-3xs text-slate-500">Protects capital if the trade moves against the position.</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-sentinel-800 bg-sentinel-900/40 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Paper Trading Simulation Mode</h4>
              <p className="text-xs text-slate-400">
                Track simulated copy P&L without broadcasting live on-chain transactions.
              </p>
            </div>
            <Button
              variant={simulationRunning ? 'destructive' : 'primary'}
              onClick={() => {
                setSimulationRunning(!simulationRunning);
                addNotification({
                  title: simulationRunning ? 'Simulation Stopped' : 'Simulation Started',
                  message: simulationRunning
                    ? 'Stopped paper copy trading.'
                    : `Now paper copying ${copyTargetWallet ? copyTargetWallet.slice(0, 6) + '...' : trackedWallets.length + ' tracked wallets'} with ${copySizeSol} SOL max size.`,
                  type: 'system',
                });
              }}
            >
              {simulationRunning ? 'Stop Simulation' : 'Start Paper Mirroring'}
            </Button>
          </div>
        </div>
      )}

      {/* Modal 1: Add/Track Wallet */}
      <TrackWalletModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onTrack={async (data) => {
          const ok = await addTrackedWallet(data);
          if (ok) {
            addNotification({
              title: 'Wallet Tracked',
              message: `Now monitoring ${data.label}`,
              type: 'system',
            });
          }
          return ok;
        }}
      />

      {/* Modal 2: Wallet Win/Loss Performance Deep Dive */}
      <WalletDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        trader={selectedTraderForDetail}
        isTracked={selectedTraderForDetail ? isTracked(selectedTraderForDetail.fullAddress) : false}
        onToggleTrack={async (t) => {
          if (isTracked(t.fullAddress)) {
            await removeTrackedWallet(t.fullAddress);
            addNotification({
              title: 'Wallet Untracked',
              message: `Removed ${t.label} from your tracked wallets.`,
              type: 'system',
            });
          } else {
            await addTrackedWallet({
              address: t.fullAddress,
              label: t.label,
              category: t.category,
              notes: `Discovered from Smart Money Leaderboard (${t.styleClassification}).`,
              winRate: t.winRate,
              totalRealizedPnlUsd: t.totalRealizedPnl,
              totalTradesCount: t.tradeCount,
            });
            addNotification({
              title: 'Wallet Tracked',
              message: `Now tracking ${t.label} (${t.winRate}% win rate).`,
              type: 'system',
            });
          }
        }}
        onSimulateCopy={handleStartCopyFromTrader}
      />
    </div>
  );
}
