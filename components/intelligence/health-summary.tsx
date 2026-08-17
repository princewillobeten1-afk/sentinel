'use client';

import React from 'react';
import type { TokenIntelligenceReport, RiskCategory } from '@/lib/intelligence/types';
import { riskLevelColor } from '@/lib/intelligence/score-aggregator';

interface HealthSummaryProps {
  report: TokenIntelligenceReport;
  compact?: boolean;
}

const CATEGORIES: { cat: RiskCategory; label: string }[] = [
  { cat: 'MARKET', label: 'Market' },
  { cat: 'LIQUIDITY', label: 'Liquidity' },
  { cat: 'OWNERSHIP', label: 'Ownership' },
  { cat: 'CREATOR', label: 'Creator' },
  { cat: 'ACTIVITY', label: 'Activity' },
  { cat: 'CONTRACT', label: 'Contract' },
  { cat: 'EXIT', label: 'Exitability' },
];

export function HealthSummary({ report, compact = false }: HealthSummaryProps) {
  const { overallScore, confidence, riskDimensions, riskLevel } = report;
  const levelColor = riskLevelColor(riskLevel);

  return (
    <div className={`bg-sentinel-900 border border-sentinel-700/60 rounded-xl shadow-card font-mono text-xs ${compact ? 'p-4' : 'p-5'}`}>
      {/* Title */}
      <div className="flex items-center justify-between border-b border-sentinel-800 pb-3 mb-3">
        <span className="font-bold tracking-wider text-slate-300 uppercase text-2xs">
          Token Intelligence Summary
        </span>
        <span className="text-2xs text-slate-400 font-sans">
          Confidence: <span className="text-sky-400 font-bold font-mono">{confidence.score}%</span>
        </span>
      </div>

      {/* Overall Score */}
      <div className="flex items-center justify-between py-2 border-b border-sentinel-800/60 font-sans">
        <span className="text-slate-400 font-medium">Overall Score</span>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-base font-bold" style={{ color: levelColor }}>
            {overallScore}
          </span>
          <span className="text-slate-400">/ 100</span>
        </div>
      </div>

      {/* Dimension Matrix */}
      <div className="space-y-2 mt-3 font-sans">
        {CATEGORIES.map(({ cat, label }) => {
          const dim = riskDimensions[cat];
          const level = dim?.level || 'UNKNOWN';
          const statusColor = getStatusColor(level);

          return (
            <div key={cat} className="flex items-center justify-between py-1 text-xs">
              <span className="text-slate-400 font-medium">{label}</span>
              <span className="font-semibold text-right" style={{ color: statusColor }}>
                {level}
              </span>
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
