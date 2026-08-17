'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { CreatorLaunchRecord, CreatorOutcomeType } from '@/lib/creator/types';

interface CreatorHistoryTableProps {
  launches: CreatorLaunchRecord[];
}

const OUTCOME_BADGES: Record<CreatorOutcomeType, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  INACTIVE: { label: 'Inactive', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  LIQUIDITY_WITHDRAWN: { label: 'Liquidity Withdrawn', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  SEVERE_ACTIVITY_DECLINE: { label: 'Severe Decline', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  UNKNOWN: { label: 'Unknown', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

export function CreatorHistoryTable({ launches }: CreatorHistoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-sentinel-800 bg-sentinel-900/40">
      <table className="w-full text-left text-xs">
        <thead className="bg-sentinel-900/80 text-slate-400 font-mono border-b border-sentinel-800">
          <tr>
            <th className="p-3">Token</th>
            <th className="p-3">Launched</th>
            <th className="p-3 text-right">Initial Liquidity</th>
            <th className="p-3 text-right">Peak Liquidity</th>
            <th className="p-3 text-right">Duration</th>
            <th className="p-3 text-right">Retained %</th>
            <th className="p-3">Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sentinel-800/60 text-slate-200 font-mono">
          {launches.map(launch => {
            const badge = OUTCOME_BADGES[launch.outcome];
            const launchDateStr = new Date(launch.launchedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <tr key={launch.tokenId} className="hover:bg-sentinel-800/40 transition-colors">
                <td className="p-3">
                  <div className="font-semibold text-slate-100">{launch.tokenSymbol}</div>
                  <div className="text-2xs text-slate-400 font-sans">{launch.tokenName}</div>
                </td>
                <td className="p-3 text-slate-400">{launchDateStr}</td>
                <td className="p-3 text-right text-slate-200">
                  {launch.initialLiquidityUsd != null ? `$${launch.initialLiquidityUsd.toLocaleString()}` : 'N/A'}
                </td>
                <td className="p-3 text-right text-slate-200">
                  {launch.peakLiquidityUsd != null ? `$${launch.peakLiquidityUsd.toLocaleString()}` : 'N/A'}
                </td>
                <td className="p-3 text-right text-slate-300">
                  {launch.tradingDurationDays}d
                </td>
                <td className="p-3 text-right text-emerald-400">
                  {launch.creatorRetainedPct != null ? `${launch.creatorRetainedPct.toFixed(1)}%` : 'N/A'}
                </td>
                <td className="p-3">
                  <span className={clsx('px-2 py-0.5 rounded text-2xs font-mono border', badge.color)}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
