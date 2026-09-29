'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AnalyticsLiveView } from './analytics-live-view';

const AnalyticsResearchView = dynamic(() => import('./analytics-research-view').then(module => module.AnalyticsResearchView), {
  loading: () => <div role="status" className="py-12 text-center text-xs text-slate-400">Loading research workspace…</div>,
});

export function AnalyticsView() {
  const [mode, setMode] = useState<'live' | 'lab'>('live');
  return mode === 'live'
    ? <AnalyticsLiveView onOpenLab={() => setMode('lab')} />
    : <AnalyticsResearchView onBack={() => setMode('live')} />;
}
