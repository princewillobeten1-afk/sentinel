'use client';

import React from 'react';
import type { TokenIntelligenceReport } from '@/lib/intelligence/types';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

interface IntelligenceSummaryProps {
  report: TokenIntelligenceReport;
  onSelectSignal?: (signalId: string) => void;
}

export function IntelligenceSummary({ report, onSelectSignal }: IntelligenceSummaryProps) {
  const { positives, warnings, missingData } = report;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
      {/* 1. Major Positives */}
      <div className="bg-sentinel-900 border border-emerald-500/20 rounded-xl p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-semibold text-emerald-300">Major Positives</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            {positives.length}
          </span>
        </div>

        {positives.length > 0 ? (
          <ul className="space-y-2.5">
            {positives.slice(0, 4).map((sig) => (
              <li
                key={sig.id}
                onClick={() => onSelectSignal?.(sig.id)}
                className="text-xs text-slate-300 bg-sentinel-950/60 border border-emerald-500/10 rounded-lg p-2.5 hover:border-emerald-500/30 transition-colors cursor-pointer"
              >
                <div className="font-medium text-emerald-200">{sig.evidence[0]?.fact || sig.type}</div>
                <div className="text-2xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>Confidence: {Math.round(sig.confidence * 100)}%</span>
                  <span className="font-mono text-emerald-400/80">{sig.category}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-slate-400 italic py-4 text-center">No major positive signals detected.</div>
        )}
      </div>

      {/* 2. Major Warnings */}
      <div className="bg-sentinel-900 border border-amber-500/20 rounded-xl p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="text-sm font-semibold text-amber-300">Major Warnings</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            {warnings.length}
          </span>
        </div>

        {warnings.length > 0 ? (
          <ul className="space-y-2.5">
            {warnings.slice(0, 4).map((sig) => (
              <li
                key={sig.id}
                onClick={() => onSelectSignal?.(sig.id)}
                className="text-xs text-slate-300 bg-sentinel-950/60 border border-amber-500/10 rounded-lg p-2.5 hover:border-amber-500/30 transition-colors cursor-pointer"
              >
                <div className="font-medium text-amber-200">{sig.evidence[0]?.fact || sig.type}</div>
                <div className="text-2xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>Severity: <span className="font-semibold text-amber-400">{sig.severity}</span></span>
                  <span className="font-mono text-amber-400/80">{sig.category}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-slate-400 italic py-4 text-center">No major warnings detected.</div>
        )}
      </div>

      {/* 3. Missing Information */}
      <div className="bg-sentinel-900 border border-slate-700/40 rounded-xl p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-300">Missing Information</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            {missingData.length}
          </span>
        </div>

        {missingData.length > 0 ? (
          <ul className="space-y-2.5">
            {missingData.slice(0, 4).map((item, idx) => (
              <li
                key={idx}
                className="text-xs text-slate-400 bg-sentinel-950/60 border border-sentinel-800 rounded-lg p-2.5"
              >
                <div className="font-medium text-slate-300">{item.description}</div>
                <div className="text-2xs text-slate-400 mt-1 flex items-center justify-between">
                  <span className="capitalize">{item.impact.replace('_', ' ').toLowerCase()}</span>
                  <span className="font-mono text-slate-400">{item.category}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-slate-400 italic py-4 text-center">All primary data points present.</div>
        )}
      </div>
    </div>
  );
}
