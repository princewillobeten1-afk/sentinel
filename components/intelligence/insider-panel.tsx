'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { InsiderCandidate, InsiderDetectionReport } from '@/lib/activity/types';

interface InsiderPanelProps {
  report?: InsiderDetectionReport;
  chain?: string;
}

export function InsiderPanel({ report, chain = 'solana' }: InsiderPanelProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<InsiderCandidate | null>(null);

  if (!report || report.candidates.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-400">
        <h3 className="text-lg font-bold text-white mb-2">EARLY / COORDINATED ACTIVITY</h3>
        <p className="text-sm">No unusual early or coordinated activity patterns detected based on available evidence.</p>
      </div>
    );
  }

  const highest = report.highestConfidencePattern ?? report.candidates[0];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED_RELATIONSHIP':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'HIGH_CONFIDENCE_PATTERN':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'POTENTIAL_CONNECTION':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-md space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-rose-400">
              Insider Detection Engine
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {report.insiderDetectionVersion}
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mt-1">EARLY / COORDINATED ACTIVITY</h3>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Report Confidence: <span className="text-rose-400 font-bold font-mono">{report.confidence}%</span>
        </div>
      </div>

      {/* Highest Confidence Summary Box */}
      <div className="p-4 bg-slate-950/80 rounded-xl border border-rose-500/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              Highest Confidence Observed Pattern
            </span>
          </div>
          <span className={`text-2xs px-2.5 py-0.5 rounded-full font-semibold border ${statusBadge(highest.status)}`}>
            {highest.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2 border-y border-slate-800/80">
          <div>
            <div className="text-2xs text-slate-400">Candidate Wallet</div>
            <Link
              href={`/wallet/${chain}/${highest.wallet}`}
              className="text-xs font-mono font-bold text-cyan-400 hover:underline truncate block"
            >
              {highest.wallet.slice(0, 8)}...{highest.wallet.slice(-6)}
            </Link>
          </div>

          <div>
            <div className="text-2xs text-slate-400">Coordination Score</div>
            <div className="text-base font-black text-rose-400 font-mono">
              {highest.score} <span className="text-xs font-normal text-slate-400">/ 100</span>
            </div>
          </div>

          <div>
            <div className="text-2xs text-slate-400">Confidence</div>
            <div className="text-base font-black text-cyan-400 font-mono">{highest.confidence}%</div>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">{highest.explanation}</p>

        <div className="pt-1 flex justify-end">
          <button
            onClick={() => setSelectedCandidate(highest)}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
          >
            <span>View Observed Evidence</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Candidate List Table */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-200">
          Candidate Wallets ({report.candidates.length})
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/40">
                <th className="p-3">Wallet</th>
                <th className="p-3">Status</th>
                <th className="p-3">Coordination Score</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Labels</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {report.candidates.map((cand) => (
                <tr key={cand.wallet} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3">
                    <Link
                      href={`/wallet/${chain}/${cand.wallet}`}
                      className="font-mono font-medium text-cyan-400 hover:underline"
                    >
                      {cand.wallet.slice(0, 6)}...{cand.wallet.slice(-4)}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-2xs font-semibold border ${statusBadge(cand.status)}`}>
                      {cand.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-200">{cand.score} / 100</td>
                  <td className="p-3 font-mono text-cyan-400">{cand.confidence}%</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {cand.labels.map((lbl, idx) => (
                        <span key={idx} className="bg-slate-800 text-slate-300 text-2xs px-1.5 py-0.5 rounded">
                          {lbl}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedCandidate(cand)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-2xs font-medium rounded transition-colors"
                    >
                      Evidence
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Legal Disclaimer */}
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300/90 leading-relaxed font-mono">
        <span className="font-bold text-amber-400">NOTE: </span>
        This detection communicates observable patterns associated with early/coordinated activity. It does NOT establish or verify insider status.
      </div>

      {/* Evidence Dialog */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-white">Observed Candidate Evidence</h4>
                <div className="text-xs font-mono text-cyan-400">{selectedCandidate.wallet}</div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 bg-slate-800 rounded"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-300 p-3 bg-slate-950 rounded border border-slate-800">
                {selectedCandidate.explanation}
              </div>

              <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Evidence Points</h5>

              {selectedCandidate.evidence.map((ev, idx) => (
                <div key={idx} className="p-3 bg-slate-950/80 rounded border border-slate-800 text-xs font-mono space-y-1">
                  <div className="text-slate-200">• {ev.fact}</div>
                  <div className="text-2xs text-slate-400">
                    Source: {ev.source} | Confidence: {(ev.confidence * 100).toFixed(0)}% | Time: {ev.observedAt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
