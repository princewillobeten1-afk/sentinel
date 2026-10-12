'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  AlertOctagon,
  ShieldAlert,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Network,
  Share2,
  ArrowRight,
  Zap
} from 'lucide-react';

interface ClusterNode {
  id: string;
  label: string;
  supplyPct: number;
  fundedMinutesAgo: number;
  solBalance: number;
  x: number;
  y: number;
}

const NODES: ClusterNode[] = [
  { id: 'dev', label: 'Cabal Root Wallet', supplyPct: 0, fundedMinutesAgo: 60, solBalance: 420.5, x: 260, y: 40 },
  { id: 'w1', label: 'Sybil #1', supplyPct: 4.2, fundedMinutesAgo: 45, solBalance: 12.1, x: 80, y: 120 },
  { id: 'w2', label: 'Sybil #2', supplyPct: 3.8, fundedMinutesAgo: 44, solBalance: 15.4, x: 170, y: 120 },
  { id: 'w3', label: 'Sybil #3', supplyPct: 4.6, fundedMinutesAgo: 43, solBalance: 9.8, x: 260, y: 120 },
  { id: 'w4', label: 'Sybil #4', supplyPct: 3.9, fundedMinutesAgo: 42, solBalance: 14.2, x: 350, y: 120 },
  { id: 'w5', label: 'Sybil #5', supplyPct: 4.1, fundedMinutesAgo: 40, solBalance: 11.0, x: 440, y: 120 },
  { id: 'w6', label: 'Sybil #6', supplyPct: 3.5, fundedMinutesAgo: 38, solBalance: 18.2, x: 120, y: 200 },
  { id: 'w7', label: 'Sybil #7', supplyPct: 4.4, fundedMinutesAgo: 37, solBalance: 13.9, x: 220, y: 200 },
  { id: 'w8', label: 'Sybil #8', supplyPct: 3.7, fundedMinutesAgo: 36, solBalance: 10.4, x: 310, y: 200 },
  { id: 'w9', label: 'Sybil #9', supplyPct: 3.9, fundedMinutesAgo: 35, solBalance: 16.5, x: 400, y: 200 },
];

export function ClusterAttackFlow() {
  const [mode, setMode] = useState<'sentinel' | 'retail'>('sentinel');
  const [hoveredNode, setHoveredNode] = useState<ClusterNode | null>(null);

  const totalControlled = NODES.slice(1).reduce((acc, n) => acc + n.supplyPct, 0).toFixed(1);

  return (
    <div className="w-full rounded-2xl border border-neutral-700 bg-neutral-900/90 shadow-2xl backdrop-blur-xl overflow-hidden font-mono">
      {/* Header with Mode Toggle Switch */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-750 bg-neutral-850 px-6 py-4 gap-4">
        <div>
          <span className="text-3xs uppercase font-bold tracking-widest text-neutral-400">
            FORENSIC CLUSTER RADAR
          </span>
          <h3 className="text-base font-bold text-white tracking-wide">
            The Coordinated Cabal Trap Dissected
          </h3>
        </div>

        {/* Toggle Mode */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-950 border border-neutral-700">
          <button
            onClick={() => setMode('retail')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'retail'
                ? 'bg-sell-500/20 text-sell-300 border border-sell-500/40 shadow-glow-sell'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Retail DEX View (Deceptive)
          </button>
          <button
            onClick={() => setMode('sentinel')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'sentinel'
                ? 'bg-buy-500/20 text-buy-300 border border-buy-500/40 shadow-glow-buy'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Sentinel Forensic X-Ray
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-750">
        
        {/* Left Visual Diagram (7 Cols) */}
        <div className="lg:col-span-7 p-6 relative bg-neutral-950/70 min-h-[380px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {mode === 'retail' ? (
              /* RETAIL VIEW: Parabolic Green Candle, Fake Volume, Deceptive Illusion */
              <motion.div
                key="retail-view"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="space-y-6 my-auto text-center py-8"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-buy-500/10 text-buy-400 border border-buy-500/30 text-xs font-bold">
                  <TrendingUp className="h-4 w-4" />
                  TRENDING #1 ON DEXSCREENER
                </div>

                <div className="space-y-1">
                  <p className="text-4xl font-black text-buy-400 tracking-tight">+$412.8% (24H)</p>
                  <p className="text-xs text-neutral-400">Reported Volume: $14.8M • Market Cap: $8.2M</p>
                </div>

                {/* Simulated Green Parabolic Path */}
                <div className="relative h-28 w-full max-w-md mx-auto">
                  <svg viewBox="0 0 400 100" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="retailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#12B574" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#12B574" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 10 90 Q 120 85 200 60 T 320 20 T 390 10"
                      fill="none"
                      stroke="#12B574"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M 10 90 Q 120 85 200 60 T 320 20 T 390 10 L 390 100 L 10 100 Z"
                      fill="url(#retailGrad)"
                    />
                  </svg>
                </div>

                <div className="p-3 rounded-xl bg-sell-500/10 border border-sell-500/30 text-xs text-sell-300 max-w-md mx-auto">
                  <strong>The Trap:</strong> Retail sees only parabolic green candles and $14.8M volume. No visibility into who holds the coins or who provided the initial buy pressure.
                </div>
              </motion.div>
            ) : (
              /* SENTINEL FORENSIC X-RAY: The Wallet Genealogy Graph */
              <motion.div
                key="sentinel-view"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between text-2xs text-neutral-400">
                  <span className="flex items-center gap-1.5 text-sell-400 font-bold">
                    <AlertOctagon className="h-4 w-4" />
                    CO-FUNDED SYBIL CLUSTER DETECTED
                  </span>
                  <span>9 Sybils • {totalControlled}% Supply</span>
                </div>

                {/* Interactive SVG Cluster Graph */}
                <div className="relative h-[280px] w-full bg-neutral-900/90 rounded-xl border border-neutral-750 p-2 overflow-hidden">
                  <svg viewBox="0 0 520 250" className="w-full h-full">
                    {/* Connecting Edges from Root to Sybils */}
                    {NODES.slice(1).map((node) => (
                      <line
                        key={node.id}
                        x1={NODES[0].x}
                        y1={NODES[0].y}
                        x2={node.x}
                        y2={node.y}
                        stroke="#EC5A5F"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        opacity={hoveredNode?.id === node.id ? 1 : 0.6}
                      />
                    ))}

                    {/* Root Node (Cabal Origin) */}
                    <g transform={`translate(${NODES[0].x}, ${NODES[0].y})`}>
                      <circle cx={0} cy={0} r={18} fill="#EC5A5F" opacity={0.2} />
                      <circle cx={0} cy={0} r={12} fill="#EC5A5F" />
                      <text x={0} y={4} fontSize={9} fill="#FFFFFF" textAnchor="middle" fontWeight="bold">
                        ROOT
                      </text>
                      <text x={0} y={-16} fontSize={8} fill="#F87171" textAnchor="middle">
                        Kraken Hot #4 (60m ago)
                      </text>
                    </g>

                    {/* Sybil Nodes */}
                    {NODES.slice(1).map((node) => {
                      const isHovered = hoveredNode?.id === node.id;
                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onMouseEnter={() => setHoveredNode(node)}
                          onMouseLeave={() => setHoveredNode(null)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={0}
                            cy={0}
                            r={isHovered ? 16 : 12}
                            fill={isHovered ? '#EF4444' : '#7F1D1D'}
                            stroke="#EC5A5F"
                            strokeWidth={isHovered ? 2 : 1}
                            className="transition-all"
                          />
                          <text x={0} y={3} fontSize={8} fill="#FFFFFF" textAnchor="middle" fontWeight="bold">
                            {node.supplyPct}%
                          </text>
                          <text x={0} y={18} fontSize={7} fill="#A3A3A3" textAnchor="middle">
                            {node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Hover Telemetry Card */}
                  {hoveredNode && (
                    <div className="absolute bottom-2 left-2 right-2 p-2 rounded bg-neutral-950/95 border border-sell-500/50 text-3xs text-neutral-300 flex justify-between">
                      <span>Wallet: <strong>{hoveredNode.label}</strong></span>
                      <span>Supply: <strong className="text-sell-400">{hoveredNode.supplyPct}%</strong></span>
                      <span>Funded: <strong>{hoveredNode.fundedMinutesAgo}m ago</strong></span>
                      <span>Balance: <strong>{hoveredNode.solBalance} SOL</strong></span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-3xs text-neutral-400 pt-1">
                  <span>Hover over nodes to inspect individual wallet balances</span>
                  <span className="text-buy-400">● 100% On-Chain Evidence Verified</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Forensic Summary (5 Cols) */}
        <div className="lg:col-span-5 p-6 flex flex-col justify-between bg-neutral-900/60 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-3xs uppercase text-neutral-400 font-bold">SENTINEL RISK VERDICT</span>
              <span className={`px-2 py-0.5 rounded text-3xs font-bold border ${mode === 'sentinel' ? 'bg-sell-500/20 text-sell-300 border-sell-500/40' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}>
                {mode === 'sentinel' ? 'HIGH RISK (88%)' : 'UNKNOWN'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-neutral-850 border border-neutral-750 space-y-1.5">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-neutral-400">Coordinated Supply Share:</span>
                  <span className="text-sell-400 font-bold">{totalControlled}% of Supply</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-750 overflow-hidden">
                  <div className="h-full bg-sell-500 rounded-full" style={{ width: `${totalControlled}%` }} />
                </div>
                <p className="text-3xs text-neutral-500">
                  9 separate top wallets received initial gas funding from the same address within 22 minutes.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-850 border border-neutral-750 space-y-1.5">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-neutral-400">Wash Trading Loops:</span>
                  <span className="text-warn-400 font-bold">72.4% Bot Volume</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-750 overflow-hidden">
                  <div className="h-full bg-warn-500 rounded-full" style={{ width: '72.4%' }} />
                </div>
                <p className="text-3xs text-neutral-500">
                  $10.7M of reported $14.8M volume is 3 bots cycling the same 45 SOL between two pool routes.
                </p>
              </div>
            </div>
          </div>

          {/* Actionable Shield Action */}
          <div className="p-4 rounded-xl bg-sell-500/10 border border-sell-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-sell-400">
              <ShieldAlert className="h-4 w-4" />
              <span>Recommended Action: AVOID / EXIT</span>
            </div>
            <p className="text-2xs text-neutral-300 leading-relaxed font-sans">
              Sentinel&apos;s autonomous circuit breaker restricts auto-snipes and flags high slippage risk. Don&apos;t donate exit liquidity to coordinated insider bundles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
