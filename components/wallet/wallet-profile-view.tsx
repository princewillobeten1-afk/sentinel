'use client';

import React, { useState } from 'react';
import type { WalletActivityProfile } from '@/lib/activity/types';

interface WalletProfileViewProps {
  profile: WalletActivityProfile;
  address: string;
  chain: string;
}

export function WalletProfileView({ profile, address, chain }: WalletProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'early' | 'funding' | 'trades'>('overview');

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Wallet Intelligence Profile</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">{chain}</span>
            </div>
            <h1 className="text-2xl font-bold text-white font-mono mt-1 break-all">{address}</h1>
          </div>

          {/* Activity Labels */}
          <div className="flex flex-wrap gap-1.5">
            {profile.labels.map((label, idx) => (
              <span
                key={idx}
                className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                  label === 'Potentially Coordinated' || label === 'Creator-Associated'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : label === 'Early Participant'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : label === 'Market-Maker-Like'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800 font-mono">
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <div className="text-2xs text-slate-400">Observed Launches</div>
            <div className="text-lg font-bold text-white mt-0.5">{profile.observedLaunches}</div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <div className="text-2xs text-slate-400">Early Entries</div>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">{profile.earlyEntriesCount}</div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <div className="text-2xs text-slate-400">Realized P&L</div>
            <div className={`text-lg font-bold mt-0.5 ${profile.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${profile.realizedPnlUsd.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <div className="text-2xs text-slate-400">Win Rate</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {profile.winRatePct !== undefined ? `${profile.winRatePct}%` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'overview' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Overview & Clusters
        </button>
        <button
          onClick={() => setActiveTab('early')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'early' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Early Entry History ({profile.earlyEntries.length})
        </button>
        <button
          onClick={() => setActiveTab('funding')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'funding' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Funding Links ({profile.fundingRelationships.length})
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'trades' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Recent Trades ({profile.recentTrades.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-bold text-white">Cluster Memberships</h3>
            {profile.clusterMemberships.length > 0 ? (
              <div className="space-y-2">
                {profile.clusterMemberships.map((cId, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-cyan-400">
                    Cluster ID: {cId}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No persistent wallet cluster memberships recorded.</p>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-bold text-white">Factual vs Derived Analysis</h3>
            <div className="p-3 bg-slate-950 rounded border border-slate-800 text-xs space-y-2">
              <div className="text-emerald-400 font-bold">Factual Data:</div>
              <div className="text-slate-300 font-mono">• Observed trade count: {profile.recentTrades.length}</div>
              <div className="text-slate-300 font-mono">• Observed launches: {profile.observedLaunches}</div>
              <div className="text-amber-400 font-bold mt-2">Derived Interpretation:</div>
              <div className="text-slate-300">• Classifications represent statistical traits, not intentions or authoritative entity proof.</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'early' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white">Early Token Participation Records</h3>
          {profile.earlyEntries.length > 0 ? (
            <div className="space-y-3">
              {profile.earlyEntries.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between font-mono">
                    <span className="text-cyan-400 font-bold">Token: {item.tokenId}</span>
                    <span className="text-slate-400">Score: {item.earlyParticipationScore}/100</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 font-mono pt-1">
                    <div>Entry Time: {item.secondsFromLaunch}s from launch</div>
                    <div>Initial Size: ${item.initialSizeUsd.toLocaleString()}</div>
                    <div>Realized P&L: ${item.realizedPnlUsd?.toLocaleString() ?? '0'}</div>
                    <div>Funding Source: {item.fundingSource ? `${item.fundingSource.slice(0, 6)}...` : 'None'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No early launch entry records found.</p>
          )}
        </div>
      )}

      {activeTab === 'funding' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white">Funding Relationships</h3>
          {profile.fundingRelationships.length > 0 ? (
            <div className="space-y-2">
              {profile.fundingRelationships.map((ev, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-slate-300">
                  {ev.sourceWallet} → {ev.recipientWallet} (${ev.amountUsd.toLocaleString()}) {ev.relationshipToCreator ? '[Creator-Linked]' : ''}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No direct funding event links found.</p>
          )}
        </div>
      )}

      {activeTab === 'trades' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white">Recent Observed Trades</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 bg-slate-950">
                  <th className="p-2">Side</th>
                  <th className="p-2">Amount USD</th>
                  <th className="p-2">Timestamp</th>
                  <th className="p-2">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {profile.recentTrades.map((t, idx) => (
                  <tr key={idx}>
                    <td className={`p-2 font-bold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.side}</td>
                    <td className="p-2 text-slate-200">${t.amountUsd.toLocaleString()}</td>
                    <td className="p-2 text-slate-400">{t.timestamp}</td>
                    <td className="p-2 text-slate-500 truncate max-w-[120px]">{t.txHash ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
