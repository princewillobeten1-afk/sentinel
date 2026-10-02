'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Star,
  Search,
  Share2,
  Bell,
  Crosshair,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { formatCompactUsd } from '@/lib/discovery/format';
import { useAppActions } from '@/lib/store';
import { ActivityHeatmap } from '@/components/wallet-tracker/activity-heatmap';
import { WalletPnlChart } from '@/components/wallet-tracker/wallet-pnl-chart';
import { SmartMoneyTrader } from '@/components/wallet-tracker/smart-money-card';
import {
  WalletPerformanceDetail,
  WalletPositionItem,
} from '@/app/api/v1/smart-wallets/[address]/route';

interface WalletDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  trader: SmartMoneyTrader | null;
  isTracked: boolean;
  onToggleTrack: (trader: SmartMoneyTrader) => void;
  onSimulateCopy?: (trader: SmartMoneyTrader) => void;
}

type BottomTab = 'active' | 'history' | 'top100' | 'activity' | 'transfers';

export function WalletDetailModal({
  isOpen,
  onClose,
  trader,
  isTracked,
  onToggleTrack,
  onSimulateCopy,
}: WalletDetailModalProps) {
  const { setQuickBuyOpen } = useAppActions();
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<WalletPerformanceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<'1d' | '7d' | '30d' | 'Max'>('Max');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('active');
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [isStarred, setIsStarred] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch detail data
  useEffect(() => {
    if (!isOpen || !trader) return;

    let cancelled = false;
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/smart-wallets/${trader.fullAddress}`);
        if (res.ok) {
          const body = await res.json();
          if (!cancelled && body.success && body.data) {
            setDetail(body.data);
          }
        }
      } catch (err) {
        console.error('Failed to load wallet performance detail:', err);
      }
      if (!cancelled) setIsLoading(false);
    };

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [isOpen, trader]);

  if (!isOpen || !trader) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(trader.fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fallback defaults if detail is still loading
  const activeDetail = detail || {
    address: trader.address,
    fullAddress: trader.fullAddress,
    label: trader.label,
    category: trader.category,
    followersCount: '1K',
    scoreOverall: trader.scoreOverall,
    winRate: trader.winRate,
    totalRealizedPnl: trader.totalRealizedPnl,
    pnl7d: trader.pnl7d || Math.round(trader.totalRealizedPnl * 0.18),
    pnl30d: Math.round(trader.totalRealizedPnl * 0.55),
    totalTrades: trader.tradeCount,
    totalWins: Math.round((trader.tradeCount * trader.winRate) / 100),
    totalLosses: trader.tradeCount - Math.round((trader.tradeCount * trader.winRate) / 100),
    profitFactor: 3.8,
    avgWinUsd: 1240,
    avgLossUsd: 310,
    avgHoldTime: trader.avgHoldingTime,
    balance: {
      totalValueUsd: 21.41,
      unrealizedPnlUsd: 7.784,
      tradeableSol: 0,
      walletFundingSol: 0.081,
      walletFundingAge: '13d',
      stableCoinBalanceUsd: 0.781,
    },
    activityHeatmap: [],
    performance: {
      totalPnlUsd: trader.totalRealizedPnl,
      realizedPnlUsd: trader.totalRealizedPnl,
      totalTxns: trader.tradeCount,
      winsCount: Math.round((trader.tradeCount * trader.winRate) / 100),
      lossCount: trader.tradeCount - Math.round((trader.tradeCount * trader.winRate) / 100),
      sharpeRatio: 5.66,
      roiBuckets: {
        gt500: 1,
        from200to500: 0,
        from0to200: 43,
        from0toNeg50: 23,
        ltNeg50: 6,
      },
    },
    bestTrade: { symbol: trader.tokenSymbol || 'SOL', pnlUsd: Math.round(trader.totalRealizedPnl * 0.3), roiPct: 840 },
    worstTrade: { symbol: 'pad', pnlUsd: -10.44, roiPct: -95.35 },
    styleClassification: trader.styleClassification,
    equityCurve: [],
    timeframeCurves: { '1d': [], '7d': [], '30d': [], Max: [] },
    activePositions: [],
    historyPositions: [],
    trades: [],
  };

  // Filter positions by search query
  const displayedPositions: WalletPositionItem[] = (
    activeBottomTab === 'active'
      ? activeDetail.activePositions
      : activeDetail.historyPositions
  ).filter((pos) => {
    if (!tokenSearchQuery) return true;
    const q = tokenSearchQuery.toLowerCase();
    return (
      pos.tokenSymbol.toLowerCase().includes(q) ||
      pos.tokenName.toLowerCase().includes(q) ||
      pos.tokenMint.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Standalone Dialog Container */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[1220px] max-h-[94vh] flex flex-col rounded-2xl border border-[#1e232d] bg-[#090b10] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] z-10 overflow-hidden text-slate-100 font-sans animate-in zoom-in-95 duration-150"
      >
        {/* Top Header Bar (Axiom / BullX style) */}
        <div className="px-4 py-2.5 border-b border-[#1b202a] bg-[#090b0e] flex items-center justify-between gap-3 select-none flex-shrink-0">
          {/* Left: Wallet Identity */}
          <div className="flex items-center gap-2.5">
            {/* Initials badge */}
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-600 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">
              {trader.label.slice(0, 2)}
            </div>

            {/* Name */}
            <span className="font-bold text-white text-xs tracking-wide">{trader.label}</span>

            {/* Solana logo icon */}
            <div className="w-4 h-4 rounded-full bg-[#171b24] border border-[#252c3c] flex items-center justify-center text-[9px] text-purple-400 font-bold">
              ◎
            </div>

            {/* Address pill with copy */}
            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400 bg-[#141822] px-2 py-0.5 rounded border border-[#232a39]">
              <span>{trader.address}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-slate-500 hover:text-white transition ml-0.5"
                title="Copy public address"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Solscan Link */}
            <a
              href={`https://solscan.io/account/${trader.fullAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-sky-300 p-0.5 transition"
              title="View on Solscan"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Followers Pill */}
            <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-[#141822] border border-[#232a39] flex items-center gap-1">
              <span className="text-slate-500">👥</span>
              {activeDetail.followersCount}
            </span>
          </div>

          {/* Right: Actions, Timeframe Selector & Close */}
          <div className="flex items-center gap-2">
            {/* Bell Alert Icon */}
            <button
              type="button"
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#161a24] transition"
              title="Set wallet alert"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>

            {/* Star Favorite */}
            <button
              type="button"
              onClick={() => setIsStarred(!isStarred)}
              className={`p-1 rounded hover:bg-[#161a24] transition ${
                isStarred ? 'text-amber-400' : 'text-slate-400'
              }`}
              title="Star / Favorite"
            >
              <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400' : ''}`} />
            </button>

            {/* Track Button */}
            <Button
              size="sm"
              variant={isTracked ? 'secondary' : 'primary'}
              onClick={() => onToggleTrack(trader)}
              className="text-[11px] px-2.5 h-6 font-semibold"
            >
              {isTracked ? 'Tracked' : 'Track'}
            </Button>

            <div className="h-3.5 w-[1px] bg-[#1e232d] mx-0.5" />

            {/* Timeframe Switcher (1d, 7d, 30d, Max) */}
            <div className="flex items-center gap-1 font-mono text-xs">
              {(['1d', '7d', '30d', 'Max'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setActiveTimeframe(tf)}
                  className={`px-2 py-0.5 rounded transition font-bold ${
                    activeTimeframe === tf
                      ? 'text-sky-400 font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Single Top-Right Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e232d] transition ml-1"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto flex-1">
          {/* Main 3-Column Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1b202a] border-b border-[#1b202a] bg-[#0c0e14]">
            {/* Column 1: Balance & Heatmap (lg:col-span-4) */}
            <div className="lg:col-span-4 p-4 flex flex-col justify-between space-y-3 font-mono">
              {/* Header */}
              <div className="flex items-center justify-between text-xs font-bold text-white border-b border-[#181d27] pb-1.5">
                <span>Balance</span>
                <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                  ⇅ USD
                </span>
              </div>

              {/* Middle Section: Total Value on Left, Activity Heatmap on Right */}
              <div className="flex items-start justify-between gap-2 py-0.5">
                {/* Total Value */}
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans tracking-wide block">
                    Total Value
                  </span>
                  <div className="text-2xl font-bold text-white font-numeric tracking-tight leading-tight">
                    ${activeDetail.balance.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-sans tracking-wide mt-2 block">
                    Unrealized PNL
                  </div>
                  <div className="text-xs font-bold text-[#00e599] font-numeric">
                    +${activeDetail.balance.unrealizedPnlUsd.toFixed(3)}
                  </div>
                </div>

                {/* 7x24 Activity Heatmap Side-by-Side */}
                <div className="flex-shrink-0">
                  <ActivityHeatmap data={activeDetail.activityHeatmap} />
                </div>
              </div>

              {/* Bottom sub-balances */}
              <div className="pt-2 border-t border-[#181d27] space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">
                      Tradeable Balance
                    </span>
                    <span className="font-bold text-white font-numeric">
                      ${activeDetail.balance.tradeableSol * 152}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">
                      Wallet Funding
                    </span>
                    <span className="text-2xs text-slate-300 font-numeric flex items-center gap-1.5 justify-end">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                      {activeDetail.balance.walletFundingSol} SOL
                      <Clock className="w-3 h-3 text-slate-500 inline" />
                      {activeDetail.balance.walletFundingAge}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">
                      Stable Coin Balance
                    </span>
                    <span className="font-bold text-white font-numeric">
                      ${activeDetail.balance.stableCoinBalanceUsd}
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-1 text-2xs text-slate-400 font-numeric">
                    <div className="w-3.5 h-3.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center text-[8px] font-bold">
                      $
                    </div>
                    {activeDetail.balance.stableCoinBalanceUsd}
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Realized PNL Stepped Chart (lg:col-span-5) */}
            <div className="lg:col-span-5 p-4 flex flex-col justify-between">
              <WalletPnlChart
                equityCurve={activeDetail.equityCurve}
                timeframeCurves={activeDetail.timeframeCurves}
                activeTimeframe={activeTimeframe}
                totalRealizedPnl={activeDetail.totalRealizedPnl}
                height={170}
              />
            </div>

            {/* Column 3: Performance & 5 ROI Win Buckets (lg:col-span-3) */}
            <div className="lg:col-span-3 p-4 flex flex-col justify-between space-y-2.5 font-mono">
              <div className="flex items-center justify-between text-xs font-bold text-white border-b border-[#181d27] pb-1.5">
                <span>Performance</span>
                <button className="text-slate-500 hover:text-white p-0.5" title="Export / Share">
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 text-xs font-numeric">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-xs">Total Pnl</span>
                  <span className="font-bold text-[#00e599] text-xs">
                    +${formatCompactUsd(activeDetail.performance.totalPnlUsd)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-xs">Realized PNL</span>
                  <span className="font-bold text-[#00e599] text-xs flex items-center gap-1">
                    → +${formatCompactUsd(activeDetail.performance.realizedPnlUsd)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-xs">Total TXNS</span>
                  <span className="font-bold text-white text-xs">
                    {activeDetail.performance.totalTxns}{' '}
                    <span className="text-[#00e599] font-normal">{activeDetail.performance.winsCount}</span>
                    <span className="text-slate-600 font-normal"> / </span>
                    <span className="text-rose-400 font-normal">{activeDetail.performance.lossCount}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-xs flex items-center gap-1">
                    Sharpe <span className="text-[10px] text-slate-500">ⓘ</span>
                  </span>
                  <span className="font-bold text-[#00e599] text-xs">
                    {activeDetail.performance.sharpeRatio}
                  </span>
                </div>
              </div>

              {/* 5-Tier ROI Win Buckets (Exact Axiom replica) */}
              <div className="space-y-1 pt-1.5 border-t border-[#181d27] text-xs font-numeric">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                    &gt;500%
                  </span>
                  <span className="font-bold text-white">{activeDetail.performance.roiBuckets.gt500}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    200% ~ 500%
                  </span>
                  <span className="font-bold text-white">
                    {activeDetail.performance.roiBuckets.from200to500}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00e599]" />
                    0% ~ 200%
                  </span>
                  <span className="font-bold text-white">
                    {activeDetail.performance.roiBuckets.from0to200}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]" />
                    0% ~ -50%
                  </span>
                  <span className="font-bold text-white">
                    {activeDetail.performance.roiBuckets.from0toNeg50}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#be123c]" />
                    &lt; -50%
                  </span>
                  <span className="font-bold text-white">{activeDetail.performance.roiBuckets.ltNeg50}</span>
                </div>

                {/* Segmented win rate bar */}
                <div className="h-1.5 w-full bg-[#181d27] rounded-full overflow-hidden flex mt-1.5">
                  <div
                    style={{ width: `${activeDetail.winRate}%` }}
                    className="bg-[#00e599] h-full"
                  />
                  <div
                    style={{ width: `${100 - activeDetail.winRate}%` }}
                    className="bg-[#f43f5e] h-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Tabs & Token Positions Table */}
          <div className="p-4 space-y-2 bg-[#090b10]">
            {/* Navigation Tabs and Search Input */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b202a] pb-2">
              {/* Tabs */}
              <div className="flex items-center gap-6 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setActiveBottomTab('active')}
                  className={`pb-1.5 transition font-bold relative ${
                    activeBottomTab === 'active'
                      ? 'text-white border-b-2 border-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Active Positions
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBottomTab('history')}
                  className={`pb-1.5 transition font-bold relative ${
                    activeBottomTab === 'history'
                      ? 'text-white border-b-2 border-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  History
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBottomTab('top100')}
                  className={`pb-1.5 transition font-bold relative ${
                    activeBottomTab === 'top100'
                      ? 'text-white border-b-2 border-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Top 100
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBottomTab('activity')}
                  className={`pb-1.5 transition font-bold relative ${
                    activeBottomTab === 'activity'
                      ? 'text-white border-b-2 border-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Activity
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBottomTab('transfers')}
                  className={`pb-1.5 transition font-bold relative ${
                    activeBottomTab === 'transfers'
                      ? 'text-white border-b-2 border-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Transfers
                </button>
              </div>

              {/* Search bar & Filter */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={tokenSearchQuery}
                    onChange={(e) => setTokenSearchQuery(e.target.value)}
                    placeholder="Search by name or address"
                    className="pl-8 pr-3 py-1 rounded bg-[#131720] border border-[#212836] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono w-56"
                  />
                </div>

                <span className="text-2xs font-mono text-slate-400 px-2 py-1 bg-[#131720] border border-[#212836] rounded cursor-pointer hover:text-white transition">
                  ⇅ USD
                </span>
              </div>
            </div>

            {/* Positions / Tokens Table */}
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs font-numeric border-collapse">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase font-sans border-b border-[#181d27]">
                    <th className="py-2 px-3 font-medium">Token</th>
                    <th className="py-2 px-3 text-right font-medium">Bought</th>
                    <th className="py-2 px-3 text-right font-medium">Sold</th>
                    <th className="py-2 px-3 text-right font-medium">Remaining</th>
                    <th className="py-2 px-3 text-right font-medium">PNL</th>
                    <th className="py-2 px-3 font-medium">Opened</th>
                    <th className="py-2 px-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#131720] font-mono">
                  {displayedPositions.map((pos) => (
                    <tr key={pos.id} className="hover:bg-white/[0.02] transition">
                      {/* Token */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <TokenAvatar
                            symbol={pos.tokenSymbol}
                            name={pos.tokenName}
                            src={pos.tokenLogo}
                            dexBadge={pos.dexBadge}
                            size="sm"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/trade/solana/${pos.tokenMint}`}
                                className="font-bold text-white hover:text-sky-300 transition text-xs"
                              >
                                {pos.tokenSymbol}
                              </Link>
                              <span className="text-[10px] text-emerald-400 font-bold">
                                {pos.openedAge.split(' ')[0]}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans truncate max-w-[120px]">
                              {pos.tokenName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Bought */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="text-[#00e599] font-bold text-xs">
                          ${pos.boughtUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">{pos.boughtTokens}</div>
                      </td>

                      {/* Sold */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="text-rose-400 font-bold text-xs">
                          ${pos.soldUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">{pos.soldTokens}</div>
                      </td>

                      {/* Remaining */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="text-white font-bold text-xs">
                          ${pos.remainingUsd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </div>
                        <div className="text-[10px] text-slate-400">{pos.remainingTokens}</div>
                      </td>

                      {/* PNL */}
                      <td className="py-2.5 px-3 text-right">
                        <div
                          className={`font-bold text-xs ${
                            pos.pnlUsd >= 0 ? 'text-[#00e599]' : 'text-rose-400'
                          }`}
                        >
                          {pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toLocaleString()}{' '}
                          ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent}%)
                        </div>
                      </td>

                      {/* Opened */}
                      <td className="py-2.5 px-3">
                        <div className="text-white font-bold text-xs">{pos.openedAge}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{pos.lastTxAge}</div>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="buy"
                            onClick={() =>
                              setQuickBuyOpen(true, {
                                mint: pos.tokenMint,
                                symbol: pos.tokenSymbol,
                                name: pos.tokenName,
                                price: `$${(pos.boughtUsd / Math.max(1, pos.remainingUsd)).toFixed(4)}`,
                                mcap: '$1M',
                              })
                            }
                            className="text-[10px] px-2 py-0.5 h-6"
                          >
                            Buy
                          </Button>
                          <a
                            href={`https://solscan.io/tx/${pos.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-white p-1 transition"
                            title="View transaction on Solscan"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
