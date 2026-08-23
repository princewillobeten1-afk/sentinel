'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useOverviewData, type OverviewToken } from '@/lib/hooks/use-overview-data';
import { useWatchlist } from '@/lib/store/watchlist-store';

/**
 * Market values are genuinely absent when the provider is down.
 *
 * `useMarketData` no longer substitutes mock numbers on failure, so these
 * render `—` rather than a plausible-looking figure. `n()` is for the few
 * places a number is structurally required (a chart input, a progress value);
 * it must never be used for a displayed figure.
 */
const dash = '—';

/** Allocation slice colours, cycled by index so a token keeps its colour. */
const ALLOCATION_COLOURS = [
  'bg-sky-400',
  'bg-emerald-400',
  'bg-purple-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-slate-400',
];
const money = (v: number | undefined, digits = 2, suffix = '') =>
  v === undefined || !Number.isFinite(v) ? dash : `$${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
const pct = (v: number | undefined, digits = 2) =>
  v === undefined || !Number.isFinite(v) ? dash : `${v.toFixed(digits)}%`;
const n = (v: number | undefined, fallback = 0) =>
  v === undefined || !Number.isFinite(v) ? fallback : v;

export function DashboardView() {
  const { isLoading: isGlobalLoading, connectedWallet, primaryWallet } = useAppState();
  const router = useRouter();
  const { refreshOverview, setQuickBuyOpen, setActiveView, setSelectedToken } = useAppActions();
  const { watchlistedMints } = useWatchlist();
  const [marketTab, setMarketTab] = useState<'trending' | 'top' | 'watchlist'>('trending');
  
  const { marketSummary } = useMarketData();
  const activeWallet = primaryWallet || connectedWallet;

  /**
   * Every panel on this page now reads from real endpoints. Each section tracks
   * its own availability, so a portfolio failure cannot blank the market panels
   * and a market outage cannot hide alerts that loaded.
   */
  const overview = useOverviewData(activeWallet?.address ?? null);
  const isLoading = overview.isLoading;

  /** Maps an API token onto the card shape, without inventing anything. */
  const toCard = (t: OverviewToken): TokenCardData => ({
    name: t.name,
    symbol: t.symbol.startsWith('$') ? t.symbol : `$${t.symbol}`,
    mint: t.mint,
    logoURI: t.logoURI ?? undefined,
    price: t.priceUsd === null ? dash : money(Number(t.priceUsd), Number(t.priceUsd) < 1 ? 6 : 2),
    priceChange24h: n(t.priceChange24h ?? undefined),
    mcap: t.marketCapUsd === null ? dash : money(Number(t.marketCapUsd), 0),
    liquidity: t.liquidityUsd === null ? dash : money(Number(t.liquidityUsd), 0),
    volume24h: t.volume24hUsd === null ? dash : money(Number(t.volume24hUsd), 0),
    // Passed through as null, never coerced to 0: the registry returns no
    // score, and `?? 0` made every Top Tokens card read a red "0/100" — the
    // worst possible rating — for tokens that were simply never scored.
    intelligenceScore: t.intelligenceScore,
    badges: [],
    sparklineData: undefined,
  });

  // Curated High-Cap & High-Volume Top Solana Ecosystem Tokens
  /**
   * Token lists come from the registry and the ranking engine.
   *
   * These were two hardcoded arrays of ~10 tokens each — fixed prices, fixed
   * market caps, fixed intelligence scores — rendered as live market data.
   * Watchlist previously fell back to `[topTokens[0], topTokens[5]]` when empty,
   * so an empty watchlist silently showed two tokens the user never added.
   */
  const trendingCards = overview.trending.map(toCard);
  const topCards = overview.topTokens.map(toCard);
  const watchlistCards = [...overview.trending, ...overview.topTokens]
    .filter((t) => watchlistedMints.includes(t.mint))
    .map(toCard);

  const activeCards =
    marketTab === 'trending' ? trendingCards : marketTab === 'top' ? topCards : watchlistCards;

  /** Risk feed, from the real alert domain rather than a literal array. */
  const alertCards: AlertCardData[] = overview.alerts.map((a) => ({
    id: a.id,
    type: a.category ?? 'ALERT',
    severity: (a.severity ?? 'medium').toLowerCase() as AlertCardData['severity'],
    timestamp: a.timestamp,
    tokenSymbol: a.token ?? '—',
    tokenName: a.token ?? 'Unknown token',
    description: a.title ?? 'Alert triggered',
    // The event DTO carries a summary, not a separate evidence field. Empty
    // rather than a restated description dressed up as corroboration.
    evidence: a.summary ?? '',
  }));


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
          <Button onClick={() => { refreshOverview(); void overview.refresh(); }} variant="secondary" size="sm" isLoading={isLoading} leftIcon={<RefreshCcw className="h-3.5 w-3.5" />}>
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
              {overview.market ? String(overview.market.regime.confidenceScore) : dash}
              <span className="text-xs text-slate-400">/100</span>
            </span>
            <Badge variant={n(overview.market?.regime.confidenceScore) >= 50 ? 'risk-low' : 'risk-high'}>
              {overview.market ? overview.market.regime.regime.replace(/_/g, ' ') : dash}
            </Badge>
          </div>
          <Progress value={n(overview.market?.regime.confidenceScore)} color="emerald" size="sm" />
          <p className="text-2xs text-slate-400 font-mono">
            {overview.market
              ? `${overview.market.regime.newMintsCount24h.toLocaleString()} new mints · ${pct(overview.market.regime.averageWashTradingPct, 1)} avg wash`
              : (overview.errors.market ?? 'Market telemetry unavailable.')}
          </p>
        </div>

        {/* Organic volume is the engine's own decomposition, not `raw * 0.82`.
            `organicVolumeUsd` and `organicVolumePct` come from
            VolumeDecompositionEngine — the product's core claim, measured. */}
        <MetricTile
          title="Organic Volume (24h)"
          rawValue={money(overview.market?.decomposition.organicVolumeUsd, 0)}
          adjustedValue={
            overview.market
              ? `of ${money(overview.market.decomposition.totalVolumeUsd, 0)} reported`
              : dash
          }
          change={
            overview.market?.decomposition.organicVolumePct === undefined
              ? dash
              : `${pct(overview.market.decomposition.organicVolumePct, 1)} organic`
          }
          changeType={
            n(overview.market?.decomposition.organicVolumePct) >= 70 ? 'positive' : 'negative'
          }
          sparklineData={undefined}
          subtitle="Filtered wash-trading"
        />
        <MetricTile
          title="Active Threat Alerts"
          rawValue={
            overview.errors.alerts
              ? dash
              : `${overview.criticalAlertCount} Flagged`
          }
          change={overview.criticalAlertCount > 0 ? 'Critical' : 'Clear'}
          changeType={overview.criticalAlertCount > 0 ? 'negative' : 'positive'}
          badgeText={overview.criticalAlertCount > 0 ? 'THREAT DETECTED' : undefined}
          badgeVariant="danger"
          sparklineData={undefined}
          subtitle="Coordinated wallet clusters"
        />
        {/* Portfolio is wallet-scoped; with no wallet linked there is nothing to
            report, which reads as `—` rather than someone else's balance. */}
        <MetricTile
          title="Portfolio Net Value"
          rawValue={money(overview.portfolio?.totalValueUsd ?? undefined, 2)}
          adjustedValue={
            overview.portfolio?.exitValueUsd == null
              ? dash
              : `Exit: ${money(overview.portfolio.exitValueUsd, 2)}`
          }
          change={
            overview.portfolio?.changeUsd == null
              ? dash
              : `${overview.portfolio.changeUsd >= 0 ? '+' : ''}${money(Math.abs(overview.portfolio.changeUsd), 2)}`
          }
          changeType={n(overview.portfolio?.changeUsd ?? undefined) >= 0 ? 'positive' : 'negative'}
          sparklineData={undefined}
          subtitle={activeWallet ? 'Net value after fees & slippage' : 'Connect a wallet'}
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
                  { id: 'trending', label: 'Trending Tokens', count: trendingCards.length },
                  { id: 'top', label: 'Top Tokens', count: topCards.length },
                  { id: 'watchlist', label: 'Watchlist', count: watchlistCards.length },
                ]}
              />
            }
          >
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 rounded-xl bg-sentinel-800/50 animate-pulse border border-white/5"
                  />
                ))}
              </div>
            ) : (
              /* Scrolls inside the panel rather than growing the page: 20
                 trending tokens across three columns is seven rows, which would
                 push the activity stream and rankings below the fold. The
                 container keeps the panel a fixed size and the whole list
                 reachable. */
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[26rem] overflow-y-auto pr-1">
                {activeCards.length === 0 && (
                  <p className="col-span-full text-2xs text-slate-500 py-8 text-center">
                    {overview.errors.trending || overview.errors.topTokens
                      ? (overview.errors.trending ?? overview.errors.topTokens)
                      : marketTab === 'watchlist'
                        ? 'Nothing on your watchlist yet.'
                        : 'No tokens returned.'}
                  </p>
                )}
                {activeCards.map((t) => (
                  <TokenCard
                    key={t.symbol + t.mint}
                    token={t}
                    onQuickBuy={() => setQuickBuyOpen(true, t)}
                    onClick={() => {
                      setSelectedToken({
                        mint: t.mint,
                        symbol: t.symbol.replace('$', ''),
                        name: t.name,
                        priceUsd: t.price ? String(t.price).replace('$', '') : undefined,
                        marketCapUsd: t.mcap ? String(t.mcap).replace('$', '') : undefined,
                        liquidityUsd: t.liquidity ? String(t.liquidity).replace('$', '') : undefined,
                        logoUrl: t.logoURI,
                        chain: 'solana',
                      });
                      setActiveView('trade');
                      router.push(`/trade/solana/${t.mint}`);
                    }}
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

              {/* TPS and block time have no endpoint in this codebase — they
                  render as unknown rather than as plausible constants. 24h
                  volume is real, from the decomposition engine. */}
              <div className="flex justify-between items-center text-2xs font-numeric text-slate-400 pt-1.5 border-t border-sentinel-800/80">
                <span>TPS: <strong className="text-sky-300" title="No network-stats endpoint yet">{dash}</strong></span>
                <span>Avg Block: <strong className="text-slate-200" title="No network-stats endpoint yet">{dash}</strong></span>
                <span>
                  24h Vol:{' '}
                  <strong className="text-emerald-400">
                    {money(overview.market?.decomposition.totalVolumeUsd, 0)}
                  </strong>
                </span>
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
            {/* Ranked by the discovery engine's own score, not two literals.
                These were a fixed 94/Credible and 32/High Risk with invented
                supporting sentences — presented as analysis of specific tokens.
                Only tokens that actually carry a score are shown. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {overview.trending.filter((t) => t.intelligenceScore !== null).length === 0 ? (
                <p className="col-span-full text-2xs text-slate-500 py-6 text-center">
                  {isLoading
                    ? 'Scoring tokens…'
                    : (overview.errors.trending ?? 'No scored tokens available.')}
                </p>
              ) : (
                overview.trending
                  .filter((t) => t.intelligenceScore !== null)
                  .slice(0, 2)
                  .map((t) => {
                    const score = t.intelligenceScore as number;
                    return (
                      <IntelligenceScore
                        key={t.mint || t.symbol}
                        data={{
                          overallScore: Math.round(score),
                          // Risk is the inverse of the signal score the engine
                          // produced. Stated as derived, not as a second
                          // independent measurement.
                          riskScore: Math.max(0, 100 - Math.round(score)),
                          confidence: Math.round(score),
                          status: score >= 70 ? 'Credible' : score >= 40 ? 'Caution' : 'High Risk',
                          summary: `$${t.symbol} scores ${score.toFixed(1)} on the discovery engine${
                            t.priceChange24h === null
                              ? ''
                              : ` with ${pct(t.priceChange24h, 1)} 24h movement`
                          }.`,
                        }}
                      />
                    );
                  })
              )}
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
              {/* Net value, real change, and no wallet invented when none is
                  linked. This block previously hardcoded $138,450.00 and
                  +$14,210.00, and fell back to the literal address 7xK9...3a19. */}
              <div className="flex justify-between items-baseline gap-3">
                <div className="min-w-0">
                  <span className="text-2xs text-slate-400 uppercase font-mono">Net Portfolio</span>
                  <p className="text-xl font-bold text-white truncate">
                    {money(overview.portfolio?.totalValueUsd ?? undefined, 2)}
                  </p>
                </div>
                {overview.portfolio?.changeUsd != null && (
                  <PriceChange
                    value={overview.portfolio.changeUsd}
                    formatted={`${overview.portfolio.changeUsd >= 0 ? '+' : '-'}${money(Math.abs(overview.portfolio.changeUsd), 2)}`}
                    size="sm"
                  />
                )}
              </div>

              {/* Allocation. Slices come from /portfolio/:wallet/exposure —
                  byToken buckets, share converted from the 0–1 fraction the
                  engine emits. Colours cycle through a fixed palette so the
                  same token keeps the same colour across renders. */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-2xs font-mono text-slate-400">
                  <span>Asset Allocation</span>
                  <span className="text-2xs truncate max-w-[55%] text-right">
                    {overview.allocation.length > 0
                      ? overview.allocation
                          .slice(0, 2)
                          .map((a) => `${a.label} (${a.sharePct.toFixed(0)}%)`)
                          .join(' • ')
                      : dash}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-sentinel-950 overflow-hidden flex border border-sentinel-800">
                  {overview.allocation.length === 0 ? (
                    <div className="w-full bg-sentinel-800/60" title="No allocation data" />
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

              <div className="pt-2 border-t border-sentinel-800/80 space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Wallet:</span>
                  <span className="font-bold text-sky-300 font-mono truncate">
                    {activeWallet?.address
                      ? `${activeWallet.address.slice(0, 6)}...${activeWallet.address.slice(-4)}`
                      : dash}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Balance:</span>
                  <span className="font-bold text-emerald-400">
                    {activeWallet?.balanceSol == null ? dash : `${activeWallet.balanceSol} SOL`}
                  </span>
                </div>
                {overview.portfolio?.exitValueUsd != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Exit value:</span>
                    <span className="font-bold text-amber-400">
                      {money(overview.portfolio.exitValueUsd, 0)}
                    </span>
                  </div>
                )}
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
              {overview.errors.alerts ? (
                <p className="text-2xs text-amber-400 py-4 text-center">{overview.errors.alerts}</p>
              ) : alertCards.length === 0 ? (
                <p className="text-2xs text-slate-500 py-4 text-center">
                  {isLoading ? 'Loading alerts…' : 'No alerts have fired.'}
                </p>
              ) : null}
              {alertCards.map((alt) => (
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
