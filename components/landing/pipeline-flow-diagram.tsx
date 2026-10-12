'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
  Database,
  Network,
  Lock,
  GitBranch,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Play
} from 'lucide-react';

interface Stage {
  id: number;
  name: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  headline: string;
  description: string;
  metrics: { label: string; value: string; color?: string }[];
  codeSample: string;
  colorScheme: {
    border: string;
    bg: string;
    badge: string;
    glow: string;
    text: string;
  };
}

const STAGES: Stage[] = [
  {
    id: 1,
    name: 'MEMPOOL INGESTION',
    badge: '400ms Slot Stream',
    icon: Database,
    headline: 'Sub-Second Solana DEX & RPC Telemetry',
    description:
      'Continuous real-time ingestion from Raydium CPMM/CLMM, Meteora DLMM, Orca Whirlpools, and Pump.fun. Streams slot updates, instruction accounts, and Jito mempool bundles before state commit.',
    metrics: [
      { label: 'Slot Latency', value: '<12ms', color: 'text-buy-400' },
      { label: 'DEX Protocols', value: '7 Native', color: 'text-neutral-200' },
      { label: 'Events / Sec', value: '45,000+', color: 'text-accent-300' },
    ],
    codeSample: `// Ingest raw instruction accounts\nconst slotStream = await sentinelRpc.subscribeSlots({\n  protocols: ['Raydium', 'Meteora', 'PumpFun'],\n  commitment: 'processed',\n  includeJitoBundles: true\n});`,
    colorScheme: {
      border: 'border-accent-500/40',
      bg: 'bg-accent-500/5',
      badge: 'bg-accent-500/20 text-accent-300 border-accent-500/30',
      glow: 'shadow-glow',
      text: 'text-accent-400',
    },
  },
  {
    id: 2,
    name: 'FORENSIC DECOMPILATION',
    badge: 'Cluster & Wash Filter',
    icon: Network,
    headline: 'Holder Funding Genealogy & Volume Decomposition',
    description:
      'Traces fund origins across top wallets to expose coordinated insider cabals. Reconstructs transaction graphs to isolate self-referencing bot circular volume from authentic independent buyer demand.',
    metrics: [
      { label: 'Wash Vol Filtered', value: '$48.2M / 24h', color: 'text-warn-400' },
      { label: 'Cluster Accuracy', value: '98.7%', color: 'text-buy-400' },
      { label: 'Graph Depth', value: '4 Hops', color: 'text-neutral-200' },
    ],
    codeSample: `// Deconstruct wallet genealogy\nconst cluster = await forensicEngine.mapFundingRoots({\n  mint: tokenAddress,\n  maxHops: 4,\n  detectExchangeSplits: true // Kraken, Binance, FixedFloat\n});`,
    colorScheme: {
      border: 'border-warn-500/40',
      bg: 'bg-warn-500/5',
      badge: 'bg-warn-500/20 text-warn-300 border-warn-500/30',
      glow: 'shadow-glow-amber',
      text: 'text-warn-400',
    },
  },
  {
    id: 3,
    name: 'DECISION RISK MATRIX',
    badge: 'Explainable Evidence',
    icon: ShieldCheck,
    headline: 'No Arbitrary Numbers. Complete Verified Proof.',
    description:
      'Instead of blind 1-100 scores, Sentinel provides the exact proof: top 20 wallets hold 42.1% via single funding tree, creator dumped 3 prior tokens, or simulated 20 SOL exit causes 18% price drop.',
    metrics: [
      { label: 'Threat Verdict', value: 'CRITICAL (87%)', color: 'text-sell-400' },
      { label: 'Auto-Circuit Breaker', value: 'ARMED', color: 'text-buy-400' },
      { label: 'Exit Depth Simulated', value: '$25K Max Sell', color: 'text-neutral-200' },
    ],
    codeSample: `// Evidence-backed risk verdict\nif (cluster.concentrationRatio > 0.25) {\n  circuitBreaker.trigger({\n    action: 'RESTRICT_MAX_POSITION',\n    reason: 'Coordinated insider funding detected in block #28410'\n  });\n}`,
    colorScheme: {
      border: 'border-sell-500/40',
      bg: 'bg-sell-500/5',
      badge: 'bg-sell-500/20 text-sell-300 border-sell-500/30',
      glow: 'shadow-glow-sell',
      text: 'text-sell-400',
    },
  },
  {
    id: 4,
    name: 'PRIVATE MEV EXECUTION',
    badge: '18ms Session Key',
    icon: Zap,
    headline: 'Zero-Popup Routing with Dynamic Jito Protection',
    description:
      'Execute trades instantly with non-custodial local session keys. Transactions are wrapped in private Jito bundles with adaptive tip bidding, eliminating toxic sandwich bots and slippage leaks.',
    metrics: [
      { label: 'Execution Speed', value: '18ms', color: 'text-buy-400' },
      { label: 'MEV Sandwich Loss', value: '0.00%', color: 'text-buy-400' },
      { label: 'Fills Success Rate', value: '99.8%', color: 'text-accent-300' },
    ],
    codeSample: `// 1-Click Session Key execution\nconst fill = await sentinelRouter.executePrivateSwap({\n  route: simulatedBestRoute,\n  sessionKey: localRestrictedKey,\n  jitoTipTier: 'dynamic_adaptive'\n});`,
    colorScheme: {
      border: 'border-buy-500/40',
      bg: 'bg-buy-500/5',
      badge: 'bg-buy-500/20 text-buy-300 border-buy-500/30',
      glow: 'shadow-glow-buy',
      text: 'text-buy-400',
    },
  },
];

export function PipelineFlowDiagram() {
  const [selectedStage, setSelectedStage] = useState<Stage>(STAGES[1]);

  return (
    <div className="w-full space-y-8 font-mono">
      {/* Interactive Horizontal Pipeline Nodes Flow */}
      <div className="relative">
        {/* Animated Connecting Line in Background */}
        <div className="hidden lg:block absolute top-1/2 left-8 right-8 -translate-y-1/2 h-0.5 bg-neutral-800 z-0">
          <motion.div
            className="h-full bg-gradient-to-r from-accent-500 via-warn-500 to-buy-500"
            initial={{ width: '0%' }}
            whileInView={{ width: '100%' }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          />
        </div>

        {/* 4 Interactive Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const isSelected = selectedStage.id === stage.id;

            return (
              <button
                key={stage.id}
                onClick={() => setSelectedStage(stage)}
                className={`text-left p-5 rounded-2xl border transition-all duration-300 relative group overflow-hidden ${
                  isSelected
                    ? `${stage.colorScheme.border} ${stage.colorScheme.bg} ${stage.colorScheme.glow} scale-[1.02]`
                    : 'border-neutral-750 bg-neutral-900/80 hover:border-neutral-600 hover:bg-neutral-850'
                }`}
              >
                {/* Stage Number Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                      isSelected
                        ? `${stage.colorScheme.badge}`
                        : 'border-neutral-700 bg-neutral-800 text-neutral-400 group-hover:text-white'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span
                    className={`text-3xs font-bold px-2 py-0.5 rounded border ${
                      isSelected
                        ? `${stage.colorScheme.badge}`
                        : 'border-neutral-750 bg-neutral-850 text-neutral-400'
                    }`}
                  >
                    STAGE 0{stage.id}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className={`text-xs font-bold tracking-wider ${isSelected ? 'text-white' : 'text-neutral-300'}`}>
                    {stage.name}
                  </h4>
                  <p className="text-2xs text-neutral-400 line-clamp-2">
                    {stage.headline}
                  </p>
                </div>

                {/* Micro Indicator bar */}
                <div className="mt-4 pt-3 border-t border-neutral-750/60 flex items-center justify-between text-3xs text-neutral-500">
                  <span>{stage.badge}</span>
                  <span className={`font-bold ${isSelected ? stage.colorScheme.text : 'text-neutral-400'}`}>
                    {isSelected ? '● ACTIVE INSPECTOR' : 'Click to inspect →'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Deep-Dive Inspection Stage Box */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedStage.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
          className={`rounded-2xl border ${selectedStage.colorScheme.border} bg-neutral-900/95 p-6 lg:p-8 backdrop-blur-xl shadow-2xl space-y-6 relative overflow-hidden`}
        >
          {/* Subtle Corner Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-accent-500/5 blur-3xl pointer-events-none rounded-full" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content Column (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded text-3xs font-bold border ${selectedStage.colorScheme.badge}`}>
                  STAGE 0{selectedStage.id} • {selectedStage.badge}
                </span>
                <span className="text-2xs text-neutral-400">Continuous Pipeline Execution</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {selectedStage.headline}
              </h3>

              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                {selectedStage.description}
              </p>

              {/* Live Stage Telemetry Metrics */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {selectedStage.metrics.map((m, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-neutral-850 border border-neutral-750 space-y-1">
                    <p className="text-3xs uppercase font-medium text-neutral-400">{m.label}</p>
                    <p className={`text-sm sm:text-base font-black ${m.color || 'text-white'}`}>
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Code/Telemetry Box (5 Cols) */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-neutral-750 bg-neutral-950 p-4 shadow-inner space-y-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-3xs text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-sell-500/60" />
                    <span className="h-2 w-2 rounded-full bg-warn-500/60" />
                    <span className="h-2 w-2 rounded-full bg-buy-500/60" />
                    <span className="ml-1 text-neutral-300 font-bold">engine-stream.ts</span>
                  </div>
                  <span className="text-buy-400 font-semibold">● RUNNING</span>
                </div>
                <pre className="text-2xs text-neutral-300 font-mono overflow-x-auto p-1 leading-relaxed">
                  <code>{selectedStage.codeSample}</code>
                </pre>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
