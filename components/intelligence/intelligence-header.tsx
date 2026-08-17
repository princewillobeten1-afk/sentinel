'use client';

import React from 'react';
import type { TokenIntelligenceReport } from '@/lib/intelligence/types';
import { riskLevelLabel, riskLevelColor } from '@/lib/intelligence/score-aggregator';
import { freshnessLabel, freshnessColor } from '@/lib/intelligence/freshness';
import { ShieldCheck, ShieldAlert, Clock, Database, Layers } from 'lucide-react';

interface IntelligenceHeaderProps {
  report: TokenIntelligenceReport;
}

export function IntelligenceHeader({ report }: IntelligenceHeaderProps) {
  const { token, overallScore, riskLevel, confidence, dataFreshness, generatedAt, methodologyVersion } = report;
  const levelColor = riskLevelColor(riskLevel);

  return (
    <div className="bg-sentinel-900 border border-sentinel-700/60 rounded-xl p-6 shadow-card relative overflow-hidden">
      {/* Background Glow */}
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: levelColor }}
      />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
        {/* Token Metadata & Identity */}
        <div className="flex items-center gap-4">
          {token.logoUri ? (
            <img src={token.logoUri} alt={token.name} className="w-14 h-14 rounded-full border border-sentinel-600 bg-sentinel-800" />
          ) : (
            <div className="w-14 h-14 rounded-full border border-sentinel-600 bg-sentinel-800 flex items-center justify-center font-bold text-lg text-sky-400">
              {token.symbol.slice(0, 2)}
            </div>
          )}

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{token.name}</h1>
              <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded bg-sentinel-800 border border-sentinel-700 text-sky-300">
                {token.symbol}
              </span>
              <span className="text-xs text-slate-400 capitalize bg-sentinel-950/60 px-2 py-0.5 rounded border border-sentinel-800">
                {token.chain}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1 select-all hover:text-slate-200 transition-colors">
              {token.address}
            </p>
          </div>
        </div>

        {/* Intelligence Metric Badges */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Overall Score Gauge */}
          <div className="flex items-center gap-3 bg-sentinel-950/80 border border-sentinel-800 rounded-xl p-3 px-4">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-sentinel-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  strokeWidth="3.5"
                  strokeDasharray={`${overallScore}, 100`}
                  strokeLinecap="round"
                  stroke={levelColor}
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute font-mono font-bold text-sm text-white">{overallScore}</span>
            </div>
            <div>
              <div className="text-2xs uppercase font-semibold text-slate-400 tracking-wider">Intelligence Score</div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: levelColor }}>
                {riskLevelLabel(riskLevel)}
              </div>
            </div>
          </div>

          {/* Confidence Meter */}
          <div className="bg-sentinel-950/80 border border-sentinel-800 rounded-xl p-3 px-4 flex flex-col justify-between min-w-[130px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-2xs uppercase font-semibold text-slate-400 tracking-wider">Confidence</span>
              <span className="font-mono font-bold text-sky-400">{confidence.score}%</span>
            </div>
            <div className="w-full bg-sentinel-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-sky-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${confidence.score}%` }}
              />
            </div>
            <div className="text-2xs text-slate-400 mt-1 capitalize font-medium">{confidence.level} Confidence</div>
          </div>

          {/* Data Freshness */}
          <div className="bg-sentinel-950/80 border border-sentinel-800 rounded-xl p-3 px-4 flex flex-col justify-between min-w-[130px]">
            <div className="flex items-center gap-1.5 text-2xs uppercase font-semibold text-slate-400 tracking-wider">
              <Database className="w-3 h-3 text-slate-400" />
              <span>Data Freshness</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: freshnessColor(dataFreshness.overall) }}
              />
              <span className="text-xs font-semibold text-slate-200">
                {freshnessLabel(dataFreshness.overall)}
              </span>
            </div>
            <div className="text-2xs text-slate-400 mt-0.5 font-mono">
              {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Meta Footer Bar */}
      <div className="mt-4 pt-3 border-t border-sentinel-800/60 flex flex-wrap items-center justify-between text-2xs text-slate-400 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>Methodology: <code className="text-slate-300">{methodologyVersion}</code></span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Generated: {new Date(generatedAt).toLocaleString()}</span>
          </span>
        </div>
        {confidence.limitations.length > 0 && (
          <span className="text-amber-400/90 font-medium text-2xs">
            ⚠️ {confidence.limitations[0]}
          </span>
        )}
      </div>
    </div>
  );
}
