'use client';

import React, { useState } from 'react';
import type { OrganicActivityAssessment, ActivityWindow } from '@/lib/activity/types';

interface ActivityQualityCardProps {
  assessment?: OrganicActivityAssessment;
  onWindowChange?: (window: ActivityWindow) => void;
}

export function ActivityQualityCard({ assessment, onWindowChange }: ActivityQualityCardProps) {
  const [selectedWindow, setSelectedWindow] = useState<ActivityWindow>(assessment?.window ?? '1h');
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

  const windows: ActivityWindow[] = ['1m', '5m', '15m', '1h', '4h', '24h', '7d'];

  if (!assessment) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-400">
        <h3 className="text-lg font-bold text-white mb-2">Activity Quality</h3>
        <p className="text-sm">Activity analysis data is currently unavailable.</p>
      </div>
    );
  }

  const score = assessment.score;
  const scoreColor =
    score >= 75
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : score >= 50
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-rose-400 border-rose-500/30 bg-rose-500/10';

  const progressColor =
    score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  const handleWindowSelect = (w: ActivityWindow) => {
    setSelectedWindow(w);
    onWindowChange?.(w);
  };

  const feat = assessment.features;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-md">
      {/* Header & Window Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400">
              Organic Volume Engine
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {assessment.organicVolumeVersion}
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mt-1">Activity Quality Assessment</h3>
        </div>

        {/* Time Window Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          {windows.map((w) => (
            <button
              key={w}
              onClick={() => handleWindowSelect(w)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedWindow === w
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Main Score Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
        <div className="flex flex-col items-center justify-center p-6 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center">
          <div
            className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-inner ${scoreColor}`}
          >
            <span className="text-3xl font-black tracking-tight">{score}</span>
            <span className="text-2xs uppercase font-bold text-slate-400">Score / 100</span>
          </div>
          <div className="mt-3 text-xs font-semibold text-slate-300">
            Confidence: <span className="text-cyan-400">{assessment.confidence}%</span>
          </div>
          <div className="text-2xs text-slate-400 mt-1">
            Status: <span className="font-mono text-slate-200">{assessment.status}</span>
          </div>
        </div>

        {/* Interpretation & Sub-dimensions */}
        <div className="md:col-span-2 space-y-4">
          <div className="p-3.5 bg-slate-950/40 rounded-lg border border-slate-800 text-sm text-slate-200 leading-relaxed">
            <span className="font-semibold text-cyan-400">Assessment Interpretation: </span>
            {assessment.interpretation}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>Participant Diversity ({feat.participation.uniqueActiveWallets} wallets)</span>
              <span className="text-cyan-400 font-mono">
                {feat.participation.uniqueActiveWallets >= 200 ? 'High' : feat.participation.uniqueActiveWallets >= 50 ? 'Moderate' : 'Low'}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (feat.participation.uniqueActiveWallets / 300) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>Top 5 Wallet Share (Concentration)</span>
              <span className="font-mono text-amber-400">
                {(feat.participation.top5WalletShare * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, feat.participation.top5WalletShare * 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>Repeat Trader Ratio</span>
              <span className="font-mono text-slate-300">
                {(feat.repeatWallets.repeatWalletRatio * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, feat.repeatWallets.repeatWalletRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Signals & Evidence Trigger */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-400">
          Sample size: <span className="font-mono text-slate-200">{assessment.sampleSize} trades</span> | Coverage:{' '}
          <span className="font-mono text-slate-200">{(assessment.dataCoverage * 100).toFixed(0)}%</span>
        </div>

        <button
          onClick={() => setShowEvidenceModal(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <span>View Evidence ({assessment.signals.length} Signals)</span>
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Evidence Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-lg font-bold text-white">Activity Quality Signals & Evidence</h4>
              <button
                onClick={() => setShowEvidenceModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 bg-slate-800 rounded"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3">
              {assessment.signals.map((sig, idx) => (
                <div key={idx} className="p-3.5 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide">
                      {sig.type}
                    </span>
                    <span
                      className={`text-2xs px-2 py-0.5 rounded font-semibold ${
                        sig.severity === 'HIGH' || sig.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : sig.severity === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {sig.severity} | {sig.dimension}
                    </span>
                  </div>
                  {sig.evidence.map((ev, eIdx) => (
                    <div key={eIdx} className="text-xs text-slate-300 font-mono bg-slate-900 p-2 rounded border border-slate-800/60">
                      • {ev.fact} (Confidence: {(ev.confidence * 100).toFixed(0)}%, Source: {ev.source})
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
