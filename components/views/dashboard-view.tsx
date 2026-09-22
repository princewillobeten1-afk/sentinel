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
import { clsx } from 'clsx';
import { TokenCard, TokenCardData } from '@/components/ui/token-card';
import { useLiveTokenUpdates } from '@/lib/hooks/use-live-token-updates';
import { AlertCard, AlertCardData } from '@/components/ui/alert-card';
import { IntelligenceScore } from '@/components/ui/intelligence-score';
import { Progress } from '@/components/ui/progress';
import { Tabs } from '@/components/ui/tabs';
import { useAppState, useAppActions } from '@/lib/store';
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
  const [marketTab, setMarketTab] = useState<'trending' | 'hot' | 'top' | 'watchlist'>('trending');
  
  const activeWallet = primaryWallet || connectedWallet;

  /**
   * Every panel on this page now reads from real endpoints. Each section tracks
   * its own availability, so a portfolio failure cannot blank the market panels
   * and a market outage cannot hide alerts that loaded.
   */
  const overview = useOverviewData(activeWallet?.address ?? null);
  const isLoading = overview.isLoading;

  /**
   * Tokens currently on screen. Only the active tab is rendered, so this is at
   * most 20 mints — which matters, because a browser session is capped at 30
   * WebSocket topics (see lib/ws/topic-plan.ts).
   */
  const visibleTokens =
    marketTab === 'trending'
      ? overview.trending
      : marketTab === 'hot'
        ? overview.hotTokens
        : marketTab === 'top'
          ? overview.topTokens
          : [...overview.trending, ...(overview.hotTokens || []), ...overview.topTokens].filter((t) =>
              watchlistedMints.includes(t.mint),
            );

  const live = useLiveTokenUpdates(visibleTokens.map((t) => t.mint));

  /**
   * Maps an API token onto the card shape, without inventing anything.
   *
   * Live WebSocket values are merged over the REST snapshot where they exist:
   * the REST poll is a periodic baseline, and a token that trades between
   * polls would otherwise show a stale price until the next cycle. A token
   * with no live message keeps its REST value rather than being blanked.
   */
  const toCard = (t: OverviewToken): TokenCardData => {
    const update = live.updates.get(t.mint);
    const priceUsd = update?.priceUsd ?? (t.priceUsd === null ? null : Number(t.priceUsd));
    const change = update?.priceChange24h ?? t.priceChange24h ?? undefined;

    return {
    name: t.name,
    symbol: t.symbol.startsWith('$') ? t.symbol : `$${t.symbol}`,
    mint: t.mint,
    logoURI: t.logoURI ?? undefined,
    price: priceUsd === null ? dash : money(priceUsd, priceUsd < 1 ? 6 : 2),
    priceChange24h: n(change),
    mcap: update?.marketCapUsd ?? (t.marketCapUsd === null ? dash : money(Number(t.marketCapUsd), 0)),
    liquidity: update?.liquidityUsd ?? (t.liquidityUsd === null ? dash : money(Number(t.liquidityUsd), 0)),
    volume24h: update?.volume24hUsd ?? (t.volume24hUsd === null ? dash : money(Number(t.volume24hUsd), 0)),
    // Passed through as null, never coerced to 0: the registry returns no
    // score, and `?? 0` made every Top Tokens card read a red "0/100" — the
    // worst possible rating — for tokens that were simply never scored.
    intelligenceScore: t.intelligenceScore,
    badges: [],
    sparklineData: undefined,
    // Drives the brief highlight on the card when a live update lands.
    liveUpdatedAt: update?.lastTradeUpdatedAt,
    lastTradeSide: update?.lastTradeSide,

    // Ownership audit, same source as the Discover columns.
    //
    // These were declared on `TokenCardData` but never populated, so the
    // Overview cards rendered no distribution data while Discover showed it for
    // the same tokens off the same endpoints. Passed through unchanged —
    // absent stays absent, so an unaudited token shows nothing rather than a
    // reassuring zero.
    top10HoldingsPct: update?.top10HoldingsPct ?? t.top10HoldingsPct,
    devHoldingsPct: update?.devHoldingsPct ?? t.devHoldingsPct,
    sniperPercentage: update?.sniperPercentage ?? t.sniperPercentage,
    insiderHoldingsPct: update?.insiderHoldingsPct ?? t.insiderHoldingsPct,
    bundlerPercentage: update?.bundlerPercentage ?? t.bundlerPercentage,
    holdersCount: update?.holdersCount ?? t.holdersCount,
    proTradersCount: update?.proTradersCount ?? t.proTradersCount,
    kolsCount: update?.kolsCount ?? t.kolsCount,
    devMints: update?.devMints ?? t.devMints,
    devMigrations: update?.devMigrations ?? t.devMigrations,
    devWalletAge: update?.devWalletAge,
    protocol: t.source,
    twitterHandle: t.twitterHandle,
    auditPending: update?.auditPending ?? t.auditPending,
    ownershipEvidence: update?.ownershipEvidence ?? t.ownershipEvidence,
    securityEvidence: update?.securityEvidence ?? t.securityEvidence,
    liquidityEvidence: update?.liquidityEvidence ?? t.liquidityEvidence,
    isMintRenounced: update?.isMintRenounced ?? t.isMintRenounced,
    isFreezeDisabled: update?.isFreezeDisabled ?? t.isFreezeDisabled,
    isLiquidityLocked: update?.isLiquidityLocked ?? t.isLiquidityLocked,
    rugRisk: update?.rugRisk ?? t.rugRisk,
    };
  };

  // Curated High-Cap & High-Volume Top Solana Ecosystem Tokens
  /**
   * Token lists come from the registry and the ranking engine.
   */
  const trendingCards = overview.trending.map(toCard);
  const hotCards = (overview.hotTokens || []).map(toCard);
  const topCards = overview.topTokens.map(toCard);
  const watchlistCards = [...overview.trending, ...(overview.hotTokens || []), ...overview.topTokens]
    .filter((t) => watchlistedMints.includes(t.mint))
    .map(toCard);

  const activeCards =
    marketTab === 'trending'
      ? trendingCards
      : marketTab === 'hot'
        ? hotCards
        : marketTab === 'top'
          ? topCards
          : watchlistCards;

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
    <div className="terminal-overview space-y-4 min-w-0">
      {/* Top Hero Banner */}
      <div data-page-header className="flex flex-wrap items-center justify-between gap-3 border-b border-sentinel-700 pb-4">
        <div className="relative z-10">
          <h1 className="text-xl font-bold text-slate-100">
            Market overview
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs sm:text-sm text-slate-300">
            Discover tokens, follow market activity, and monitor your portfolio.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative z-10">
          <Button onClick={() => { refreshOverview(); void overview.refresh(); }} variant="secondary" size="sm" isLoading={isLoading} leftIcon={<RefreshCcw className="h-3.5 w-3.5" />}>
            Refresh
          </Button>
          <Button onClick={() => setActiveView('trade')} variant="primary" size="sm" rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>
            Open terminal
          </Button>
        </div>
      </div>

      {/* 1. Market Overview Row (Sentiment, Volume, Stats) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sentiment Gauge Card */}
        <div className="rounded-xl border border-white/[0.08] bg-sentinel-900/80 backdrop-blur-xl p-3.5 shadow-card space-y-2 hover:border-emerald-500/35 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Market sentiment</span>
            <Gauge className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between font-numeric">
            <span className="text-xl sm:text-2xl font-bold text-slate-100">
              {overview.market ? String(overview.market.regime.confidenceScore) : dash}
              <span className="text-xs text-slate-400">/100</span>
            </span>
            <Badge variant={!overview.market ? 'neutral' : n(overview.market.regime.confidenceScore) >= 50 ? 'risk-low' : 'risk-high'}>
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
              : undefined
          }
          change={
            overview.market?.decomposition.organicVolumePct === undefined
              ? dash
              : `${pct(overview.market.decomposition.organicVolumePct, 1)} organic`
          }
          changeType={
            overview.market?.decomposition.organicVolumePct === undefined ? 'neutral' : n(overview.market.decomposition.organicVolumePct) >= 70 ? 'positive' : 'negative'
          }
          sparklineData={undefined}
          subtitle="Filtered wash-trading"
        />
        <MetricTile
          title="Active Threat Alerts"
          rawValue={
            overview.errors.alerts || isLoading
              ? dash
              : `${overview.criticalAlertCount} Flagged`
          }
          change={overview.errors.alerts || isLoading ? 'Unavailable' : overview.criticalAlertCount > 0 ? 'Critical' : 'Clear'}
          changeType={overview.errors.alerts || isLoading ? 'neutral' : overview.criticalAlertCount > 0 ? 'negative' : 'positive'}
          badgeText={!overview.errors.alerts && !isLoading && overview.criticalAlertCount > 0 ? 'THREAT DETECTED' : undefined}
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
              ? undefined
              : `Exit: ${money(overview.portfolio.exitValueUsd, 2)}`
          }
          change={
            overview.portfolio?.changeUsd == null
              ? dash
              : `${overview.portfolio.changeUsd >= 0 ? '+' : ''}${money(Math.abs(overview.portfolio.changeUsd), 2)}`
          }
          changeType={overview.portfolio?.changeUsd == null ? 'neutral' : overview.portfolio.changeUsd >= 0 ? 'positive' : 'negative'}
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
                <Compass className="h-4 w-4" /> Market tokens
                {/* States the actual delivery mode. "Live" only appears when a
                    socket is genuinely open — otherwise the panel says it is
                    polling, rather than implying a stream that isn't there. */}
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-mono font-semibold uppercase tracking-wide border',
                    live.status === 'live'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : live.status === 'connecting'
                        ? 'border-slate-600/40 bg-slate-500/10 text-slate-400'
                        : 'border-slate-700/50 bg-slate-800/40 text-slate-500',
                  )}
                  title={
                    live.status === 'live'
                      ? 'Streaming price and trade updates over WebSocket'
                      : live.status === 'connecting'
                        ? 'Connecting to the live stream'
                        : 'Live stream unavailable — showing periodically refreshed data'
                  }
                >
                  <span
                    className={clsx(
                      'h-1.5 w-1.5 rounded-full',
                      live.status === 'live'
                        ? 'bg-emerald-400 animate-pulse'
                        : live.status === 'connecting'
                          ? 'bg-slate-400'
                          : 'bg-slate-600',
                    )}
                  />
                  {live.status === 'live' ? 'Live' : live.status === 'connecting' ? 'Connecting' : 'Polled'}
                </span>
              </span>
            }
            headerActions={
              <Tabs
                activeTab={marketTab}
                onChange={(id) => setMarketTab(id as any)}
                variant="segmented"
                size="sm"
                tabs={[
                  { id: 'trending', label: 'Trending', count: trendingCards.length },
                  { id: 'hot', label: 'Hot', count: hotCards.length },
                  { id: 'top', label: 'Top Tokens', count: topCards.length },
                  { id: 'watchlist', label: 'Watchlist', count: watchlistCards.length },
                ]}
              />
            }
          >
            {isLoading ? (
              <div className="overview-token-grid">
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
              <div className="overview-token-grid max-h-[26rem] overflow-y-auto pr-1">
                {activeCards.length === 0 && (
                  <p className="col-span-full text-2xs text-slate-500 py-8 text-center">
                    {overview.errors.trending || overview.errors.hotTokens || overview.errors.topTokens
                      ? (overview.errors.trending ?? overview.errors.hotTokens ?? overview.errors.topTokens)
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
                <BarChart2 className="h-4 w-4 text-sky-400" /> Market activity
              </span>
            }
          >
            <div className="h-56 w-full bg-sentinel-950/90 rounded-xl border border-sentinel-800 p-3.5 terminal-grid-bg relative flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Pair: <strong className="text-white">SOL / USDC (Mainnet)</strong></span>
              </div>

              <div className="h-32 flex items-center justify-center text-xs text-slate-400">
                Activity chart unavailable
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
                <Sparkles className="h-4 w-4" /> Token rankings
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
                <PieChart className="h-4 w-4" /> Portfolio allocation
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
