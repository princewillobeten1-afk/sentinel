'use client';

import React, { useState } from 'react';
import type { TokenIntelligenceReport, RiskCategory, IntelligenceSignal } from '@/lib/intelligence/types';
import { Filter, Layers } from 'lucide-react';

interface EvidencePanelProps {
  report: TokenIntelligenceReport;
  selectedSignalId?: string | null;
}

export function EvidencePanel({ report, selectedSignalId }: EvidencePanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<RiskCategory | 'ALL'>('ALL');
  const [polarityFilter, setPolarityFilter] = useState<'ALL' | 'POSITIVE' | 'NEGATIVE'>('ALL');

  const categories: (RiskCategory | 'ALL')[] = ['ALL', 'MARKET', 'LIQUIDITY', 'OWNERSHIP', 'CREATOR', 'ACTIVITY', 'CONTRACT', 'EXIT'];

  const filteredSignals = report.signals.filter((s) => {
    if (categoryFilter !== 'ALL' && s.category !== categoryFilter) return false;
    if (polarityFilter !== 'ALL' && s.polarity !== polarityFilter) return false;
    return true;
  });

  return (
    <div className="bg-sentinel-900 border border-sentinel-700/60 rounded-xl p-5 shadow-card my-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-3 border-b border-sentinel-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <span>Detailed Evidence & Signals</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every conclusion is grounded in timestamped, observable data.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-400 bg-sentinel-950 p-1 px-2 rounded-lg border border-sentinel-800">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Cat:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as RiskCategory | 'ALL')}
              className="bg-transparent text-white focus:outline-none cursor-pointer font-medium"
            >
              {categories.map((c) => (
                <option key={c} value={c} className="bg-sentinel-900 text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400 bg-sentinel-950 p-1 px-2 rounded-lg border border-sentinel-800">
            <span>Polarity:</span>
            <select
              value={polarityFilter}
              onChange={(e) => setPolarityFilter(e.target.value as 'ALL' | 'POSITIVE' | 'NEGATIVE')}
              className="bg-transparent text-white focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL" className="bg-sentinel-900 text-white">All</option>
              <option value="POSITIVE" className="bg-sentinel-900 text-emerald-400">Positive</option>
              <option value="NEGATIVE" className="bg-sentinel-900 text-amber-400">Negative</option>
            </select>
          </div>
        </div>
      </div>

      {/* Signal List */}
      {filteredSignals.length > 0 ? (
        <div className="space-y-3">
          {filteredSignals.map((sig) => {
            const isHighlighted = selectedSignalId === sig.id;

            return (
              <div
                key={sig.id}
                id={sig.id}
                className={`bg-sentinel-950/80 border rounded-lg p-3.5 transition-all ${
                  isHighlighted ? 'border-sky-400 ring-1 ring-sky-400/40 bg-sky-950/20' : 'border-sentinel-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-xs text-white">{sig.type}</span>
                    <span className="text-2xs font-mono px-2 py-0.5 rounded bg-sentinel-800 text-sky-300 border border-sentinel-700">
                      {sig.category}
                    </span>
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                      sig.polarity === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      sig.polarity === 'NEGATIVE' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {sig.severity}
                    </span>
                  </div>

                  <div className="text-2xs text-slate-400 font-mono">
                    Observed: {new Date(sig.observedAt).toLocaleTimeString()}
                  </div>
                </div>

                {/* Evidence items */}
                <div className="space-y-1.5 mt-2">
                  {sig.evidence.map((ev, i) => (
                    <div key={i} className="text-xs text-slate-300 bg-sentinel-900/60 p-2 rounded border border-sentinel-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="text-sky-400 font-bold mr-1">•</span>
                        {ev.fact}
                      </div>
                      <div className="text-2xs text-slate-400 font-mono shrink-0">
                        Source: <span className="text-slate-300">{ev.source}</span> ({Math.round(ev.confidence * 100)}% conf)
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer metadata */}
                <div className="mt-2 pt-2 border-t border-sentinel-900 flex items-center justify-between text-2xs text-slate-400 font-mono">
                  <span>Methodology: {sig.methodologyVersion}</span>
                  <span>Confidence: {Math.round(sig.confidence * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-xs text-slate-400 italic">
          No signals match the selected filters.
        </div>
      )}
    </div>
  );
}
