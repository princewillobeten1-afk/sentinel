'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Panel } from '@/components/ui/panel';
import type { EffectiveOwnershipReport, OwnershipEntity, OwnershipLayer } from '@/lib/ownership/types';

interface OwnershipPanelProps {
  report: EffectiveOwnershipReport;
}

const LAYER_BADGES: Record<OwnershipLayer, { label: string; color: string }> = {
  DIRECT: { label: 'Direct Wallet', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  RELATED: { label: 'Creator Related', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  CLUSTER: { label: 'Wallet Cluster', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  UNKNOWN: { label: 'Unattributed', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const CONCENTRATION_LEVEL_COLORS: Record<string, string> = {
  LOW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  MODERATE: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  ELEVATED: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  EXTREME: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export function OwnershipPanel({ report }: OwnershipPanelProps) {
  const [selectedEntity, setSelectedEntity] = useState<OwnershipEntity | null>(null);

  const { concentration, entities, confidence, limitations } = report;

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-100">Effective Ownership Analysis</span>
          <span className="text-xs text-slate-400 font-mono ml-2">v2.0.0</span>
        </div>
      }
      subtitle="Entity control, cluster attribution, and supply distribution with evidence"
      headerActions={
        <div className="flex items-center gap-2">
          <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium border', CONCENTRATION_LEVEL_COLORS[concentration.level])}>
            {concentration.level} Concentration
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Confidence: {Math.round(confidence * 100)}%
          </span>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Concentration Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-sentinel-900/60 rounded-xl border border-sentinel-800/80">
          <div>
            <div className="text-xs text-slate-400 font-medium mb-1">Top Single Holder</div>
            <div className="text-lg font-semibold font-mono text-slate-100">{concentration.topHolderPct.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-1">Top Cluster</div>
            <div className="text-lg font-semibold font-mono text-amber-400">{concentration.topClusterPct.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-1">Creator Associated</div>
            <div className="text-lg font-semibold font-mono text-purple-400">{concentration.creatorAssociatedPct.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-1">Known Entities</div>
            <div className="text-lg font-semibold font-mono text-blue-400">{concentration.knownEntityPct.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-1">Unattributed Supply</div>
            <div className="text-lg font-semibold font-mono text-slate-400">{concentration.unknownPct.toFixed(1)}%</div>
          </div>
        </div>

        {/* Stacked Supply Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>Effective Supply Breakdown</span>
            <span>{report.uniqueAddressesCounted} addresses analyzed</span>
          </div>
          <div className="h-4 w-full bg-sentinel-950 rounded-full overflow-hidden flex border border-sentinel-800">
            {entities.slice(0, 8).map((entity, i) => {
              const bgColors = [
                'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-emerald-500',
                'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500',
              ];
              return (
                <div
                  key={entity.entityId}
                  className={clsx('h-full transition-all duration-300 relative group cursor-pointer', bgColors[i % bgColors.length])}
                  style={{ width: `${Math.max(0.5, entity.supplyPercentage)}%` }}
                  onClick={() => setSelectedEntity(entity)}
                  title={`${entity.type}: ${entity.supplyPercentage.toFixed(1)}%`}
                />
              );
            })}
            <div
              className="h-full bg-slate-700/60"
              style={{ width: `${concentration.unknownPct}%` }}
              title={`Unattributed: ${concentration.unknownPct.toFixed(1)}%`}
            />
          </div>
        </div>

        {/* Entities Table */}
        <div className="overflow-x-auto rounded-xl border border-sentinel-800 bg-sentinel-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-sentinel-900/80 text-slate-400 font-mono border-b border-sentinel-800">
              <tr>
                <th className="p-3">Entity Type</th>
                <th className="p-3">Wallets</th>
                <th className="p-3">Layer</th>
                <th className="p-3 text-right">Effective Balance</th>
                <th className="p-3 text-right">Supply %</th>
                <th className="p-3 text-right">Confidence</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sentinel-800/60 text-slate-200">
              {entities.map(entity => {
                const badge = LAYER_BADGES[entity.layer];
                return (
                  <tr
                    key={entity.entityId}
                    className="hover:bg-sentinel-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedEntity(entity)}
                  >
                    <td className="p-3 font-medium font-mono text-slate-100">
                      {entity.type}
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {entity.addresses.length} wallet{entity.addresses.length > 1 ? 's' : ''}
                    </td>
                    <td className="p-3">
                      <span className={clsx('px-2 py-0.5 rounded text-2xs font-mono border', badge.color)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-100">
                      {entity.estimatedEffectiveBalance.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-400">
                      {entity.supplyPercentage.toFixed(2)}%
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">
                      {Math.round(entity.confidence * 100)}%
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedEntity(entity);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-mono"
                      >
                        View Evidence
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected Entity Evidence Drawer/Modal */}
        {selectedEntity && (
          <div className="p-4 bg-sentinel-900/90 rounded-xl border border-sentinel-700 space-y-3">
            <div className="flex justify-between items-center border-b border-sentinel-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100 text-sm">{selectedEntity.type} Entity Evidence</span>
                <span className={clsx('px-2 py-0.5 rounded text-2xs font-mono border', LAYER_BADGES[selectedEntity.layer].color)}>
                  {selectedEntity.layer}
                </span>
              </div>
              <button
                onClick={() => setSelectedEntity(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">Wallets ({selectedEntity.addresses.length}):</div>
              <div className="flex flex-wrap gap-1 font-mono text-2xs">
                {selectedEntity.addresses.map(addr => (
                  <span key={addr} className="px-2 py-0.5 bg-sentinel-950 rounded text-slate-300 border border-sentinel-800">
                    {addr}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">Observable Facts & Evidence:</div>
              <div className="space-y-1.5">
                {selectedEntity.evidence.map((ev, idx) => (
                  <div key={idx} className="p-2 bg-sentinel-950/60 rounded border border-sentinel-800 text-xs flex justify-between items-start">
                    <span className="text-slate-200">{ev.fact}</span>
                    <span className="text-2xs font-mono text-slate-400 ml-2 whitespace-nowrap">
                      {ev.source} ({(ev.confidence * 100).toFixed(0)}% conf)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Limitations */}
        {limitations.length > 0 && (
          <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 text-xs text-amber-300/80 space-y-1">
            <div className="font-semibold text-amber-400">Analysis Limitations & Gaps</div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-400">
              {limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
