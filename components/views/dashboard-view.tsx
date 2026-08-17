'use client';

import React, { useState } from 'react';
import {
  Compass,
  ShieldAlert,
  Zap,
  TrendingUp,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricTile } from '@/components/ui/metric-tile';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { PriceChange } from '@/components/ui/price-change';
import { TokenCard, TokenCardData } from '@/components/ui/token-card';
import { AlertCard, AlertCardData } from '@/components/ui/alert-card';
import { IntelligenceScore } from '@/components/ui/intelligence-score';
import { Progress } from '@/components/ui/progress';
import { Tabs } from '@/components/ui/tabs';
import { useAppState, useAppActions } from '@/lib/store';
import { useMarketData } from '@/lib/hooks/use-market-data';
import { useWatchlist } from '@/lib/store/watchlist-store';

export function DashboardView() {
  const { isLoading: isGlobalLoading, connectedWallet, primaryWallet } = useAppState();
  const { refreshOverview, setQuickBuyOpen, setActiveView } = useAppActions();
  const { watchlistedMints } = useWatchlist();
  const [marketTab, setMarketTab] = useState<'trending' | 'top' | 'watchlist'>('trending');
  
  const { tokens: trendingTokens, isLoading, marketSummary } = useMarketData();
  const activeWallet = primaryWallet || connectedWallet;

  // Curated High-Cap & High-Volume Top Solana Ecosystem Tokens
  const topTokens: TokenCardData[] = [
    {
      name: 'Solana',
      symbol: '$SOL',
      mint: 'So11111111111111111111111111111111111111112',
      price: `$${(marketSummary.solPriceUsd ?? 184.5).toFixed(2)}`,
      priceChange24h: marketSummary.solChange24h ?? 4.2,
      mcap: '$88.5B',
      liquidity: '$4.2B',
      volume24h: `$${((marketSummary.totalVolume24hUsd ?? 4200000000) / 1_000_000_000).toFixed(1)}B`,
      intelligenceScore: 98,
      badges: ['verified', 'smart-money'],
      sparklineData: [40, 55, 65, 75, 85, 90, 98],
    },
    {
      name: 'Jupiter',
      symbol: '$JUP',
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      price: '$1.18',
      priceChange24h: 12.4,
      mcap: '$1.58B',
      liquidity: '$320M',
      volume24h: '$240M',
      intelligenceScore: 95,
      badges: ['verified'],
      sparklineData: [35, 45, 58, 65, 78, 88, 95],
    },
    {
      name: 'Bonk',
      symbol: '$BONK',
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      price: '$0.0000284',
      priceChange24h: 24.8,
      mcap: '$1.85B',
      liquidity: '$180M',
      volume24h: '$410M',
      intelligenceScore: 92,
      badges: ['verified', 'trending'],
      sparklineData: [20, 35, 50, 65, 78, 85, 92],
    },
    {
      name: 'dogwifhat',
      symbol: '$WIF',
      mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      price: '$2.42',
      priceChange24h: 8.6,
      mcap: '$2.41B',
      liquidity: '$210M',
      volume24h: '$380M',
      intelligenceScore: 90,
      badges: ['verified'],
      sparklineData: [45, 52, 60, 68, 75, 82, 90],
    },
    {
      name: 'Raydium Revival',
      symbol: '$RAYR',
      mint: '4kF8...1z55',
      price: '$3.85',
      priceChange24h: 52.1,
      mcap: '$1.12B',
      liquidity: '$195M',
      volume24h: '$280M',
      intelligenceScore: 93,
      badges: ['verified'],
      sparklineData: [50, 65, 70, 80, 85, 95],
    },
    {
      name: 'Solana Sentinel',
      symbol: '$SENT',
      mint: '7xK99zK8mP2xQ5wN3a19',
      price: '$0.0425',
      priceChange24h: 34.2,
      mcap: '$14.2M',
      liquidity: '$820K',
      volume24h: '$4.2M',
      intelligenceScore: 94,
      badges: ['verified', 'smart-money'],
      sparklineData: [30, 45, 60, 50, 75, 85, 90, 100],
    },
  ];

  // Watchlisted Tokens (Filter from trending + top or fallback)
  const allAvailableTokens = [...topTokens, ...trendingTokens];
  const watchlistedTokens = allAvailableTokens.filter((t) => watchlistedMints.includes(t.mint));
  const activeWatchlistList = watchlistedTokens.length > 0 ? watchlistedTokens : [topTokens[0], topTokens[5]];

  const mockAlerts: AlertCardData[] = [
    {
      id: 'alt1',
      type: 'Wash Trading Detected',
      severity: 'critical',
      timestamp: '2m ago',
      tokenSymbol: '$MEME',
      tokenName: 'Solana Meme',
      description: 'Circular volume loop identified between 4 linked wallets. Organic score reduced to 12/100.',
      evidence: '4 wallets exchanging 85% of volume in tight 10s cycles',
    },
    {
      id: 'alt2',
      type: 'Dev Cluster Liquidity Drain Risk',
      severity: 'high',
      timestamp: '8m ago',
      tokenSymbol: '$CYBER',
      tokenName: 'Cyber Core AI',
      description: 'Top deployer wallet moved 25% supply to CEX deposit routing contract.',
      evidence: 'Transfer to Binance deposit address detected',
    },
    {
      id: 'alt3',
      type: 'Smart Money Inflow Wave',
      severity: 'low',
      timestamp: '14m ago',
      tokenSymbol: '$SENT',
      tokenName: 'Solana Sentinel',
      description: '12 tracked high-conviction alpha wallets bought $SENT in the past 15 minutes.',
      evidence: '12 Tier-1 smart wallets accumulated 450 SOL worth of $SENT',
    },
  ];

  return (
    <div className="space-y-3.5 max-w-[1600px] mx-auto select-none">
      {/* Top Hero Banner */}
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-sentinel-900/90 via-sentinel-950/95 to-sentinel-900/80 p-4 sm:p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative overflow-hidden backdrop-blur-2xl group hover:border-sky-500/30 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-glow opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Badge variant="cyan" size="sm" pulse>
              SOLANA INTELLIGENCE TERMINAL
            </Badge>
            <span className="text-2xs font-mono text-slate-400">Institutional Market Engine</span>
          </div>
          <h1 className="mt-1.5 text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
            Market Integrity & Intelligence Terminal
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs sm:text-sm text-slate-300">
            Real-time effective ownership tracking, organic demand filtering, and zero-latency execution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative z-10">
          <Button onClick={refreshOverview} variant="secondary" size="sm" isLoading={isGlobalLoading} leftIcon={<RefreshCcw className="h-3.5 w-3.5" />}>
            Refresh Engine
          </Button>
          <Button onClick={() => setActiveView('trade')} variant="buy" size="sm" rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>
            Open Trade Terminal
          </Button>
        </div>
      </div>

      {/* 1. Market Overview Row (Sentiment, Volume, Stats) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sentiment Gauge Card */}
        <div className="rounded-xl border border-white/[0.08] bg-sentinel-900/80 backdrop-blur-xl p-3.5 shadow-card space-y-2 hover:border-emerald-500/35 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 font-mono">Market Sentiment</span>
            <Gauge className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_6px_rgba(0,229,153,0.5)]" />
          </div>
          <div className="flex items-baseline justify-between font-numeric">
            <span className="text-xl sm:text-2xl font-bold text-emerald-400">
              {Math.min(99, Math.max(20, Math.round(50 + marketSummary.solChange24h * 3)))}
              <span className="text-xs text-slate-400">/100</span>
            </span>
            <Badge variant={marketSummary.solChange24h >= 0 ? 'risk-low' : 'risk-high'}>
              {marketSummary.solChange24h >= 0 ? 'BULLISH VELOCITY' : 'BEARISH PRESSURE'}
            </Badge>
          </div>
          <Progress value={Math.min(99, Math.max(20, Math.round(50 + marketSummary.solChange24h * 3)))} color="emerald" size="sm" />
          <p className="text-[10px] text-slate-400 font-mono">
            {marketSummary.solChange24h >= 0
              ? 'Organic buyer growth outstripping insider dumps by 3.4x'
              : 'Distribution detected across high-volume liquidity pools'}
          </p>
        </div>

        <MetricTile
          title="Organic Volume (24h)"
          rawValue={`$${((marketSummary.totalVolume24hUsd || 48200000) / 1000000).toFixed(1)}M`}
          adjustedValue={`Adj: $${(((marketSummary.totalVolume24hUsd || 48200000) * 0.82) / 1000000).toFixed(1)}M`}
          change={`${marketSummary.solChange24h >= 0 ? '+' : ''}${marketSummary.solChange24h.toFixed(2)}%`}
          changeType={marketSummary.solChange24h >= 0 ? 'positive' : 'negative'}
          sparklineData={[30, 45, 60, 50, 75, 85, 90 + Math.round(marketSummary.solChange24h)]}
          subtitle="Filtered wash-trading"
        />
        <MetricTile
          title="Active Threat Alerts"
          rawValue="4 Flagged"
          change="Critical"
          changeType="negative"
          badgeText="THREAT DETECTED"
          badgeVariant="danger"
          sparklineData={[10, 20, 15, 40, 80, 95]}
          subtitle="Coordinated wallet clusters"
        />
        <MetricTile
          title="Portfolio Net Value"
          rawValue="$138,450.00"
          adjustedValue="$134,120.00"
          change="+$14,210.00 (+11.4%)"
          changeType="positive"
          sparklineData={[60, 65, 70, 75, 85, 95]}
          subtitle="Net value after fees & slippage"
        />
      </div>

      {/* Main Multi-Column Section */}
      <div className="grid gap-3.5 lg:grid-cols-3">
        {/* Left 2 Columns: Market Overview & Intelligence */}
        <div className="lg:col-span-2 space-y-3.5">
          {/* Section: Market Overview Tokens */}
          <Panel
            padding="sm"
            title={
              <span className="flex items-center gap-2 text-sky-400 font-bold text-xs sm:text-sm">
                <Compass className="h-4 w-4" /> Market Overview Tokens
              </span>
            }
            headerActions={
              <Tabs
                activeTab={marketTab}
                onChange={(id) => setMarketTab(id as any)}
                variant="segmented"
                size="sm"
                tabs={[
                  { id: 'trending', label: 'Trending Tokens', count: trendingTokens.length },
                  { id: 'top', label: 'Top Tokens', count: topTokens.length },
                  { id: 'watchlist', label: 'Watchlist', count: watchlistedTokens.length },
                ]}
              />
            }
          >
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                 <div className="h-32 rounded-xl bg-sentinel-800/50 animate-pulse border border-white/5" />
                 <div className="h-32 rounded-xl bg-sentinel-800/50 animate-pulse border border-white/5" />
                 <div className="h-32 rounded-xl bg-sentinel-800/50 animate-pulse border border-white/5" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(marketTab === 'trending'
                  ? trendingTokens
                  : marketTab === 'top'
                  ? topTokens
                  : activeWatchlistList
                ).map((t) => (
                  <TokenCard
                    key={t.symbol + t.mint}
                    token={t}
                    onQuickBuy={() => setQuickBuyOpen(true, t)}
                    onClick={() => setActiveView('trade')}
                  />
                ))}
              </div>
            )}
          </Panel>

          {/* Section: Market Activity Stream */}
          <Panel
            padding="sm"
            title={
              <span className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                <BarChart2 className="h-4 w-4 text-sky-400" /> Solana Market Activity & Execution Stream
              </span>
            }
          >
            <div className="h-56 w-full bg-sentinel-950/90 rounded-xl border border-sentinel-800 p-3.5 terminal-grid-bg relative flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Pair: <strong className="text-white">SOL / USDC (Mainnet)</strong></span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-status-pulse shadow-[0_0_8px_rgba(0,229,153,0.8)]" /> Live Stream
                </span>
              </div>

              {/* Simulated Chart Bars */}
              <div className="h-32 w-full flex items-end justify-between px-1 gap-1 opacity-90">
                {[30, 45, 60, 40, 75, 90, 65, 85, 95, 110, 100, 120, 115, 130, 125, 140].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      style={{ height: `${val * 0.65}%` }}
                      className={`w-full rounded-t-[1px] transition-all ${
                        idx % 3 === 0 ? 'bg-rose-500/80 shadow-[0_0_6px_rgba(255,59,105,0.3)]' : 'bg-emerald-500/80 shadow-[0_0_6px_rgba(0,229,153,0.3)]'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-2xs font-numeric text-slate-400 pt-1.5 border-t border-sentinel-800/80">
                <span>TPS: <strong className="text-sky-300">2,840</strong></span>
                <span>Avg Block: <strong className="text-slate-200">420ms</strong></span>
                <span>24h Vol: <strong className="text-emerald-400">$48.2M</strong></span>
              </div>
            </div>
          </Panel>

          {/* Section: Intelligence Scores Ranking */}
          <Panel
            padding="sm"
            title={
              <span className="flex items-center gap-2 text-sky-400 font-bold text-xs sm:text-sm">
                <Sparkles className="h-4 w-4" /> Top Token Intelligence Rankings
              </span>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <IntelligenceScore
                data={{
                  overallScore: 94,
                  riskScore: 6,
                  confidence: 98,
                  status: 'Credible',
                  summary: '$SENT exhibits 92.4% organic buyer distribution with zero connected funding clusters.',
                }}
              />
              <IntelligenceScore
                data={{
                  overallScore: 32,
                  riskScore: 88,
                  confidence: 87,
                  status: 'High Risk',
                  summary: '$SOLM flagged: 17 top wallets funded from same exchange deposit key.',
                }}
              />
            </div>
          </Panel>
        </div>

        {/* Right 1 Column: Portfolio Preview & Risk Alerts Stream */}
        <div className="space-y-3.5">
          {/* Section: Portfolio Preview */}
          <Panel
            padding="sm"
            title={
              <span className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                <PieChart className="h-4 w-4" /> Portfolio Allocation Preview
              </span>
            }
            headerActions={
              <Button onClick={() => setActiveView('portfolio')} variant="ghost" size="xs">
                View Full
              </Button>
            }
          >
            <div className="space-y-3 font-numeric">
              <div className="flex justify-between items-baseline">
                <div>
                  <span className="text-2xs text-slate-400 uppercase font-mono">Net Portfolio</span>
                  <p className="text-xl font-bold text-white">$138,450.00</p>
                </div>
                <PriceChange value={11.4} formatted="+$14,210.00 (+11.4%)" size="sm" />
              </div>

              {/* Allocation Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-2xs font-mono text-slate-400">
                  <span>Asset Allocation</span>
                  <span className="text-[10px]">SOL (45%) • $SENT (35%)</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-sentinel-950 overflow-hidden flex border border-sentinel-800">
                  <div style={{ width: '45%' }} className="bg-sky-400 shadow-[0_0_6px_rgba(0,240,255,0.4)]" title="SOL (45%)" />
                  <div style={{ width: '35%' }} className="bg-emerald-400 shadow-[0_0_6px_rgba(0,229,153,0.4)]" title="$SENT (35%)" />
                  <div style={{ width: '15%' }} className="bg-purple-400" title="$CYBER (15%)" />
                  <div style={{ width: '5%' }} className="bg-slate-400" title="USDC (5%)" />
                </div>
              </div>

              <div className="pt-2 border-t border-sentinel-800/80 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Wallet:</span>
                  <span className="font-bold text-sky-300 font-mono">{activeWallet?.address.slice(0, 6)}...{activeWallet?.address.slice(-4) || '7xK9...3a19'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Balance:</span>
                  <span className="font-bold text-emerald-400">{activeWallet?.balanceSol ?? 42.85} SOL</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Section: Risk Alerts Stream */}
          <Panel
            padding="sm"
            title={
              <span className="flex items-center gap-2 text-rose-400 font-bold text-xs sm:text-sm">
                <ShieldAlert className="h-4 w-4" /> Live Threat Activity Stream
              </span>
            }
            headerActions={
              <Button onClick={() => setActiveView('alerts')} variant="ghost" size="xs">
                Alerts Feed
              </Button>
            }
          >
            <div className="space-y-2.5">
              {mockAlerts.map((alt) => (
                <AlertCard
                  key={alt.id}
                  alert={alt}
                  onAction={() => setActiveView('alerts')}
                />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
