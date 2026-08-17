'use client';

import React, { useState } from 'react';
import type { TokenIntelligenceReport, RiskCategory, RiskDimension } from '@/lib/intelligence/types';
import { ChevronDown, ChevronUp, Activity, Droplets, Users, UserCheck, Zap, FileCode, LogOut } from 'lucide-react';

interface RiskBreakdownProps {
  report: TokenIntelligenceReport;
}

const CATEGORY_META: Record<RiskCategory, { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  MARKET: { label: 'Market Health', icon: Activity, desc: 'Price stability, volume momentum, buy/sell ratios' },
  LIQUIDITY: { label: 'Liquidity Depth', icon: Droplets, desc: 'Pool depth, TVL changes, withdrawal patterns' },
  OWNERSHIP: { label: 'Ownership Structure', icon: Users, desc: 'Holder counts, top-holder concentration' },
  CREATOR: { label: 'Creator Footprint', icon: UserCheck, desc: 'Deployer address, launch history, metadata' },
  ACTIVITY: { label: 'Activity Quality', icon: Zap, desc: 'Wallet diversity, trade size variance, timing' },
  CONTRACT: { label: 'Contract Control', icon: FileCode, desc: 'Mint & freeze authorities, supply controls' },
  EXIT: { label: 'Exitability', icon: LogOut, desc: 'Price impact simulation across order sizes' },
};

export function RiskBreakdown({ report }: RiskBreakdownProps) {
  const [expandedCategory, setExpandedCategory] = useState<RiskCategory | null>(null);

  const categories: RiskCategory[] = ['MARKET', 'LIQUIDITY', 'OWNERSHIP', 'CREATOR', 'ACTIVITY', 'CONTRACT', 'EXIT'];

  const toggleCategory = (cat: RiskCategory) => {
    setExpandedCategory(expandedCategory === cat ? null : cat);
  };

  return (
    <div className="my-6">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span>Risk Dimensions</span>
        <span className="text-xs font-mono text-slate-400 font-normal">7 Modules Analyzed</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const dim = report.riskDimensions[cat];
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const isExpanded = expandedCategory === cat;

          const score = dim?.score ?? 50;
          const level = dim?.level ?? 'UNKNOWN';
          const confidence = dim?.confidence ?? 0;
          const signals = dim?.signals || [];
          const evidence = dim?.evidence || [];

          const statusColor = getStatusColor(level);

          return (
            <div
              key={cat}
              className={`bg-sentinel-900 border rounded-xl p-4 transition-all duration-200 shadow-card ${
                isExpanded ? 'border-sky-500/50 bg-sentinel-850' : 'border-sentinel-700/60 hover:border-sentinel-600'
              }`}
            >
              {/* Header */}
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => toggleCategory(cat)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sentinel-800 border border-sentinel-700 text-sky-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{meta.label}</h3>
                    <p className="text-2xs text-slate-400">{meta.desc}</p>
                  </div>
                </div>

                <button className="text-slate-400 hover:text-white p-1">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Score Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold" style={{ color: statusColor }}>
                    {level}
                  </span>
                  <span className="font-mono font-bold text-white">{score} / 100</span>
                </div>

                <div className="w-full bg-sentinel-950 h-2 rounded-full overflow-hidden border border-sentinel-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${score}%`, backgroundColor: statusColor }}
                  />
                </div>
              </div>

              {/* Confidence Footer */}
              <div className="mt-3 flex items-center justify-between text-2xs text-slate-400 border-t border-sentinel-800/60 pt-2">
                <span>Confidence: {Math.round(confidence * 100)}%</span>
                <span>{signals.length} signal(s)</span>
              </div>

              {/* Expanded Evidence Drawer */}
              {isExpanded && (
                <div className="mt-4 pt-3 border-t border-sentinel-700/60 text-xs space-y-3 animate-fadeIn">
                  {/* Evidence list */}
                  <div>
                    <div className="text-2xs uppercase font-semibold text-slate-400 mb-1.5">Observable Evidence</div>
                    {evidence.length > 0 ? (
                      <ul className="space-y-1.5">
                        {evidence.map((ev, i) => (
                          <li key={i} className="text-slate-300 bg-sentinel-950/80 p-2 rounded border border-sentinel-800 text-2xs">
                            • {ev.fact}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-slate-400 italic text-2xs">No specific evidence items recorded.</div>
                    )}
                  </div>

                  {/* Signals list */}
                  {signals.length > 0 && (
                    <div>
                      <div className="text-2xs uppercase font-semibold text-slate-400 mb-1.5">Signals Generated</div>
                      <div className="space-y-1">
                        {signals.map((sig) => (
                          <div key={sig.id} className="flex items-center justify-between bg-sentinel-950/60 p-1.5 px-2 rounded text-2xs">
                            <span className="font-mono text-slate-200">{sig.type}</span>
                            <span className={`px-1.5 py-0.2 rounded text-2xs font-semibold ${
                              sig.polarity === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                              sig.polarity === 'NEGATIVE' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {sig.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatusColor(level: string): string {
  switch (level) {
    case 'STRONG': return '#12B574';
    case 'MODERATE': return '#3B8FF0';
    case 'ELEVATED': return '#E5A23D';
    case 'UNKNOWN': default: return '#98A3B3';
  }
}
