'use client';

import React from 'react';
import type { IntelligenceTimelineEvent } from '@/lib/intelligence/types';
import { History, Activity, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

interface IntelligenceTimelineProps {
  events: IntelligenceTimelineEvent[];
}

export function IntelligenceTimeline({ events }: IntelligenceTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-sentinel-900 border border-sentinel-700/60 rounded-xl p-5 shadow-card my-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
          <History className="w-5 h-5 text-sky-400" />
          <span>Intelligence Timeline</span>
        </h2>
        <p className="text-xs text-slate-400 italic py-4">No intelligence timeline events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-sentinel-900 border border-sentinel-700/60 rounded-xl p-5 shadow-card my-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-sentinel-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-sky-400" />
            <span>Intelligence Timeline</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Historical progression of observable intelligence changes over time.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-sentinel-950 px-2.5 py-1 rounded border border-sentinel-800">
          {events.length} event(s)
        </span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-sentinel-800">
        {events.map((evt) => {
          const SevIcon = getSeverityIcon(evt.severity);
          const sevColor = getSeverityColor(evt.severity);

          return (
            <div key={evt.id} className="relative group">
              {/* Timeline Dot */}
              <div
                className="absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 border-sentinel-900 flex items-center justify-center text-white"
                style={{ backgroundColor: sevColor }}
              >
                <SevIcon className="w-3 h-3" />
              </div>

              {/* Event Content */}
              <div className="bg-sentinel-950/80 border border-sentinel-800 rounded-lg p-3.5 hover:border-sentinel-700 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{evt.title}</span>
                    <span className="text-2xs font-mono px-2 py-0.5 rounded bg-sentinel-800 text-sky-300">
                      {evt.category}
                    </span>
                  </div>
                  <span className="text-2xs font-mono text-slate-400">
                    {new Date(evt.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-1">{evt.description}</p>

                {/* Evidence bullets if available */}
                {evt.evidence && evt.evidence.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-sentinel-900 text-2xs text-slate-400 space-y-1">
                    {evt.evidence.map((ev, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span>{ev.fact}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'CRITICAL': return ShieldAlert;
    case 'HIGH': return AlertTriangle;
    case 'MEDIUM': return Activity;
    default: return Info;
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#D93E44';
    case 'HIGH': return '#EC5A5F';
    case 'MEDIUM': return '#E5A23D';
    case 'LOW': return '#3B8FF0';
    default: return '#6E7A8A';
  }
}
