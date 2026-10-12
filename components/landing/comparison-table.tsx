'use client';

import React from 'react';
import { Check, X, ShieldCheck, Zap } from 'lucide-react';

const COMPARISON_ROWS = [
  {
    feature: 'Wallet Funding Cluster Genealogy',
    description: 'Traces exchange hot wallet splits & co-funded addresses across top 50 holders',
    sentinel: 'Real-time 4-hop graph',
    standard: 'Flat holder list only',
    sentinelHas: true,
    standardHas: false,
  },
  {
    feature: 'Wash Volume Decomposition',
    description: 'Separates circular bot churning loops from authentic unique buyer growth',
    sentinel: 'Algorithmic volume filter',
    standard: 'Raw fabricated volume shown',
    sentinelHas: true,
    standardHas: false,
  },
  {
    feature: 'Simulated Executable Exit Depth',
    description: 'Calculates real price collapse for $10k–$100k market exits across dynamic AMMs',
    sentinel: 'Multi-pool route simulator',
    standard: 'Static paper liquidity',
    sentinelHas: true,
    standardHas: false,
  },
  {
    feature: 'Private Jito MEV Protection',
    description: 'Direct validator bundle submission that guarantees sandwich bots cannot frontrun',
    sentinel: 'Native Jito tip optimizer',
    standard: 'Public mempool leak risk',
    sentinelHas: true,
    standardHas: false,
  },
  {
    feature: 'Restricted Session-Key 1-Click Trading',
    description: 'Instant sub-20ms fills without browser popup wallet confirmations',
    sentinel: '18ms non-custodial keys',
    standard: 'Slow wallet extension popups',
    sentinelHas: true,
    standardHas: false,
  },
  {
    feature: 'Explainable Forensic Risk Evidence',
    description: 'No black-box "42/100" numbers. Complete supporting hashes, confidence % & actions',
    sentinel: 'Full verified proof',
    standard: 'Arbitrary safety score',
    sentinelHas: true,
    standardHas: false,
  },
  {
    feature: 'Autonomous Circuit Breakers',
    description: 'Automatically pauses orders or tightens stops when dev sells >2% supply',
    sentinel: 'User-configured rules',
    standard: 'Manual emotional exit',
    sentinelHas: true,
    standardHas: false,
  },
];

export function ComparisonTable() {
  return (
    <div className="w-full space-y-6 font-mono">
      <div className="text-center space-y-2">
        <span className="text-3xs uppercase font-bold tracking-widest text-accent-400">
          COMPETITIVE ADVANTAGE
        </span>
        <h3 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
          Sentinel vs. Standard DEX Aggregators
        </h3>
        <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto font-sans">
          Why serious Solana on-chain traders switch from public screener clones to Sentinel&apos;s decision intelligence operating system.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-700 bg-neutral-900/90 shadow-2xl backdrop-blur-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-neutral-750 bg-neutral-850">
              <th className="py-4 px-6 font-bold text-neutral-300 w-1/2">Capability</th>
              <th className="py-4 px-6 font-black text-accent-300 bg-accent-500/10 border-x border-accent-500/20 w-1/4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-accent-400" />
                  <span>PROJECT SENTINEL</span>
                </div>
              </th>
              <th className="py-4 px-6 font-bold text-neutral-400 w-1/4">
                Traditional DEX Screeners
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {COMPARISON_ROWS.map((row, idx) => (
              <tr key={idx} className="hover:bg-neutral-850/50 transition-colors">
                {/* Capability Description */}
                <td className="py-4 px-6 space-y-0.5">
                  <p className="font-bold text-white text-xs">{row.feature}</p>
                  <p className="text-3xs text-neutral-400 font-sans">{row.description}</p>
                </td>

                {/* Sentinel Advantage Column (Highlighted) */}
                <td className="py-4 px-6 bg-accent-500/5 border-x border-accent-500/20 font-bold text-neutral-100">
                  <div className="flex items-center gap-2 text-buy-400">
                    <Check className="h-4 w-4 text-buy-400 flex-shrink-0" />
                    <span className="text-xs">{row.sentinel}</span>
                  </div>
                </td>

                {/* Standard Competitors Column */}
                <td className="py-4 px-6 text-neutral-400">
                  <div className="flex items-center gap-2 text-neutral-500">
                    <X className="h-4 w-4 text-sell-400 flex-shrink-0" />
                    <span className="text-xs">{row.standard}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
