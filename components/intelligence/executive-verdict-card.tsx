'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, ArrowUpRight, Zap, Info, TrendingUp, AlertOctagon } from 'lucide-react';
import type { IntelligenceVerdict } from '@/lib/intelligence/live-model';

interface ExecutiveVerdictCardProps {
  verdict: IntelligenceVerdict;
  symbol: string;
  tokenMint: string;
  onQuickBuy?: (solAmount: number) => void;
  onOpenTrade?: () => void;
}

export function ExecutiveVerdictCard({
  verdict,
  symbol,
  tokenMint,
  onQuickBuy,
  onOpenTrade,
}: ExecutiveVerdictCardProps) {
  const { integrityScore, status, headline, aiSummary, greenFlags, redFlags, recommendedMaxOrderUsd } = verdict;

  const score = integrityScore ?? 50;

  // Visual theming based on verdict status
  const theme = React.useMemo(() => {
    switch (status) {
      case 'GREENLIGHT':
        return {
          border: 'border-emerald-500/40',
          bg: 'bg-gradient-to-br from-emerald-950/40 via-sentinel-900 to-sentinel-950',
          gaugeColor: '#10b981',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          icon: ShieldCheck,
          label: 'GREENLIGHT · VERIFIED INTEGRITY',
          pulse: 'bg-emerald-400',
        };
      case 'CAUTION':
        return {
          border: 'border-amber-500/40',
          bg: 'bg-gradient-to-br from-amber-950/30 via-sentinel-900 to-sentinel-950',
          gaugeColor: '#f59e0b',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icon: ShieldAlert,
          label: 'CAUTION · MODERATE EXPOSURE',
          pulse: 'bg-amber-400',
        };
      case 'HIGH_RISK':
        return {
          border: 'border-orange-500/40',
          bg: 'bg-gradient-to-br from-orange-950/30 via-sentinel-900 to-sentinel-950',
          gaugeColor: '#f97316',
          badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          icon: AlertTriangle,
          label: 'HIGH RISK · ELEVATED CONCERN',
          pulse: 'bg-orange-400',
        };
      case 'CRITICAL_DANGER':
      default:
        return {
          border: 'border-rose-500/50',
          bg: 'bg-gradient-to-br from-rose-950/40 via-sentinel-900 to-sentinel-950',
          gaugeColor: '#f43f5e',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          icon: AlertOctagon,
          label: 'CRITICAL DANGER · HIGH RUG PROBABILITY',
          pulse: 'bg-rose-500',
        };
    }
  }, [status]);

  const StatusIcon = theme.icon;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${theme.border} ${theme.bg} p-5 sm:p-6 shadow-2xl backdrop-blur-xl transition-all`}>
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full opacity-15 blur-3xl"
        style={{ backgroundColor: theme.gaugeColor }}
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: Gauge & Headline */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center lg:max-w-xl">
          {/* Animated Circular Gauge */}
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-sentinel-800/80"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3.5"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                stroke={theme.gaugeColor}
                fill="none"
                className="transition-all duration-1000 ease-out"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="font-mono text-2xl font-black text-white">{score}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400">/ 100</span>
            </div>
          </div>

          {/* Verdict Text & Badge */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold tracking-wide ${theme.badgeBg}`}>
                <span className={`h-2 w-2 rounded-full ${theme.pulse} animate-pulse`} />
                <StatusIcon className="h-3.5 w-3.5" />
                {theme.label}
              </span>
              <span className="font-mono text-[11px] text-slate-400">AI Sentinel Verdict</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight sm:text-xl">{headline}</h2>
            <p className="text-xs leading-relaxed text-slate-300 max-w-xl">{aiSummary}</p>
          </div>
        </div>

        {/* Right: Quick Sizing & 1-Click Action Bar */}
        <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-4 lg:w-72">
          <div className="flex items-center justify-between border-b border-sentinel-800/80 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Execution Guidance</span>
            {recommendedMaxOrderUsd ? (
              <span className="font-mono text-xs font-bold text-emerald-400">Max ~${recommendedMaxOrderUsd.toLocaleString()}</span>
            ) : (
              <span className="font-mono text-xs text-slate-400">Dynamic</span>
            )}
          </div>

          <div className="text-2xs text-slate-400">
            {recommendedMaxOrderUsd ? (
              <p>Recommended single order limit to keep price impact below <span className="font-bold text-slate-200">2.5%</span> on active pool reserves.</p>
            ) : (
              <p>Review pool liquidity before placing market orders to prevent high slippage.</p>
            )}
          </div>

          {/* Quick Buy Presets */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-emerald-400" /> Fast Snipe / Buy</span>
              <span className="font-mono text-2xs text-slate-400">SOL</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.1, 0.5, 1.0, 2.0].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => onQuickBuy?.(amt)}
                  className="rounded-lg border border-sentinel-700 bg-sentinel-900 py-1.5 font-mono text-xs font-bold text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {onOpenTrade && (
            <button
              type="button"
              onClick={onOpenTrade}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition-colors"
            >
              <span>Open Pro Terminal</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Flags Grid: Side-by-Side Green Flags vs Red Flags */}
      <div className="mt-5 grid gap-4 border-t border-sentinel-800/80 pt-5 md:grid-cols-2">
        {/* Green Flags */}
        <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Green Flags ({greenFlags.length})</span>
          </div>
          {greenFlags.length > 0 ? (
            <ul className="space-y-1.5">
              {greenFlags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="leading-snug">{flag}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">No significant positive signals recorded.</p>
          )}
        </div>

        {/* Red Flags */}
        <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-950/20 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
            <XCircle className="h-4 w-4 text-rose-400" />
            <span>Risks & Attention Triggers ({redFlags.length})</span>
          </div>
          {redFlags.length > 0 ? (
            <ul className="space-y-1.5">
              {redFlags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                  <span className="leading-snug">{flag}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">No critical attention triggers detected by current evidence.</p>
          )}
        </div>
      </div>
    </div>
  );
}
