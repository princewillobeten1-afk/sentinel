import React from 'react';
import { LandingView } from '@/components/views/landing-view';

export const metadata = {
  title: 'Project Sentinel | Solana Market Integrity & Decision Intelligence',
  description: 'A Solana-first launch, discovery, analysis, execution, and portfolio platform.',
};

export default function RootLandingPage() {
  return (
    <main className="min-h-screen bg-sentinel-950 text-slate-100 font-sans selection:bg-sky-500/30">
      <LandingView />
    </main>
  );
}
