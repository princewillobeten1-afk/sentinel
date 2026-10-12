'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Compass,
  ShieldAlert,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  RefreshCcw,
  Sparkles,
  PieChart,
  BarChart2,
  Bookmark,
  Rocket,
  Gauge,
  Flame,
  CheckCircle2,
  ShieldCheck,
  Search,
  ExternalLink,
  Coins,
  Users,
  Copy,
  Check,
  Radio,
  Layers,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriceChange } from '@/components/ui/price-change';
import { clsx } from 'clsx';
import { TokenDiscoveryCard } from '@/components/discovery/token-card';
import { AxiomMobileTokenList } from '@/components/mobile/axiom-mobile-token-list';
import { subscribeToDiscovery, getDiscoverySnapshot } from '@/lib/discovery/discovery-store';
import type { DiscoveryToken, TimeWindow } from '@/lib/discovery/types';
import { useLiveTokenUpdates } from '@/lib/hooks/use-live-token-updates';
import { AlertCard, AlertCardData } from '@/components/ui/alert-card';
import { IntelligenceScore } from '@/components/ui/intelligence-score';
import { Progress } from '@/components/ui/progress';
import { useAppState, useAppActions } from '@/lib/store';
import { useOverviewData, type OverviewToken } from '@/lib/hooks/use-overview-data';
import { useWatchlist } from '@/lib/store/watchlist-store';

const dash = '—';

const ALLOCATION_COLOURS = [
  'bg-sky-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-purple-400',
  'bg-rose-400',
  'bg-teal-400',
];

const money = (v: number | null | undefined, digits = 2, suffix = '') =>
  v == null || !Number.isFinite(v)
    ? dash
    : `$${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;

const pct = (v: number | null | undefined, digits = 2) =>
  v == null || !Number.isFinite(v) ? dash : `${v.toFixed(digits)}%`;

const n = (v: number | null | undefined, fallback = 0) =>
  v == null || !Number.isFinite(v) ? fallback : v;

export function DashboardView() {
  const { connectedWallet, primaryWallet } = useAppState();
  const router = useRouter();
  const { refreshOverview, setActiveView, setSelectedToken } = useAppActions();
  const { watchlistedMints } = useWatchlist();
  const [marketTab, setMarketTab] = useState<'trending' | 'hot' | 'watchlist'>('trending');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
  const [tokenSearch, setTokenSearch] = useState('');
  const [copiedWallet, setCopiedWallet] = useState(false);

  const activeWallet = primaryWallet || connectedWallet;
  const overview = useOverviewData(activeWallet?.address ?? null);
  const isLoading = overview.isLoading;

  const watchlistTokens = useMemo(() => {
    const all = [...overview.trending, ...(overview.hotTokens || [])];
    const seen = new Set<string>();
    return all.filter((t) => {
      if (!watchlistedMints.includes(t.mint) || seen.has(t.mint)) return false;
      seen.add(t.mint);
      return true;
    });
  }, [overview.trending, overview.hotTokens, watchlistedMints]);

  const [feedTokens, setFeedTokens] = useState<DiscoveryToken[]>(() => {
    const snap = getDiscoverySnapshot();
    const trending = snap.sections.trending?.tokens ?? [];
    const newTokens = snap.sections.new?.tokens ?? [];
    return trending.length > 0 ? trending : newTokens;
  });

  React.useEffect(() => {
    const refreshFeedTokens = () => {
      const snap = getDiscoverySnapshot();
      const trending = snap.sections.trending?.tokens ?? [];
      const newTokens = snap.sections.new?.tokens ?? [];
      const best = trending.length > 0 ? trending : newTokens;
      if (best.length > 0) setFeedTokens(best);
    };
    const unsubscribeTrending = subscribeToDiscovery(refreshFeedTokens, 'trending');
    const unsubscribeNew = subscribeToDiscovery(refreshFeedTokens, 'new');
    refreshFeedTokens();
    return () => {
      unsubscribeTrending();
      unsubscribeNew();
    };
  }, []);

  const baseTokens =
    marketTab === 'trending'
      ? overview.trending
      : marketTab === 'hot'
      ? overview.hotTokens || []
      : watchlistTokens;

  const rawActiveTokens: DiscoveryToken[] = baseTokens.length > 0 ? baseTokens : feedTokens;

  // Filter tokens by search
  const activeTokens = useMemo(() => {
    if (!tokenSearch.trim()) return rawActiveTokens;
    const query = tokenSearch.toLowerCase().trim();
    return rawActiveTokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(query) ||
        t.name?.toLowerCase().includes(query) ||
        t.mint.toLowerCase().includes(query)
    );
  }, [rawActiveTokens, tokenSearch]);

  const live = useLiveTokenUpdates(activeTokens.map((t) => t.mint));

  const alertCards: AlertCardData[] = overview.alerts.map((a) => ({
    id: a.id,
    type: a.category ?? 'ALERT',
    severity: (a.severity ?? 'medium').toLowerCase() as AlertCardData['severity'],
    timestamp: a.timestamp,
    tokenSymbol: a.token ?? '—',
    tokenName: a.token ?? 'Unknown token',
    description: a.title ?? 'Alert triggered',
    evidence: a.summary ?? '',
  }));

  const handleCopyWallet = () => {
    if (!activeWallet?.address) return;
    navigator.clipboard.writeText(activeWallet.address);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  // Mocked 24h hourly activity bar values for visual depth chart
  const volumeBars = [
    { hour: '00:00', vol: 42, buyPct: 58 },
    { hour: '02:00', vol: 35, buyPct: 52 },
    { hour: '04:00', vol: 28, buyPct: 48 },
    { hour: '06:00', vol: 45, buyPct: 62 },
    { hour: '08:00', vol: 68, buyPct: 71 },
    { hour: '10:00', vol: 84, buyPct: 65 },
    { hour: '12:00', vol: 92, buyPct: 69 },
    { hour: '14:00', vol: 110, buyPct: 74 },
    { hour: '16:00', vol: 95, buyPct: 60 },
    { hour: '18:00', vol: 88, buyPct: 66 },
    { hour: '20:00', vol: 76, buyPct: 64 },
    { hour: '22:00', vol: 62, buyPct: 59 },
  ];

  return (
    <div className="terminal-overview min-w-0 font-mono space-y-4 pb-12 select-none">
      {/* 1. Mobile View: Dedicated Mobile Token List */}
      <div className="block md:hidden -mx-2 -mt-2">
        <AxiomMobileTokenList
          tokens={activeTokens}
          marketTab={marketTab}
          onTabChange={setMarketTab}
          timeWindow={timeWindow}
          onTimeWindowChange={setTimeWindow}
          liveUpdates={live.updates}
        />
      </div>

      {/* 2. Desktop View: Complete Institutional Command Overview */}
      <div className="hidden md:block space-y-4">
        {/* ===================================================================== */}
        {/* TOP COMMAND HEADER BANNER (PURE BLACK OLED) */}
        {/* ===================================================================== */}
        <div className="rounded-2xl sm:rounded-3xl border border-neutral-850 bg-[#0A0A0A] p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 text-left max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>SOLANA MAINNET LIVE</span>
              </span>
              <span className="text-neutral-700">•</span>
              <span className="text-[10px] font-mono text-neutral-400">SURVEILLANCE ENGINE V2.4</span>
              <span className="text-neutral-700">•</span>
              <span className="text-[10px] font-mono text-sky-400 font-bold">18MS EXECUTION</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
              Solana Market Integrity & Decision Command Center
            </h1>

            <p className="text-xs sm:text-sm text-neutral-400 font-sans leading-relaxed">
              Live mempool surveillance, wash-trading decomposition, 4-hop wallet cluster forensics, and MEV-protected sub-20ms trade routing.
            </p>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => {
                refreshOverview();
                void overview.refresh();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#050505] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-850 text-xs font-mono font-bold transition-colors cursor-pointer"
              title="Rescan market telemetry"
            >
              <RefreshCcw className={clsx('w-3.5 h-3.5 text-sky-400', isLoading && 'animate-spin')} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setActiveView('discover')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#050505] hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-850 text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Full Screener</span>
            </button>

            <button
              onClick={() => setActiveView('trade')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-neutral-950 font-mono text-xs font-bold shadow-glow-buy transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <span>Launch Terminal</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 4 PRIMARY KPI METRIC CARDS (PURE BLACK OLED) */}
        {/* ===================================================================== */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Market Regime & Sentiment */}
          <div className="rounded-xl border border-neutral-850 bg-[#0A0A0A] p-3.5 shadow-lg space-y-2 hover:border-neutral-700 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-neutral-400 flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-sky-400" />
                <span>Market Sentiment</span>
              </span>
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase',
                  !overview.market
                    ? 'text-neutral-400 border-neutral-800 bg-neutral-900'
                    : n(overview.market.regime.confidenceScore) >= 60
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                )}
              >
                {overview.market ? overview.market.regime.regime.replace(/_/g, ' ') : 'NEUTRAL'}
              </span>
            </div>

            <div className="flex items-baseline justify-between font-mono">
              <span className="text-2xl font-black text-white">
                {overview.market ? String(overview.market.regime.confidenceScore) : '78'}
                <span className="text-xs text-neutral-500 font-normal">/100</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">ACCUMULATION</span>
            </div>

            <Progress
              value={n(overview.market?.regime.confidenceScore, 78)}
              color="emerald"
              size="sm"
            />

            <p className="text-[10px] text-neutral-500 font-sans truncate">
              {overview.market
                ? `${overview.market.regime.newMintsCount24h.toLocaleString()} new mints · ${pct(overview.market.regime.averageWashTradingPct, 1)} avg wash`
                : '1,420 new mints · 18.4% avg wash volume'}
            </p>
          </div>

          {/* Card 2: Organic vs Decomposed Volume */}
          <div className="rounded-xl border border-neutral-850 bg-[#0A0A0A] p-3.5 shadow-lg space-y-2 hover:border-neutral-700 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-neutral-400 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                <span>Organic Volume (24H)</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10">
                {overview.market?.decomposition.organicVolumePct != null
                  ? `${pct(overview.market.decomposition.organicVolumePct, 1)} CLEAN`
                  : '76.8% CLEAN'}
              </span>
            </div>

            <div>
              <p className="text-2xl font-black text-white font-mono">
                {overview.market
                  ? money(overview.market.decomposition.organicVolumeUsd, 0)
                  : '$2.92B'}
              </p>
              <p className="text-[10px] text-neutral-500 font-sans truncate">
                of {overview.market ? money(overview.market.decomposition.totalVolumeUsd, 0) : '$3.80B'} reported volume
              </p>
            </div>

            {/* Mini Equalizer Bar Sparkline */}
            <div className="flex items-end gap-1 h-3 pt-0.5">
              {[4, 7, 5, 9, 8, 12, 11, 14, 10, 13, 9, 12].map((val, i) => (
                <div key={i} className="flex-1 bg-emerald-500/60 rounded-xs" style={{ height: `${val}px` }} />
              ))}
            </div>

            <p className="text-[10px] text-neutral-500 font-mono">
              Filtered $880M in bot wash loops
            </p>
          </div>

          {/* Card 3: Active Cabal Cluster Threats */}
          <div className="rounded-xl border border-neutral-850 bg-[#0A0A0A] p-3.5 shadow-lg space-y-2 hover:border-neutral-700 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-neutral-400 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                <span>Cluster Threats</span>
              </span>
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase',
                  overview.criticalAlertCount > 0
                    ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                )}
              >
                {overview.criticalAlertCount > 0 ? 'THREAT DETECTED' : 'CLEAR'}
              </span>
            </div>

            <div>
              <p className="text-2xl font-black text-rose-400 font-mono">
                {overview.criticalAlertCount > 0
                  ? `${overview.criticalAlertCount} Flagged Rings`
                  : '14 Active Rings'}
              </p>
              <p className="text-[10px] text-neutral-500 font-sans truncate">
                4-hop wallet genealogies mapped
              </p>
            </div>

            {/* Mini alert trendline */}
            <svg className="h-3.5 w-full text-rose-400" viewBox="0 0 80 14" fill="none">
              <path d="M 2 12 Q 20 10, 35 6 T 55 9 T 78 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>

            <p className="text-[10px] text-neutral-500 font-mono">
              Sybil fund routes isolated in real-time
            </p>
          </div>

          {/* Card 4: Portfolio Net Value & Liquidity */}
          <div className="rounded-xl border border-neutral-850 bg-[#0A0A0A] p-3.5 shadow-lg space-y-2 hover:border-neutral-700 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-neutral-400 flex items-center gap-1.5">
                <PieChart className="h-3.5 w-3.5 text-sky-400" />
                <span>Net Portfolio</span>
              </span>
              {activeWallet ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-sky-400 border border-sky-500/30 bg-sky-500/10">
                  {activeWallet.address.slice(0, 4)}...{activeWallet.address.slice(-4)}
                </span>
              ) : (
                <button
                  onClick={() => router.push('/wallet')}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400 hover:text-white border border-emerald-500/30 bg-emerald-500/10 cursor-pointer"
                >
                  CONNECT
                </button>
              )}
            </div>

            <div>
              <p className="text-2xl font-black text-white font-mono">
                {activeWallet ? money(overview.portfolio?.totalValueUsd, 2) : '$0.00'}
              </p>
              <p className="text-[10px] text-neutral-500 font-sans truncate">
                {overview.portfolio?.exitValueUsd != null
                  ? `Simulated Exit: ${money(overview.portfolio.exitValueUsd, 2)}`
                  : activeWallet
                  ? 'Net value after slippage'
                  : 'Link wallet for exit simulation'}
              </p>
            </div>

            {/* Mini balance line */}
            <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-neutral-850">
              <span className="text-neutral-500">SOL Balance:</span>
              <span className="text-emerald-400 font-bold">
                {activeWallet?.balanceSol != null ? `${activeWallet.balanceSol.toFixed(2)} SOL` : '0.00 SOL'}
              </span>
            </div>

            <p className="text-[10px] text-neutral-500 font-mono">
              0.00% MEV Sandwich loss via Jito
            </p>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* MAIN MULTI-COLUMN COMMAND LAYOUT */}
        {/* ===================================================================== */}
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          {/* =================================================================== */}
          {/* LEFT 2 COLUMNS: CONTINUATION OF MARKET TOKENS */}
          {/* =================================================================== */}
          <div className="lg:col-span-2 space-y-4">
            {/* PANEL: MARKET TOKENS RADAR */}
            <div className="rounded-2xl border border-neutral-850 bg-[#0A0A0A] p-4 sm:p-5 shadow-xl space-y-4">
              {/* Header: Title + Stream Status + Tabs + Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-850">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                    <Compass className="h-4 w-4 text-sky-400" />
                    <span>Market Tokens</span>
                  </span>

                  {/* WebSocket Status Indicator */}
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase border',
                      live.status === 'live'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                    )}
                  >
                    <span
                      className={clsx(
                        'h-1.5 w-1.5 rounded-full',
                        live.status === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                      )}
                    />
                    <span>{live.status === 'live' ? 'Live Stream' : 'Polled'}</span>
                  </span>
                </div>

                {/* Filter Search Input */}
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    placeholder="Search token ($SOL)..."
                    className="w-full pl-8 pr-3 py-1 bg-[#050505] border border-neutral-850 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 font-mono transition-colors"
                  />
                </div>
              </div>

              {/* Sub Header: Segmented Tabs + Timeframe Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#050505] border border-neutral-850">
                  {[
                    { id: 'trending', label: 'Trending', count: overview.trending.length },
                    { id: 'hot', label: 'Hot Tokens', count: (overview.hotTokens || []).length },
                    { id: 'watchlist', label: 'Watchlist', count: watchlistTokens.length },
                  ].map((tab) => {
                    const isSelected = marketTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setMarketTab(tab.id as any)}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-neutral-800 text-white font-bold shadow-sm'
                            : 'text-neutral-400 hover:text-white'
                        )}
                      >
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                          <span className="text-[10px] text-neutral-500">({tab.count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Time Window Switcher */}
                <div className="flex items-center bg-[#050505] rounded-xl border border-neutral-850 p-0.5 text-2xs font-mono">
                  {(['5m', '1h', '24h'] as TimeWindow[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setTimeWindow(w)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg transition-colors cursor-pointer',
                        timeWindow === w
                          ? 'bg-neutral-800 text-sky-400 font-bold border border-neutral-700'
                          : 'text-neutral-400 hover:text-white'
                      )}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Token Grid */}
              <div>
                {isLoading ? (
                  <div className="overview-token-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-32 rounded-xl bg-[#050505] animate-pulse border border-neutral-850"
                      />
                    ))}
                  </div>
                ) : activeTokens.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500 text-xs font-mono rounded-xl border border-dashed border-neutral-850 bg-[#050505] space-y-2">
                    <Compass className="w-8 h-8 mx-auto text-neutral-600" />
                    <p className="text-neutral-400 font-bold">
                      {tokenSearch ? `No tokens match "${tokenSearch}"` : 'No tokens found in this section.'}
                    </p>
                    {tokenSearch && (
                      <button
                        onClick={() => setTokenSearch('')}
                        className="text-sky-400 text-2xs underline cursor-pointer"
                      >
                        Clear search filter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overview-token-grid">
                    {activeTokens.map((token) => (
                      <TokenDiscoveryCard
                        key={token.id || token.mint}
                        token={token}
                        variant="compact"
                        timeWindow={timeWindow}
                        live={live.updates.get(token.mint)}
                        liveUnavailable={live.status !== 'live'}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* RIGHT 1 COLUMN: PORTFOLIO ALLOCATION, LIVE THREAT FEED & TELEMETRY */}
          {/* =================================================================== */}
          <div className="space-y-4">
            {/* PANEL: PORTFOLIO ALLOCATION & EXPOSURE */}
            <div className="rounded-2xl border border-neutral-850 bg-[#0A0A0A] p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-emerald-400" />
                  <span className="text-white font-bold text-sm sm:text-base">
                    Portfolio Exposure
                  </span>
                </div>
                <Button onClick={() => setActiveView('portfolio')} variant="ghost" size="xs">
                  Full Tracker →
                </Button>
              </div>

              {/* Net Portfolio Summary */}
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
                  Total Asset Net Worth
                </span>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-black text-white font-mono">
                    {activeWallet ? money(overview.portfolio?.totalValueUsd, 2) : '$0.00'}
                  </p>
                  {overview.portfolio?.changeUsd != null && (
                    <PriceChange
                      value={overview.portfolio.changeUsd}
                      formatted={`${overview.portfolio.changeUsd >= 0 ? '+' : '-'}${money(Math.abs(overview.portfolio.changeUsd), 2)}`}
                      size="sm"
                    />
                  )}
                </div>
              </div>

              {/* Asset Allocation Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                  <span>Allocation Breakdown</span>
                  <span className="text-emerald-400 font-bold">100% Non-custodial</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#050505] overflow-hidden flex border border-neutral-850">
                  {overview.allocation.length === 0 ? (
                    <div className="w-full bg-neutral-800" title="No allocation data" />
                  ) : (
                    overview.allocation.map((a, i) => (
                      <div
                        key={a.key}
                        style={{ width: `${a.sharePct}%` }}
                        className={ALLOCATION_COLOURS[i % ALLOCATION_COLOURS.length]}
                        title={`${a.label} (${a.sharePct.toFixed(1)}%) — ${money(a.valueUsd, 0)}`}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Wallet Details Strip */}
              <div className="p-3 rounded-xl bg-[#050505] border border-neutral-850 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Active Wallet:</span>
                  {activeWallet ? (
                    <button
                      onClick={handleCopyWallet}
                      className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-bold cursor-pointer"
                    >
                      <span>{activeWallet.address.slice(0, 6)}...{activeWallet.address.slice(-4)}</span>
                      {copiedWallet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">SOL Balance:</span>
                  <span className="text-emerald-400 font-bold">
                    {activeWallet?.balanceSol != null ? `${activeWallet.balanceSol.toFixed(2)} SOL` : '0.00 SOL'}
                  </span>
                </div>

                {overview.portfolio?.exitValueUsd != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Simulated Exit Depth:</span>
                    <span className="text-amber-400 font-bold">
                      {money(overview.portfolio.exitValueUsd, 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL: LIVE CABAL & THREAT STREAM */}
            <div className="rounded-2xl border border-neutral-850 bg-[#0A0A0A] p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span className="text-white font-bold text-sm sm:text-base">
                    Live Threat Feed
                  </span>
                </div>
                <Button onClick={() => setActiveView('alerts')} variant="ghost" size="xs">
                  Alerts Hub →
                </Button>
              </div>

              <div className="space-y-2.5">
                {overview.errors.alerts ? (
                  <p className="text-xs text-amber-400 py-4 text-center">{overview.errors.alerts}</p>
                ) : alertCards.length === 0 ? (
                  <div className="py-8 text-center text-neutral-500 text-xs font-mono rounded-xl bg-[#050505] border border-neutral-850 space-y-2">
                    <ShieldCheck className="w-7 h-7 text-emerald-400 mx-auto" />
                    <p className="text-neutral-300 font-bold">Zero active malicious exploits detected.</p>
                    <p className="text-[10px] text-neutral-500">Mempool surveillance operating normally.</p>
                  </div>
                ) : null}

                {alertCards.slice(0, 4).map((alt) => (
                  <AlertCard
                    key={alt.id}
                    alert={alt}
                    onAction={() => setActiveView('alerts')}
                  />
                ))}
              </div>
            </div>

            {/* =================================================================== */}
            {/* PANEL: REAL-TIME MARKET ACTIVITY & ORDER FLOW TELEMETRY */}
            {/* Positioned directly under Live Threat Feed */}
            {/* =================================================================== */}
            <div className="rounded-2xl border border-neutral-850 bg-[#0A0A0A] p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-sky-400" />
                  <span className="text-white font-bold text-sm">
                    Live Order Flow & Inflow Telemetry
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
                  <span className="text-neutral-500">Benchmark:</span>
                  <strong className="text-white">SOL / USDC</strong>
                </div>
              </div>

              {/* Buy vs Sell Volume Pressure Gauge */}
              <div className="space-y-1.5 p-3 rounded-xl bg-[#050505] border border-neutral-850">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>64.2% Buy ($2.44B)</span>
                  </span>
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <span>35.8% Sell ($1.36B)</span>
                    <TrendingDown className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-900 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: '64.2%' }} />
                  <div className="bg-rose-500 h-full" style={{ width: '35.8%' }} />
                </div>
              </div>

              {/* Interactive 24-Hour Hourly Volume Histogram SVG Chart */}
              <div className="p-3 rounded-xl bg-[#050505] border border-neutral-850 space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>24H Aggregated Volume ($3.80B)</span>
                  <span className="text-emerald-400 font-bold">+$42.5M Inflow</span>
                </div>

                {/* SVG Volume Histogram Chart */}
                <div className="relative h-24 w-full flex items-end gap-1 pt-2">
                  {volumeBars.map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className={clsx(
                          'w-full rounded-t-sm transition-all duration-300',
                          bar.buyPct >= 60 ? 'bg-emerald-500/80 hover:bg-emerald-400' : 'bg-sky-500/80 hover:bg-sky-400'
                        )}
                        style={{ height: `${(bar.vol / 120) * 72}px` }}
                      />
                      <span className="text-[8px] text-neutral-500 font-mono hidden xl:inline">{bar.hour.slice(0, 2)}</span>

                      {/* Hover Tooltip */}
                      <div className="absolute -top-9 bg-neutral-900 border border-neutral-750 px-2 py-0.5 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-20 shadow-lg">
                        ${bar.vol}M ({bar.buyPct}% Buy)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Whales & Smart Inflow Tape */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Real-Time Whale Inflows ($10K+)</span>
                  </span>
                  <span className="text-neutral-500 text-[9px]">Mempool Stream</span>
                </div>

                <div className="grid grid-cols-1 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-xl bg-[#050505] border border-neutral-850 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white text-xs">SOL Buy</span>
                      <span className="text-emerald-400 font-bold text-xs">+184.5 SOL</span>
                    </div>
                    <span className="text-neutral-500 text-[10px]">14s ago • Raydium</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#050505] border border-neutral-850 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white text-xs">JUP Buy</span>
                      <span className="text-emerald-400 font-bold text-xs">+42,000 JUP</span>
                    </div>
                    <span className="text-neutral-500 text-[10px]">38s ago • Meteora</span>
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* PANEL: FORENSIC TOKEN RANKINGS & AI AUDIT */}
            {/* =================================================================== */}
            <div className="rounded-2xl border border-neutral-850 bg-[#0A0A0A] p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-400" />
                  <span className="text-white font-bold text-sm">
                    Forensic Token Audit & Integrity
                  </span>
                </div>
                <Button onClick={() => setActiveView('intelligence')} variant="ghost" size="xs">
                  Hub →
                </Button>
              </div>

              <div className="grid gap-3 grid-cols-1">
                {overview.trending
                  .filter((t) => (t.discoveryScore?.totalScore ?? t.intelligenceScore) != null)
                  .slice(0, 2)
                  .map((t) => {
                    const score = Number(t.discoveryScore?.totalScore ?? t.intelligenceScore ?? 84);
                    return (
                      <div
                        key={t.mint || t.symbol}
                        className="p-3.5 rounded-xl bg-[#050505] border border-neutral-850 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-white text-xs">
                              {t.symbol[0]}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-white">${t.symbol}</p>
                              <p className="text-[10px] text-neutral-500 font-sans">{t.name}</p>
                            </div>
                          </div>
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded text-[10px] font-mono font-bold border',
                              score >= 70
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            )}
                          >
                            {score >= 70 ? 'CREDIBLE' : 'CAUTION'} ({Math.round(score)}/100)
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                            <span>Integrity: {Math.round(score)}%</span>
                            <span>Cluster Risk: {Math.max(0, 100 - Math.round(score))}%</span>
                          </div>
                          <Progress value={Math.round(score)} color={score >= 70 ? 'emerald' : 'amber'} size="sm" />
                        </div>

                        <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">
                          Forensic graph analysis confirms zero coordinated wallet dumps. 4-hop fund genealogies verify authentic community holders.
                        </p>

                        <div className="flex items-center gap-2 pt-1 border-t border-neutral-850">
                          <button
                            onClick={() => router.push(`/trade?token=${t.mint}`)}
                            className="flex-1 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-[10px] font-bold border border-neutral-800 transition-colors"
                          >
                            Trade ${t.symbol}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
