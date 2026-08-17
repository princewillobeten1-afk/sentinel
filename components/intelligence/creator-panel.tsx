'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Panel } from '@/components/ui/panel';
import type { CreatorEntity, ReputationLevel } from '@/lib/creator/types';
import { CreatorReputationCard } from './creator-reputation-card';
import { CreatorHistoryTable } from './creator-history-table';

interface CreatorPanelProps {
  creator: CreatorEntity;
}

const REPUTATION_LEVEL_COLORS: Record<ReputationLevel, string> = {
  STRONG: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAVORABLE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  MIXED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  ELEVATED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  HIGH_CONCERN: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  SEVERE: 'bg-red-500/10 text-red-400 border-red-500/20',
  UNKNOWN: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

export function CreatorPanel({ creator }: CreatorPanelProps) {
  const { reputation, behaviorProfile, launches, primaryAddress } = creator;

  const isUnknown = !primaryAddress || reputation.level === 'UNKNOWN';

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-semibold text-slate-100">Creator Reputation System</span>
          <span className="text-xs text-slate-400 font-mono ml-2">v1.0</span>
        </div>
      }
      subtitle="Creator launch history, wallet behavior, and multi-token patterns"
      headerActions={
        <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium border', REPUTATION_LEVEL_COLORS[reputation.level])}>
          {reputation.level.replace('_', ' ')}
        </span>
      }
    >
      <div className="space-y-6">
        {/* Creator Identification Header */}
        <div className="p-4 bg-sentinel-900/60 rounded-xl border border-sentinel-800 flex flex-wrap justify-between items-center gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-400 font-medium">Creator Primary Address</div>
            <div className="font-mono text-sm text-slate-100">
              {primaryAddress ? (
                <span>{primaryAddress.slice(0, 12)}...{primaryAddress.slice(-10)}</span>
              ) : (
                <span className="text-slate-400 italic">Creator address unknown</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400">Total Launches: </span>
              <span className="text-slate-100 font-semibold">{launches.length}</span>
            </div>
            <div>
              <span className="text-slate-400">Identification Conf: </span>
              <span className="text-emerald-400 font-semibold">{Math.round(creator.identificationConfidence * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Behavior Profile Highlights */}
        {!isUnknown && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-sentinel-900/40 rounded-xl border border-sentinel-800/80">
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Avg Token Retention</div>
              <div className="text-lg font-semibold font-mono text-slate-100">{behaviorProfile.avgRetentionPct.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Avg Days to First Sell</div>
              <div className="text-lg font-semibold font-mono text-amber-400">
                {behaviorProfile.avgDaysToFirstSell != null ? `${behaviorProfile.avgDaysToFirstSell.toFixed(1)}d` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Liquidity Removals</div>
              <div className={clsx('text-lg font-semibold font-mono', behaviorProfile.fullLiquidityRemovals > 0 ? 'text-red-400' : 'text-emerald-400')}>
                {behaviorProfile.fullLiquidityRemovals} / {launches.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Associated Wallets</div>
              <div className="text-lg font-semibold font-mono text-purple-400">{behaviorProfile.associatedWalletCount}</div>
            </div>
          </div>
        )}

        {/* Reputation Breakdown Card */}
        <CreatorReputationCard reputation={reputation} />

        {/* Launch History Table */}
        {launches.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 font-mono">Launch History ({launches.length} tokens)</div>
            <CreatorHistoryTable launches={launches} />
          </div>
        )}

        {/* Detected Cross-Token Patterns */}
        {reputation.patterns.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 font-mono">Detected Cross-Token Patterns</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reputation.patterns.map((pat, idx) => {
                const isNegative = pat.type.includes('REPEATED') || pat.type.includes('SELLING') || pat.type.includes('WITHDRAWAL');
                return (
                  <div key={idx} className={clsx(
                    'p-3 rounded-xl border text-xs space-y-1.5',
                    isNegative ? 'bg-red-500/5 border-red-500/20 text-red-300' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300',
                  )}>
                    <div className="font-semibold font-mono flex justify-between">
                      <span>{pat.type.replace(/_/g, ' ')}</span>
                      <span className="opacity-80">({pat.occurrenceCount}/{pat.totalLaunches} launches)</span>
                    </div>
                    {pat.evidence[0] && (
                      <div className="text-slate-300 text-2xs opacity-90">{pat.evidence[0].fact}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
