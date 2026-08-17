'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { WalletClusterV2 } from '@/lib/ownership/types';

interface WalletClusterCardProps {
  cluster: WalletClusterV2;
}

export function WalletClusterCard({ cluster }: WalletClusterCardProps) {
  const { clusterConfidence, wallets, edges, label, scope } = cluster;

  const scorePct = Math.round(clusterConfidence.score * 100);

  return (
    <div className="p-4 bg-sentinel-900/60 rounded-xl border border-sentinel-800 space-y-3 hover:border-sentinel-700 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100 font-mono text-sm">{cluster.id}</span>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {scope}
            </span>
          </div>
          {label && <div className="text-xs text-amber-300/80 mt-1">{label}</div>}
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400 font-medium">Cluster Confidence</div>
          <div className={clsx(
            'text-base font-bold font-mono',
            scorePct >= 75 ? 'text-emerald-400' : scorePct >= 50 ? 'text-amber-400' : 'text-slate-400',
          )}>
            {scorePct}%
          </div>
        </div>
      </div>

      {/* Wallets */}
      <div className="space-y-1">
        <div className="text-xs text-slate-400 font-medium">{wallets.length} Member Wallets:</div>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto font-mono text-2xs">
          {wallets.map(w => (
            <span key={w} className="px-2 py-0.5 bg-sentinel-950 rounded text-slate-300 border border-sentinel-800">
              {w.slice(0, 8)}...{w.slice(-6)}
            </span>
          ))}
        </div>
      </div>

      {/* Strongest Evidence */}
      {clusterConfidence.strongestEvidence && (
        <div className="p-2 bg-sentinel-950/60 rounded border border-sentinel-800/80 text-xs">
          <span className="text-slate-400 font-medium">Key Evidence: </span>
          <span className="text-slate-200">{clusterConfidence.strongestEvidence.fact}</span>
        </div>
      )}

      {/* Conflicting Evidence if present */}
      {clusterConfidence.conflictingEvidence.length > 0 && (
        <div className="p-2 bg-amber-500/5 rounded border border-amber-500/20 text-xs text-amber-300/90">
          <span className="font-medium text-amber-400">Conflicting Evidence: </span>
          {clusterConfidence.conflictingEvidence.map((e, idx) => (
            <div key={idx}>{e.fact}</div>
          ))}
        </div>
      )}

      {/* Edges Summary */}
      <div className="text-2xs font-mono text-slate-400 pt-1 border-t border-sentinel-800/60 flex justify-between">
        <span>{edges.length} relationship edge{edges.length > 1 ? 's' : ''}</span>
        <span>{cluster.methodologyVersion}</span>
      </div>
    </div>
  );
}
