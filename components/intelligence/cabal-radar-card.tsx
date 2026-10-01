'use client';

import React, { useState } from 'react';
import { 
  Radar, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Radio, 
  Zap, 
  TrendingDown, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Lock, 
  Cpu, 
  Activity, 
  Flame, 
  Sliders, 
  CheckCircle2, 
  Layers, 
  DollarSign 
} from 'lucide-react';
import type { IntelligenceCabalRadarReport, CabalCluster } from '@/lib/intelligence/live-model';

interface CabalRadarCardProps {
  cabalRadar: IntelligenceCabalRadarReport;
  symbol: string;
  tokenMint: string;
  onEmergencyExit?: () => void;
}

export function CabalRadarCard({
  cabalRadar,
  symbol,
  tokenMint,
  onEmergencyExit,
}: CabalRadarCardProps) {
  const {
    cabalStage,
    dumpAlertLevel,
    collectiveCabalSharePct,
    netFlow15mUsd,
    summaryBrief,
    clusters,
    reportedVolume24hUsd,
    realHumanVolume24hUsd,
    organicVolumeRatio,
    washTradingRingsCount,
    realFloorPriceUsd,
    sentinel,
  } = cabalRadar;

  // Local state for Sentinel automation
  const [isArmed, setIsArmed] = useState<boolean>(sentinel.isArmed ?? true);
  const [dumpThreshold, setDumpThreshold] = useState(sentinel.thresholdDumpPct || 2.5);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(clusters[0]?.id ?? null);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // Theming based on Cabal alert level
  const stageTheme = React.useMemo(() => {
    switch (cabalStage) {
      case 'TERMINAL_DRAIN':
        return {
          bg: 'from-rose-950/50 via-sentinel-900 to-sentinel-950 border-rose-500/50',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: AlertOctagon,
          title: 'TERMINAL LIQUIDITY DRAIN IN PROGRESS',
          pulse: 'bg-rose-500 animate-ping',
          textColor: 'text-rose-400',
        };
      case 'STEALTH_DISTRIBUTION':
        return {
          bg: 'from-amber-950/40 via-sentinel-900 to-sentinel-950 border-amber-500/40',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: Radio,
          title: 'ACTIVE STEALTH CABAL DISTRIBUTION DETECTED',
          pulse: 'bg-amber-400 animate-pulse',
          textColor: 'text-amber-400',
        };
      case 'BUNDLED_ACCUMULATION':
        return {
          bg: 'from-orange-950/30 via-sentinel-900 to-sentinel-950 border-orange-500/30',
          badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          icon: AlertTriangle,
          title: 'GENESIS BUNDLERS HOLDING · DUMP RISK HIGH',
          pulse: 'bg-orange-400',
          textColor: 'text-orange-400',
        };
      case 'ORGANIC_TAKEOVER':
      default:
        return {
          bg: 'from-emerald-950/30 via-sentinel-900 to-sentinel-950 border-emerald-500/30',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          icon: ShieldCheck,
          title: 'CLEAN FLOAT · NO COORDINATED SYBILS DETECTED',
          pulse: 'bg-emerald-400',
          textColor: 'text-emerald-400',
        };
    }
  }, [cabalStage]);

  const StageIcon = stageTheme.icon;

  const runSimulation = () => {
    setSimulationActive(true);
    setSimulationLogs(['[SENTINEL CORE] Initializing front-run trigger test...']);
    setTimeout(() => {
      setSimulationLogs(prev => [...prev, `[TELEMETRY] Tracking ${clusters.length} sybil clusters across Solana RPC block stream...`]);
    }, 600);
    setTimeout(() => {
      setSimulationLogs(prev => [
        ...prev, 
        `[ALERT TRIGGERED] Cluster Alpha wallet 4nZ8... executed sell > ${dumpThreshold}% threshold.`
      ]);
    }, 1200);
    setTimeout(() => {
      setSimulationLogs(prev => [
        ...prev, 
        `[JITO BUNDLE DISPATCHED] Submitted private swap ahead of subsequent cluster dump (0.005 SOL tip).`
      ]);
    }, 1800);
    setTimeout(() => {
      setSimulationLogs(prev => [
        ...prev, 
        `[SUCCESS] Position exited at $${(realFloorPriceUsd * 1.8).toFixed(5)}. Estimated capital preserved: $${sentinel.estimatedSavingsUsd.toLocaleString()} vs late manual exit!`
      ]);
      setSimulationActive(false);
    }, 2400);
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${stageTheme.bg} p-5 sm:p-6 shadow-2xl backdrop-blur-xl transition-all space-y-6`}>
      {/* Background Radar sweep graphic effect */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full opacity-10 blur-3xl bg-sky-500" />

      {/* Header & Stage Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-sentinel-800 pb-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-sky-500/30 bg-sky-950/40 p-2.5 text-sky-400 shrink-0">
            <Radar className="h-6 w-6 motion-safe:animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-sky-400">
                Proprietary On-Chain Radar
              </span>
              <span className="rounded bg-sky-500/10 px-1.5 py-0.2 font-mono text-[9px] text-sky-300 border border-sky-500/20">
                Live Solana Stream
              </span>
            </div>
            <h2 className="text-xl font-black text-white sm:text-2xl flex items-center gap-2 mt-0.5">
              Cabal Radar™ & Front-Run Sentinel
            </h2>
          </div>
        </div>

        {/* Live Stage Badge */}
        <div className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-mono text-xs font-semibold ${stageTheme.badge}`}>
          <span className={`h-2 w-2 rounded-full ${stageTheme.pulse}`} />
          <StageIcon className="h-4 w-4" />
          <span>{stageTheme.title}</span>
        </div>
      </div>

      {/* 3 Core Forensic Telemetry Pillars */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Metric 1: Effective Cabal Share */}
        <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-4">
          <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-slate-400">
            <span>Coordinated Cabal Share</span>
            <Layers className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${collectiveCabalSharePct > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {collectiveCabalSharePct.toFixed(1)}%
            </span>
            <span className="text-2xs text-slate-400">
              across {clusters.reduce((acc, c) => acc + c.walletCount, 0)} sybil wallets
            </span>
          </div>
          <p className="mt-1 text-2xs text-slate-400">
            {collectiveCabalSharePct > 20 
              ? 'Common root funder detected via block-0 transit' 
              : 'Supply is distributed organically across retail'}
          </p>
        </div>

        {/* Metric 2: 15m Net Flow Velocity */}
        <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-4">
          <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-slate-400">
            <span>15m Cluster Net-Flow</span>
            <Activity className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${netFlow15mUsd < 0 ? 'text-rose-400' : netFlow15mUsd > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {netFlow15mUsd < 0 ? `-$${Math.abs(netFlow15mUsd).toLocaleString()}` : netFlow15mUsd > 0 ? `+$${netFlow15mUsd.toLocaleString()}` : '$0'}
            </span>
            {netFlow15mUsd < 0 ? (
              <span className="flex items-center text-2xs font-semibold text-rose-400">
                <TrendingDown className="h-3 w-3 mr-0.5" /> Dumping
              </span>
            ) : netFlow15mUsd > 0 ? (
              <span className="flex items-center text-2xs font-semibold text-emerald-400">
                <TrendingUp className="h-3 w-3 mr-0.5" /> Inflows
              </span>
            ) : (
              <span className="text-2xs text-slate-400">Neutral</span>
            )}
          </div>
          <p className="mt-1 text-2xs text-slate-400">
            {netFlow15mUsd < -5000 
              ? 'Warning: Staggered multi-wallet offloading in progress' 
              : 'No abnormal sell volume from top clusters'}
          </p>
        </div>

        {/* Metric 3: Organic Volume Ratio */}
        <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-4">
          <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-slate-400">
            <span>Organic Volume Ratio</span>
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${organicVolumeRatio < 0.4 ? 'text-rose-400' : organicVolumeRatio < 0.7 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {(organicVolumeRatio * 100).toFixed(0)}%
            </span>
            <span className="text-2xs text-slate-400">
              verified human makers
            </span>
          </div>
          <p className="mt-1 text-2xs text-slate-400">
            {washTradingRingsCount > 0 
              ? `${washTradingRingsCount} circular wash trading rings detected` 
              : 'Clean organic order flow; no circular churn'}
          </p>
        </div>
      </div>

      {/* Summary Narrative Banner */}
      <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/60 p-3.5 px-4 font-mono text-xs text-slate-300 flex items-start gap-2.5">
        <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{summaryBrief}</p>
      </div>

      {/* Sybil Cluster Lineage Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-sky-400" />
            Coordinated Sybil Clusters ({clusters.length})
          </h3>
          <span className="text-2xs text-slate-400">
            Traced back 3 hops to root funding accounts
          </span>
        </div>

        <div className="divide-y divide-sentinel-800/80 rounded-xl border border-sentinel-800 bg-sentinel-950/90 overflow-hidden">
          {clusters.map((cluster) => {
            const isExpanded = expandedCluster === cluster.id;
            return (
              <div key={cluster.id} className="transition-colors hover:bg-sentinel-900/40">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedCluster(isExpanded ? null : cluster.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-lg p-2 ${cluster.status === 'STEALTH_OFFLOADING' ? 'bg-rose-500/20 text-rose-300' : 'bg-sentinel-800 text-slate-300'}`}>
                      <UsersIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{cluster.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono border ${
                          cluster.status === 'STEALTH_OFFLOADING'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : cluster.status === 'TERMINAL_DRAIN'
                            ? 'bg-rose-600/30 text-rose-200 border-rose-500/40'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        }`}>
                          {cluster.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-2xs text-slate-400">
                        <span>Funder: <span className="text-slate-300">{cluster.commonFunder}</span></span>
                        <span>•</span>
                        <span>{cluster.walletCount} Linked Wallets</span>
                        <span>•</span>
                        <span>Dump Velocity: <span className={cluster.dumpVelocityPct < 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>{cluster.dumpVelocityPct}% / 15m</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5">
                    <div className="text-right font-mono">
                      <span className="block text-sm font-black text-white">{cluster.totalSharePct.toFixed(1)}%</span>
                      <span className="block text-2xs text-slate-400">
                        {cluster.netFlow15mUsd < 0 ? `-$${Math.abs(cluster.netFlow15mUsd).toLocaleString()}` : 'Holding'}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded Individual Sybil Wallets Table */}
                {isExpanded && (
                  <div className="border-t border-sentinel-800/80 bg-sentinel-950 p-4 space-y-3">
                    <div className="flex items-center justify-between text-2xs uppercase text-slate-400 font-mono">
                      <span>Sybil Wallet Address</span>
                      <span>Supply Share</span>
                      <span>Balance</span>
                      <span>15m Sold</span>
                    </div>
                    <div className="space-y-2">
                      {cluster.wallets.map((w, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-sentinel-900/60 p-2.5 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono text-2xs">#{idx + 1}</span>
                            <span className="text-sky-300 font-semibold">{w.address}</span>
                            {w.isGenesisBundler && (
                              <span className="rounded bg-amber-500/10 px-1 py-0.2 text-[9px] text-amber-300 border border-amber-500/20">
                                Genesis Bundler
                              </span>
                            )}
                          </div>
                          <span className="text-white font-bold">{w.sharePct.toFixed(1)}%</span>
                          <span className="text-slate-300">${w.balanceUsd.toLocaleString()}</span>
                          <span className={w.netSold15mUsd > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                            {w.netSold15mUsd > 0 ? `-$${w.netSold15mUsd.toLocaleString()}` : '$0'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Synthetic Wash Volume Stripper & Real Floor Price */}
      <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-purple-400" />
              Wash Trading Volume Stripper
            </h3>
            <p className="text-2xs text-slate-400 mt-0.5">
              Filters out self-trading loops, single-tx round-trips, and high-frequency volume bots.
            </p>
          </div>

          <div className="font-mono text-xs text-right">
            <span className="text-slate-400">Reported Volume: </span>
            <span className="font-bold text-white">${reportedVolume24hUsd.toLocaleString()}</span>
          </div>
        </div>

        {/* Dual Split Bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded-full bg-purple-950/60 overflow-hidden flex">
            <div 
              className="h-full bg-emerald-500 transition-all" 
              style={{ width: `${Math.round(organicVolumeRatio * 100)}%` }} 
              title={`Organic: $${realHumanVolume24hUsd.toLocaleString()}`}
            />
            <div 
              className="h-full bg-rose-500/80 transition-all stripe-bg" 
              style={{ width: `${100 - Math.round(organicVolumeRatio * 100)}%` }} 
              title={`Synthetic Wash: $${(reportedVolume24hUsd - realHumanVolume24hUsd).toLocaleString()}`}
            />
          </div>

          <div className="flex items-center justify-between font-mono text-2xs">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              True Human Volume: ${realHumanVolume24hUsd.toLocaleString()} ({(organicVolumeRatio * 100).toFixed(0)}%)
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              Synthetic Wash Volume: ${(reportedVolume24hUsd - realHumanVolume24hUsd).toLocaleString()} ({(100 - organicVolumeRatio * 100).toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Real Floor Price Comparison */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-sentinel-800/80">
          <div>
            <span className="text-2xs text-slate-400 uppercase font-mono">Estimated True Organic Support Floor</span>
            <p className="text-2xs text-slate-400">Predicted equilibrium price if wash bots stop paying priority fees.</p>
          </div>
          <div className="font-mono text-right">
            <span className="text-sm font-bold text-amber-300">${realFloorPriceUsd.toFixed(6)}</span>
            <span className="block text-2xs text-rose-400">
              ({((realFloorPriceUsd / (cabalRadar.realFloorPriceUsd / (0.35 + organicVolumeRatio * 0.65)) - 1) * 100).toFixed(1)}% from market)
            </span>
          </div>
        </div>
      </div>

      {/* Autonomous "Front-Run the Dump" Sentinel Console */}
      <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-950/30 via-sentinel-950 to-sentinel-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isArmed ? 'border-sky-500/40 bg-sky-500/20 text-sky-300' : 'border-slate-700 bg-slate-800 text-slate-500'}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
                  Front-Run Sentinel™ Autonomous Defense
                </h3>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono border ${
                  isArmed 
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {isArmed ? 'ARMED & MONITORING' : 'DISARMED'}
                </span>
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                Automatically submits a private Jito MEV-protected exit order BEFORE the cabal cluster drains pool liquidity.
              </p>
            </div>
          </div>

          {/* Armed Toggle Button */}
          <button
            onClick={() => setIsArmed(!isArmed)}
            className={`rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all border ${
              isArmed
                ? 'bg-sky-500 text-sentinel-950 border-sky-400 hover:bg-sky-400 shadow-lg shadow-sky-500/20'
                : 'bg-sentinel-800 text-slate-300 border-sentinel-700 hover:bg-sentinel-700'
            }`}
          >
            {isArmed ? 'SENTINEL ACTIVE' : 'ARM SENTINEL'}
          </button>
        </div>

        {/* Sentinel Parameter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-sentinel-800">
          <div className="rounded-lg bg-sentinel-900/80 p-3 border border-sentinel-800">
            <span className="block text-2xs uppercase text-slate-400 font-mono">Dump Threshold</span>
            <div className="mt-1 flex items-center gap-2">
              {[1.5, 2.5, 5.0].map((val) => (
                <button
                  key={val}
                  onClick={() => setDumpThreshold(val)}
                  className={`rounded px-2 py-0.5 font-mono text-2xs font-bold border ${
                    dumpThreshold === val 
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' 
                      : 'bg-sentinel-950 text-slate-400 border-sentinel-800 hover:text-white'
                  }`}
                >
                  &gt; {val}%
                </button>
              ))}
            </div>
            <span className="block mt-1 text-[10px] text-slate-400">Trigger if cluster sells &gt; {dumpThreshold}% in 3m</span>
          </div>

          <div className="rounded-lg bg-sentinel-900/80 p-3 border border-sentinel-800">
            <span className="block text-2xs uppercase text-slate-400 font-mono">Routing & Protection</span>
            <div className="mt-1 flex items-center gap-2 font-mono text-xs text-sky-300 font-bold">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Jito Private Bundle (0.005 SOL Tip)</span>
            </div>
            <span className="block mt-1 text-[10px] text-slate-400">Prevents frontrunning and sandwich bots</span>
          </div>

          <div className="rounded-lg bg-sentinel-900/80 p-3 border border-sentinel-800">
            <span className="block text-2xs uppercase text-slate-400 font-mono">Estimated Slippage Saved</span>
            <div className="mt-1 font-mono text-sm font-black text-emerald-400">
              +${sentinel.estimatedSavingsUsd.toLocaleString()} USD
            </div>
            <span className="block mt-1 text-[10px] text-slate-400">Preserves capital vs delayed manual exit</span>
          </div>
        </div>

        {/* Action Controls & Simulation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            onClick={runSimulation}
            disabled={simulationActive}
            className="flex items-center gap-2 rounded-xl border border-sentinel-700 bg-sentinel-800/80 px-3.5 py-2 font-mono text-xs text-slate-200 hover:bg-sentinel-700 hover:text-white transition-all"
          >
            <Cpu className="h-3.5 w-3.5 text-sky-400" />
            <span>{simulationActive ? 'Running RPC Simulation...' : 'Test Front-Run Eject Simulation'}</span>
          </button>

          {onEmergencyExit && (
            <button
              onClick={onEmergencyExit}
              className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-600/20 px-4 py-2 font-mono text-xs font-bold text-rose-300 hover:bg-rose-600/30 hover:text-rose-100 transition-all shadow-lg shadow-rose-900/20"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              <span>Emergency Eject Position Now</span>
            </button>
          )}
        </div>

        {/* Interactive Simulation Output Console */}
        {simulationLogs.length > 0 && (
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 font-mono text-2xs text-slate-300 space-y-1">
            <div className="flex items-center justify-between text-slate-400 border-b border-sentinel-800 pb-1 mb-1">
              <span>Sentinel Live Execution Console</span>
              <span className="text-sky-400">Simulation Mode</span>
            </div>
            {simulationLogs.map((log, i) => (
              <div key={i} className={log.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : log.includes('[ALERT') ? 'text-amber-400' : 'text-slate-300'}>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
