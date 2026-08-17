'use client';

import React from 'react';
import type { OrganicActivityAssessment, InsiderDetectionReport } from '@/lib/activity/types';

interface CompactActivityIndicatorProps {
  organicAssessment?: OrganicActivityAssessment;
  insiderReport?: InsiderDetectionReport;
}

export function CompactActivityIndicator({
  organicAssessment,
  insiderReport,
}: CompactActivityIndicatorProps) {
  if (!organicAssessment && !insiderReport) return null;

  const organicScore = organicAssessment?.score ?? 75;
  const top5Share = organicAssessment?.features.participation.top5WalletShare ?? 0.2;
  const insiderCandidatesCount = insiderReport?.candidates.length ?? 0;

  const qualityColor =
    organicScore >= 75
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      : organicScore >= 50
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

  const concentrationLabel = top5Share >= 0.5 ? 'High' : top5Share >= 0.3 ? 'Moderate' : 'Low';
  const concentrationColor = top5Share >= 0.5 ? 'text-rose-400' : top5Share >= 0.3 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <span className="text-2xs text-slate-400 font-medium">Activity Quality:</span>
        <span className={`px-2 py-0.5 rounded font-mono font-bold border ${qualityColor}`}>
          {organicScore} <span className="text-2xs font-normal">/ 100</span>
        </span>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-800 pl-3">
        <span className="text-2xs text-slate-400">Concentration:</span>
        <span className={`font-mono font-semibold ${concentrationColor}`}>{concentrationLabel}</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 border-l border-slate-800 pl-3">
        <span className="text-2xs text-slate-400">Coordination Risk:</span>
        <span className={`font-mono font-semibold ${insiderCandidatesCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {insiderCandidatesCount > 0 ? `${insiderCandidatesCount} Candidate(s)` : 'Low'}
        </span>
      </div>
    </div>
  );
}
