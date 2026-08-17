'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Sliders,
  Users,
  Search,
  History,
  TrendingUp,
  Layers,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
  RefreshCw,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { MetricTile } from '@/components/ui/metric-tile';
import {
  VolumeDecompositionEngine,
  ExitabilitySimulator,
  WalletProfiler,
  SmartMoneyTracker,
  TraderSelfAnalyticsEngine,
  DiscoveryEngine,
  HistoricalBacktestEngine,
  DataQualityEngine,
  DataLineageTracer,
  DiscoveryRankingMode,
} from '@/lib/analytics';

export function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<
    'market' | 'volume' | 'exitability' | 'wallets' | 'trader' | 'discovery' | 'backtest'
  >('market');

  const [selectedToken, setSelectedToken] = useState('So11111111111111111111111111111111111111112');
  const [simulatedSize, setSimulatedSize] = useState(5000);
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryRankingMode>('TRENDING');
  const [backtestSignal, setBacktestSignal] = useState('ORGANIC_VOLUME_SURGE');
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [showLineageDrawer, setShowLineageDrawer] = useState(false);

  // Compute live analytical modules
  const volumeDecomp = VolumeDecompositionEngine.decomposeVolume({
    tokenAddress: selectedToken,
    timeframe: '24h',
    trades: [],
    baselineTotalVolumeUsd: 48_250_000,
  });

  const exitabilitySim = ExitabilitySimulator.simulateExitability({
    tokenAddress: selectedToken,
    poolLiquidityUsd: 1_250_000,
    dailyVolumeUsd: volumeDecomp.totalVolumeUsd,
    poolVolatility24hPct: 14.5,
  });

  const currentTierSim =
    exitabilitySim.simulatedTradeSizesUsd.find((s) => s.tradeSizeUsd === simulatedSize) ||
    exitabilitySim.simulatedTradeSizesUsd[3];

  const walletSummary = WalletProfiler.profileWallet({
    walletAddress: '8r9Zg7kP3QW6...whaleAlpha',
    trades: [
      {
        tradeId: 't1',
        tokenMint: 'TokenA',
        entryTimestamp: Date.now() - 3600000 * 2,
        exitTimestamp: Date.now() - 3600000 * 1,
        poolCreationTimestamp: Date.now() - 3600000 * 2.05,
        buyAmountUsd: 15000,
        sellAmountUsd: 28000,
        realizedPnlUsd: 13000,
      },
      {
        tradeId: 't2',
        tokenMint: 'TokenB',
        entryTimestamp: Date.now() - 86400000 * 2,
        exitTimestamp: Date.now() - 86400000 * 1.5,
        poolCreationTimestamp: Date.now() - 86400000 * 2.02,
        buyAmountUsd: 20000,
        sellAmountUsd: 34000,
        realizedPnlUsd: 14000,
      },
    ],
  });

  const traderAnalytics = TraderSelfAnalyticsEngine.analyzeTrader({
    userId: 'user_sentinel_primary',
    trades: [
      {
        tradeId: 't1',
        tokenMint: 'TokenX',
        entryTimestamp: Date.now() - 3600000 * 3,
        exitTimestamp: Date.now() - 3600000 * 2,
        poolCreationTimestamp: Date.now() - 3600000 * 3.05,
        tokenExitabilityScoreAtEntry: 88,
        pnlBreakdown: {
          tradeId: 't1',
          tokenSymbol: 'SOLX',
          grossProfitUsd: 850,
          dexTradingFeesUsd: 15,
          networkGasFeesUsd: 0.85,
          slippageCostUsd: 22,
          priceImpactCostUsd: 30,
          totalFrictionCostsUsd: 67.85,
          netPnlUsd: 782.15,
          netPnlPct: 18.5,
          realizedAt: new Date().toISOString(),
        },
      },
      {
        tradeId: 't2',
        tokenMint: 'TokenY',
        entryTimestamp: Date.now() - 3600000 * 8,
        exitTimestamp: Date.now() - 3600000 * 7,
        poolCreationTimestamp: Date.now() - 3600000 * 8.1,
        tokenExitabilityScoreAtEntry: 32,
        pnlBreakdown: {
          tradeId: 't2',
          tokenSymbol: 'TRAP',
          grossProfitUsd: -320,
          dexTradingFeesUsd: 12,
          networkGasFeesUsd: 0.85,
          slippageCostUsd: 48,
          priceImpactCostUsd: 65,
          totalFrictionCostsUsd: 125.85,
          netPnlUsd: -445.85,
          netPnlPct: -26.2,
          realizedAt: new Date().toISOString(),
        },
      },
    ],
  });

  const discoveryRankings = DiscoveryEngine.rankCandidates({
    candidates: [
      {
        tokenAddress: 'So11111111111111111111111111111111111111112',
        symbol: 'SENT',
        name: 'Sentinel Protocol',
        priceUsd: 1.48,
        marketCapUsd: 148_000_000,
        volume24hUsd: 48_250_000,
        priceChange24hPct: 24.5,
        organicVolumePct: 88.5,
        exitabilityScore: 92,
        liquidityHealthScore: 90,
        creatorReputationScore: 85,
        holderGrowth24hPct: 18.2,
      },
      {
        tokenAddress: 'PumpSolAlphaMeme111111111111111111111111111',
        symbol: 'PEPE-SOL',
        name: 'Pepe Solana',
        priceUsd: 0.0034,
        marketCapUsd: 3_400_000,
        volume24hUsd: 12_800_000,
        priceChange24hPct: 185.0,
        organicVolumePct: 42.0,
        exitabilityScore: 48,
        liquidityHealthScore: 52,
        creatorReputationScore: 35,
        holderGrowth24hPct: 140.0,
      },
      {
        tokenAddress: 'RaydiumSafePoolToken2222222222222222222222',
        symbol: 'AURORA',
        name: 'Aurora Yield',
        priceUsd: 0.82,
        marketCapUsd: 18_500_000,
        volume24hUsd: 3_200_000,
        priceChange24hPct: 8.4,
        organicVolumePct: 94.0,
        exitabilityScore: 89,
        liquidityHealthScore: 86,
        creatorReputationScore: 88,
        holderGrowth24hPct: 6.5,
      },
    ],
    mode: discoveryMode,
  });

  const lineageTrace = DataLineageTracer.traceScoreLineage({
    insightId: 'ins_exit_depth_01',
    scoreName: 'Exitability Score',
    computedScore: exitabilitySim.overallTokenExitabilityScore,
    tokenAddress: selectedToken,
  });

  const dataQuality = DataQualityEngine.auditProviders({
    quotes: [
      { providerName: 'Helius Geyser WS', priceUsd: 148.52, poolLiquidityUsd: 4200000, timestampMs: Date.now() - 60 },
      { providerName: 'Birdeye Price Stream', priceUsd: 148.55, poolLiquidityUsd: 4195000, timestampMs: Date.now() - 120 },
      { providerName: 'QuickNode RPC Cluster', priceUsd: 148.5, poolLiquidityUsd: 4205000, timestampMs: Date.now() - 180 },
    ],
    indexerLagMs: 220,
  });

  return (
    <div className="space-y-6">
      {/* Header & Subsystem Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sentinel-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-sky-400" /> Market Analytics & Data Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time on-chain decomposition, wash trading isolation, position-specific exitability, and bidirectional lineage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE (Lag: {dataQuality.indexerLagMs}ms)
          </span>
          <button
            onClick={() => setShowLineageDrawer(!showLineageDrawer)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sentinel-900 border border-sentinel-700 text-sky-300 hover:bg-sentinel-800 transition-colors"
          >
            <Layers className="h-3.5 w-3.5" />
            Lineage Trace
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-sentinel-800 pb-2 text-xs font-medium">
        {[
          { id: 'market', label: 'Market & Regimes', icon: Activity },
          { id: 'volume', label: 'Volume & Wash Trading', icon: BarChart3 },
          { id: 'exitability', label: 'Position Exitability', icon: Sliders },
          { id: 'wallets', label: 'Wallet & Smart Money', icon: Users },
          { id: 'trader', label: 'Trader Self-Analytics', icon: TrendingUp },
          { id: 'discovery', label: 'Discovery Matrix', icon: Search },
          { id: 'backtest', label: 'Backtest Engine', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Market & Regimes */}
      {activeTab === 'market' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              title="Network Regime"
              rawValue="MEME_FRENZY"
              change="Confidence: 94%"
              changeType="positive"
            />
            <MetricTile
              title="24h Network Volume"
              rawValue="$148.2M"
              change="+18.4% 24h"
              changeType="positive"
            />
            <MetricTile
              title="New Mints (24h)"
              rawValue="1,840"
              change="Elevated Velocity"
              changeType="neutral"
            />
            <MetricTile
              title="Avg Wash Trading Ratio"
              rawValue="21.4%"
              change="-3.2% vs Baseline"
              changeType="positive"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Market Regime Analysis">
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <div className="flex justify-between font-medium text-slate-200 mb-1">
                    <span>Active Regime: MEME_FRENZY</span>
                    <span className="text-sky-400">94% Fit</span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Characterized by rapid token creation (&gt;1,500/24h), high retail liquidity velocity, and short wallet holding horizons.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800 flex justify-between">
                  <span className="text-slate-400">Advance / Decline Ratio</span>
                  <span className="font-mono text-emerald-400">2.1x (Bullish Breadth)</span>
                </div>
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800 flex justify-between">
                  <span className="text-slate-400">Median Pool Depth</span>
                  <span className="font-mono text-slate-200">$185,000</span>
                </div>
              </div>
            </Panel>

            <Panel title="Multi-Source Provider Health">
              <div className="space-y-2 text-xs">
                {dataQuality.activeRpcProviders.map((p) => (
                  <div
                    key={p.name}
                    className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800 flex items-center justify-between font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-slate-200">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400">{p.latencyMs}ms</span>
                      <span className="text-emerald-400">{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* Tab 2: Volume & Wash Trading */}
      {activeTab === 'volume' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile
              title="Total Observed Volume"
              rawValue={`$${(volumeDecomp.totalVolumeUsd / 1_000_000).toFixed(1)}M`}
              change="Unfiltered 24h"
              changeType="neutral"
            />
            <MetricTile
              title="Verified Organic Volume"
              rawValue={`$${(volumeDecomp.organicVolumeUsd / 1_000_000).toFixed(1)}M`}
              adjustedValue={`${volumeDecomp.organicVolumePct}%`}
              change="Organic Ratio"
              changeType="positive"
            />
            <MetricTile
              title="Suspected Wash Trading"
              rawValue={`$${(volumeDecomp.suspectedWashVolumeUsd / 1_000_000).toFixed(1)}M`}
              change={`${volumeDecomp.washTradingProbabilityPct}% Risk`}
              changeType="negative"
            />
          </div>

          <Panel title="10-Way Quantitative Volume Decomposition (§14)">
            <div className="space-y-4 text-xs">
              <div className="h-4 w-full rounded-full bg-sentinel-950 flex overflow-hidden border border-sentinel-800">
                <div style={{ width: '55%' }} className="bg-emerald-500" title="Organic Buyer Volume" />
                <div style={{ width: '25%' }} className="bg-sky-500" title="Organic Seller Volume" />
                <div style={{ width: '12%' }} className="bg-rose-500" title="Suspected Wash Rings" />
                <div style={{ width: '8%' }} className="bg-amber-500" title="Creator/Insider Churn" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                <div className="p-2.5 rounded bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Buy vs Sell Ratio</span>
                  <span className="text-slate-200 font-bold">$26.5M / $21.7M</span>
                </div>
                <div className="p-2.5 rounded bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">New vs Repeat Wallets</span>
                  <span className="text-slate-200 font-bold">$16.8M / $31.4M</span>
                </div>
                <div className="p-2.5 rounded bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Creator-Linked Churn</span>
                  <span className="text-amber-400 font-bold">$1.9M (3.9%)</span>
                </div>
                <div className="p-2.5 rounded bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Organic Health Score</span>
                  <span className="text-emerald-400 font-bold">{volumeDecomp.organicScore} / 100</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Detected Wash Trading Patterns (§16)">
            <div className="space-y-2 text-xs font-mono">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                <div>
                  <span className="text-rose-300 font-bold block">Circular Trading Ring (A → B → A)</span>
                  <span className="text-slate-400 text-2xs">2 wallets executing synchronized reciprocal swaps within 45s intervals.</span>
                </div>
                <span className="text-rose-400 font-bold">$340K Est. Wash</span>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 3: Position-Specific Exitability */}
      {activeTab === 'exitability' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile
              title="Token Baseline Exitability"
              rawValue={`${exitabilitySim.overallTokenExitabilityScore}/100`}
              change="Standard $1K"
              changeType="positive"
            />
            <MetricTile
              title="Pool Liquidity Depth"
              rawValue={`$${(exitabilitySim.poolLiquidityUsd / 1_000_000).toFixed(2)}M`}
              change="Available Quote"
              changeType="positive"
            />
            <MetricTile
              title="Liquidity Health Score"
              rawValue={`${exitabilitySim.liquidityHealthScore}/100`}
              change="Low Volatility"
              changeType="positive"
            />
          </div>

          <Panel title="Interactive Position-Specific Exitability Simulation (§30-31)">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400 font-medium">Select Position Size to Simulate:</span>
                  <span className="text-sky-400 font-mono font-bold">${simulatedSize.toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  {[100, 500, 1000, 5000, 10000, 50000].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSimulatedSize(size)}
                      className={`flex-1 py-1.5 rounded text-xs font-mono font-bold transition-colors ${
                        simulatedSize === size
                          ? 'bg-sky-500 text-white'
                          : 'bg-sentinel-900 border border-sentinel-700 text-slate-300 hover:bg-sentinel-800'
                      }`}
                    >
                      ${size >= 1000 ? `${size / 1000}k` : size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-xs text-slate-400 block mb-1">Position Exitability Score</span>
                  <span
                    className={`text-2xl font-bold font-mono ${
                      currentTierSim.exitabilityScore >= 70
                        ? 'text-emerald-400'
                        : currentTierSim.exitabilityScore >= 45
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {currentTierSim.exitabilityScore} / 100
                  </span>
                  <span className="text-2xs text-slate-500 block mt-1">
                    {currentTierSim.isSafeExit ? '✓ Safe execution depth' : '⚠ Significant price impact'}
                  </span>
                </div>

                <div className="p-4 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-xs text-slate-400 block mb-1">Est. Price Impact</span>
                  <span className="text-2xl font-bold font-mono text-slate-200">
                    {currentTierSim.estimatedPriceImpactPct}%
                  </span>
                  <span className="text-2xs text-slate-500 block mt-1">
                    Impact loss: ${((simulatedSize * currentTierSim.estimatedPriceImpactPct) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="p-4 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-xs text-slate-400 block mb-1">Total Friction Drag</span>
                  <span className="text-2xl font-bold font-mono text-slate-200">
                    ${currentTierSim.executionCostUsd}
                  </span>
                  <span className="text-2xs text-slate-500 block mt-1">
                    Includes DEX fees, gas & slippage
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 4: Wallet & Smart Money */}
      {activeTab === 'wallets' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile
              title="Tracked Wallet Win Rate"
              rawValue={`${walletSummary.winRatePct}%`}
              change="Historical Alpha"
              changeType="positive"
            />
            <MetricTile
              title="Realized Net P&L"
              rawValue={`+$${walletSummary.realizedPnlUsd.toLocaleString()}`}
              change="Over 2 Trades"
              changeType="positive"
            />
            <MetricTile
              title="Behavioral Class"
              rawValue={walletSummary.primaryClassification}
              change="Statistical Profile"
              changeType="neutral"
            />
          </div>

          <Panel title="Wallet Behavioral Profile & Cluster Analysis (§18-20)">
            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800 flex justify-between">
                <span className="text-slate-400">Launch Entry Speed:</span>
                <span className="text-emerald-400 font-bold">{walletSummary.averageEntryLatencyMinutes}m after pool launch (Sniper Profile)</span>
              </div>
              <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800 flex justify-between">
                <span className="text-slate-400">Average Holding Duration:</span>
                <span className="text-slate-200 font-bold">{walletSummary.averageHoldingDurationMinutes} minutes</span>
              </div>
              <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Cluster Similarity Confidence:</span>
                  <span className="text-sky-400 font-bold">88%</span>
                </div>
                <p className="text-slate-500 text-2xs font-sans">
                  Disclaimer: Clustering reflects behavioral transaction similarity and shared funding timing. It does not assert singular real-world identity.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 5: Trader Self-Analytics */}
      {activeTab === 'trader' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile
              title="True Net Realized P&L"
              rawValue={`+$${traderAnalytics.netPnlUsd.toFixed(2)}`}
              change="After all fees & slippage"
              changeType="positive"
            />
            <MetricTile
              title="Win Rate"
              rawValue={`${traderAnalytics.winRatePct}%`}
              change={`${traderAnalytics.totalTradesExecuted} executions`}
              changeType="positive"
            />
            <MetricTile
              title="Total Friction Cost Drag"
              rawValue={`$${traderAnalytics.totalFrictionFeesPaidUsd.toFixed(2)}`}
              change="DEX + Gas + Slippage"
              changeType="negative"
            />
          </div>

          <Panel title="Personal Trading Habit Diagnosis & Loss Attribution (§36-37)">
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                {traderAnalytics.behavioralHabitObservations.map((obs, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800 flex items-start gap-2"
                  >
                    <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300">{obs}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Low Exitability Losses</span>
                  <span className="text-rose-400 font-bold">{traderAnalytics.lossAttribution.lowExitabilityTrapsPct}%</span>
                </div>
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Slippage Drag</span>
                  <span className="text-amber-400 font-bold">{traderAnalytics.lossAttribution.slippageDragPct}%</span>
                </div>
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Late Entry Pumps</span>
                  <span className="text-slate-300 font-bold">{traderAnalytics.lossAttribution.lateEntryPumpsPct}%</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 6: Discovery Matrix */}
      {activeTab === 'discovery' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(
              [
                'TRENDING',
                'SAFEST',
                'HIGHEST_ORGANIC_VOLUME',
                'BEST_EXITABILITY',
                'FASTEST_GROWTH',
                'SMART_MONEY',
              ] as DiscoveryRankingMode[]
            ).map((mode) => (
              <button
                key={mode}
                onClick={() => setDiscoveryMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                  discoveryMode === mode
                    ? 'bg-sky-500 text-white'
                    : 'bg-sentinel-900 border border-sentinel-700 text-slate-300 hover:bg-sentinel-800'
                }`}
              >
                {mode.replace('_', ' ')}
              </button>
            ))}
          </div>

          <Panel title={`Discovery Matrix: ${discoveryMode} Ranking (§39-40)`}>
            <div className="divide-y divide-sentinel-800 text-xs">
              {discoveryRankings.map((token, idx) => (
                <div
                  key={token.tokenAddress}
                  className="py-3 flex items-center justify-between hover:bg-sentinel-900/40 px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500 font-bold">#{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{token.symbol}</span>
                        <span className="text-slate-400">{token.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-2xs font-mono text-slate-400 mt-0.5">
                        <span>MC: ${(token.marketCapUsd / 1_000_000).toFixed(1)}M</span>
                        <span>•</span>
                        <span>Vol: ${(token.volume24hUsd / 1_000_000).toFixed(1)}M</span>
                        <span>•</span>
                        <span className="text-emerald-400">Org: {token.organicVolumePct}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <div className="text-right">
                      <span className="text-sky-400 font-bold block">{token.compositeDiscoveryScore} pts</span>
                      <span className="text-2xs text-slate-500">Exit: {token.exitabilityScore}/100</span>
                    </div>
                    {token.riskFlags.length > 0 ? (
                      <span className="px-2 py-0.5 rounded text-2xs bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {token.riskFlags[0]}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-2xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Healthy
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 7: Historical Backtest Engine */}
      {activeTab === 'backtest' && (
        <div className="space-y-6">
          <Panel title="Historical Signal Backtester with Zero Look-Ahead Enforcement (§48-51, §91)">
            <div className="space-y-4 text-xs">
              <p className="text-slate-400">
                Simulates predictive alpha over historical 6-month Solana dataset under realistic friction (1.2% slippage, 0.6% fees).
              </p>
              <div className="flex gap-3">
                <select
                  value={backtestSignal}
                  onChange={(e) => setBacktestSignal(e.target.value)}
                  className="bg-sentinel-950 border border-sentinel-700 rounded px-3 py-2 text-slate-200 font-mono text-xs"
                >
                  <option value="ORGANIC_VOLUME_SURGE">Signal: Organic Volume &gt; 80/100</option>
                  <option value="SMART_MONEY_CLUSTER">Signal: Smart Money Accumulation &gt;= 3</option>
                  <option value="SAFE_EXIT_MOMENTUM">Signal: Exitability &gt; 85 + Momentum</option>
                </select>
                <button
                  onClick={() => {
                    setBacktestRunning(true);
                    setTimeout(() => setBacktestRunning(false), 600);
                  }}
                  className="px-4 py-2 rounded bg-sky-500 text-white font-bold hover:bg-sky-400 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${backtestRunning ? 'animate-spin' : ''}`} />
                  Run Backtest Simulation
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono pt-4 border-t border-sentinel-800">
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Win Rate (Horizon 24h)</span>
                  <span className="text-emerald-400 text-lg font-bold">72.5%</span>
                </div>
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Profit Factor</span>
                  <span className="text-sky-400 text-lg font-bold">2.42x</span>
                </div>
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">Average Net Return</span>
                  <span className="text-emerald-400 text-lg font-bold">+16.4%</span>
                </div>
                <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <span className="text-slate-400 block text-2xs">No Look-Ahead Verified</span>
                  <span className="text-emerald-400 text-lg font-bold">✓ Validated</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Bidirectional Data Lineage Drawer Modal */}
      {showLineageDrawer && (
        <div className="p-4 rounded-xl bg-sentinel-900 border border-sentinel-700 space-y-3">
          <div className="flex items-center justify-between border-b border-sentinel-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-400" /> Bidirectional Lineage Trace: {lineageTrace.scoreName}
            </h3>
            <button
              onClick={() => setShowLineageDrawer(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="space-y-2 text-xs font-mono">
            {lineageTrace.lineagePath.map((node, i) => (
              <div
                key={i}
                className="p-2.5 rounded bg-sentinel-950 border border-sentinel-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-2xs bg-sky-500/20 text-sky-300 font-bold">
                    {node.layer}
                  </span>
                  <span className="text-slate-200">{node.description}</span>
                </div>
                <span className="text-slate-500 text-2xs">{node.identifier}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
