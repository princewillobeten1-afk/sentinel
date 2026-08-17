'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { CreatorReputation, ReputationLevel } from '@/lib/creator/types';

interface CreatorReputationCardProps {
  reputation: CreatorReputation;
}

const LEVEL_COLORS: Record<ReputationLevel, { text: string; bg: string; border: string }> = {
  STRONG: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  FAVORABLE: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  MIXED: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  ELEVATED: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  HIGH_CONCERN: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  SEVERE: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  UNKNOWN: { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
};

export function CreatorReputationCard({ reputation }: CreatorReputationCardProps) {
  const { score, level, confidenceLevel, dimensions, sampleSize, limitations } = reputation;

  const style = LEVEL_COLORS[level];

  return (
    <div className="p-4 bg-sentinel-900/60 rounded-xl border border-sentinel-800 space-y-4">
      {/* Header with Gauge */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-sentinel-800/80 pb-3">
        <div className="flex items-center gap-4">
          <div className={clsx('w-16 h-16 rounded-full flex items-center justify-center border-2 font-mono text-xl font-bold', style.bg, style.border, style.text)}>
            {score != null ? score : '?'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx('text-base font-semibold', style.text)}>
                {level.replace('_', ' ')} Reputation
              </span>
              <span className="text-xs font-mono text-slate-400">
                (Confidence: {confidenceLevel})
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Based on {sampleSize} launch{sampleSize === 1 ? '' : 'es'} analyzed
            </div>
          </div>
        </div>

        <div className="text-right text-xs font-mono text-slate-400">
          <div>Methodology: {reputation.methodologyVersion}</div>
        </div>
      </div>

      {/* Sample-size Warning Banner */}
      {sampleSize < 3 && (
        <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs text-amber-300 space-y-1">
          <div className="font-semibold text-amber-400">Limited Sample Size Alert</div>
          <div>Only {sampleSize} launch(es) available. At least 3 launches are required for a high-confidence numeric reputation score. Score displayed is preliminary.</div>
        </div>
      )}

      {/* 8 Dimensions Breakdown */}
      {dimensions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 font-mono">Reputation Dimensions Breakdown</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dimensions.map(dim => {
              const dimScoreColor = dim.score >= 75
                ? 'text-emerald-400'
                : dim.score >= 50
                ? 'text-amber-400'
                : 'text-red-400';

              return (
                <div key={dim.name} className="p-2.5 bg-sentinel-950/60 rounded-lg border border-sentinel-800 text-xs space-y-1">
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-slate-300">{dim.name.replace(/_/g, ' ')}</span>
                    <span className={clsx('font-bold', dimScoreColor)}>{dim.score}/100</span>
                  </div>
                  <div className="text-2xs text-slate-400">{dim.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Limitations */}
      {limitations.length > 0 && (
        <div className="text-2xs text-slate-400 space-y-0.5 pt-2 border-t border-sentinel-800/60">
          {limitations.map((lim, idx) => (
            <div key={idx}>• {lim}</div>
          ))}
        </div>
      )}
    </div>
  );
}
