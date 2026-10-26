import React from 'react';
import { LandingView } from '@/components/views/landing-view';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Phivex | Solana Market Integrity & Execution Operating System',
  description: 'Forensic on-chain intelligence for serious Solana traders. Deconstruct holder clusters, filter wash volume, simulate executable exit depth, and execute with sub-20ms session keys and Jito MEV protection.',
  keywords: [
    'Solana trading terminal',
    'Solana DEX screener',
    'holder cluster detection',
    'wash trading decomposition',
    'Jito MEV protection',
    'Solana session keys',
    'Raydium Meteora trading',
    'crypto decision intelligence',
  ],
  openGraph: {
    title: 'Phivex | Zero Blind Spots on Solana',
    description: 'Decompile ownership, filter wash volume, and execute in milliseconds.',
    type: 'website',
  },
};

export default function RootLandingPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-accent-500/30">
      <LandingView />
    </main>
  );
}
