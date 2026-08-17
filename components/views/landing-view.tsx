'use client';

import React from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import {
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import dynamic from 'next/dynamic';

// Dynamically import the 3D scene to avoid SSR issues
const HeroScene = dynamic(() => import('@/components/3d/hero-scene').then(mod => mod.HeroScene), {
  ssr: false,
});

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export function LandingView() {
  return (
    <div className="relative min-h-screen bg-sentinel-950 text-slate-100 font-sans selection:bg-sky-500/30 overflow-hidden">
      
      {/* 3D Background */}
      <HeroScene />
      
      <div className="relative z-10 w-full">
        {/* Header Bar */}
        <motion.header 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="sticky top-0 z-40 border-b border-sentinel-800 bg-sentinel-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between max-w-7xl mx-auto"
        >
          <Link href="/" className="flex items-center gap-3 cursor-pointer">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sentinel-500/20 text-sky-400 border border-sentinel-500/40 shadow-glow">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div>
              <p className="text-2xs uppercase font-bold tracking-[0.25em] text-slate-400">PROJECT</p>
              <h1 className="text-base font-bold text-white tracking-wide">SENTINEL</h1>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/terminal">
              <Button variant="ghost" size="sm">
                Explore Screener
              </Button>
            </Link>
            <Link href="/terminal">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Launch Terminal
              </Button>
            </Link>
          </div>
        </motion.header>

        {/* Hero Section */}
        <motion.section 
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="pt-16 pb-20 px-6 max-w-5xl mx-auto text-center space-y-6"
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1 text-xs font-mono text-sky-300 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Solana Market Integrity & Decision Intelligence Operating System</span>
          </motion.div>

          <motion.h1 variants={fadeInUp} className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Discover Earlier. Understand Ownership. <br className="hidden sm:block" />
            <span className="text-sky-400">Execute Intelligently.</span>
          </motion.h1>

          <motion.p variants={fadeInUp} className="max-w-3xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed drop-shadow-md">
            Sentinel is not merely another DEX clone interface. It is a financial intelligence and execution operating system designed to filter wash trading, analyze holder funding clusters, and enforce personal risk rules before avoidable losses happen.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/terminal">
              <Button variant="buy" size="lg" className="px-8 text-base shadow-glow-buy transition-transform hover:scale-105 active:scale-95" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Enter Trade Terminal
              </Button>
            </Link>
            <Link href="/terminal">
              <Button variant="outline" size="lg" className="px-8 text-base backdrop-blur-md bg-sentinel-950/40 transition-transform hover:scale-105 active:scale-95">
                View Organic Screener
              </Button>
            </Link>
          </motion.div>
        </motion.section>

        {/* Product Value Proposition */}
        <motion.section 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="py-16 px-6 max-w-7xl mx-auto border-t border-sentinel-800 space-y-12 bg-sentinel-950/50 backdrop-blur-sm"
        >
          <div className="text-center space-y-2">
            <Badge variant="info">CORE CAPABILITIES</Badge>
            <h2 className="text-3xl font-bold text-white">Built for Serious On-Chain Traders</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              High-density financial architecture prioritizing information precision over visual noise.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <motion.div whileHover={{ y: -5 }} transition={{ type: "spring" }}>
              <Panel title="Speed & Execution" subtitle="Zero-latency route simulation">
                <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2">
                  Instant one-click trades powered by restricted session keys, custom priority fee control, and private MEV protection.
                </p>
              </Panel>
            </motion.div>

            <motion.div whileHover={{ y: -5 }} transition={{ type: "spring" }}>
              <Panel title="Effective Ownership" subtitle="Holder funding clustering">
                <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2">
                  Detects when multiple top holder wallets originate from the same exchange deposit address or funding transaction.
                </p>
              </Panel>
            </motion.div>

            <motion.div whileHover={{ y: -5 }} transition={{ type: "spring" }}>
              <Panel title="Organic Demand" subtitle="Wash-trading decomposition">
                <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2">
                  Separates raw bot circular volume from authentic independent buyer growth to reveal true token demand.
                </p>
              </Panel>
            </motion.div>

            <motion.div whileHover={{ y: -5 }} transition={{ type: "spring" }}>
              <Panel title="True Net P&L" subtitle="Fee & gas adjusted returns">
                <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2">
                  Measures real profitability after all DEX slippage, priority tips, and Solana transaction fees.
                </p>
              </Panel>
            </motion.div>
          </div>
        </motion.section>

        {/* Intelligence Explanation */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="py-16 px-6 max-w-7xl mx-auto border-t border-sentinel-800 grid gap-8 lg:grid-cols-2 items-center bg-sentinel-950/70 backdrop-blur-md"
        >
          <div className="space-y-4">
            <Badge variant="warning">EXPLAINABLE RISK EVIDENCE</Badge>
            <h2 className="text-3xl font-bold text-white">No Arbitrary Scores. Complete Supporting Evidence.</h2>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              Sentinel never displays unexplained safety numbers like &quot;Score: 42/100&quot;. Instead, every alert provides the conclusion, supporting evidence, confidence percentage, and recommended risk mitigation action.
            </p>
            <div className="space-y-2 text-xs font-mono text-sky-300">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Wallet cluster graph analysis
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Creator rug & abandonment history
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Executable liquidity depth simulation
              </p>
            </div>
          </div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="rounded-2xl border border-sentinel-700 bg-sentinel-900 p-6 space-y-4 shadow-2xl font-mono relative overflow-hidden"
          >
            {/* Subtle glow effect behind the card */}
            <div className="absolute -inset-10 bg-rose-500/10 blur-3xl pointer-events-none rounded-full" />
            <div className="relative z-10">
              <div className="flex items-center justify-between border-b border-sentinel-800 pb-3">
                <span className="text-xs font-bold text-rose-400 uppercase">Coordinated Ownership Threat</span>
                <Badge variant="risk-critical">87% Confidence</Badge>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed mt-4">
                Seventeen of the top 40 holder wallets were funded by three connected addresses during the same 22-minute period. These wallets collectively control 31.4% of circulating supply.
              </p>
              <div className="pt-4 mt-4 border-t border-sentinel-800 text-2xs text-slate-400 flex justify-between">
                <span>Recommended Action: Avoid / Reduce Position</span>
                <span className="text-emerald-400 font-bold">Auto-Circuit Breaker Active</span>
              </div>
            </div>
          </motion.div>
        </motion.section>
        {/* Smart Money Intelligence */}
        <motion.section 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="py-16 px-6 max-w-7xl mx-auto border-t border-sentinel-800 text-center space-y-10 bg-sentinel-950/60 backdrop-blur-sm"
        >
          <div className="space-y-2">
            <Badge variant="info">SMART MONEY TRACKING</Badge>
            <h2 className="text-3xl font-bold text-white">Follow the Alpha, Not the Noise</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Real-time intelligence on highly profitable wallets, sniper accumulation, and insider cluster activity.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            <motion.div whileHover={{ scale: 1.05 }} className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-6 text-left space-y-3">
              <div className="h-10 w-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-white">Whale Heatmaps</h3>
              <p className="text-xs text-slate-400">Visualize massive capital rotations before retail catches on. Track aggregate inflows from wallets with {`>`}$1M PnL.</p>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-left space-y-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-white">Sniper Detection</h3>
              <p className="text-xs text-slate-400">Identify block-zero accumulation. See exact entry prices of historically successful sniper bots in real-time.</p>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-6 text-left space-y-3">
              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-white">Insider Clustering</h3>
              <p className="text-xs text-slate-400">Automatically map out hidden connections between seemingly unrelated wallets to expose insider cartels.</p>
            </motion.div>
          </div>
        </motion.section>

        {/* AI Section */}
        <section className="py-16 px-6 max-w-7xl mx-auto border-t border-sentinel-800 text-center space-y-8 relative overflow-hidden">
          <div className="space-y-2 relative z-10">
            <Badge variant="info">SENTINEL AI CO-PILOT</Badge>
            <h2 className="text-3xl font-bold text-white">Natural Language Market Audit</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Audit token mints, check creator reputation, and simulate position impact using conversational AI.
            </p>
          </div>

          <div className="relative z-10">
            <Link href="/terminal">
              <Button variant="cyber" size="lg" rightIcon={<Sparkles className="h-5 w-5" />} className="transition-transform hover:scale-105 active:scale-95">
                Try Sentinel AI Co-Pilot
              </Button>
            </Link>
          </div>
        </section>

        {/* Call to Action Banner */}
        <motion.section 
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          className="py-20 px-6 max-w-5xl mx-auto text-center space-y-6 border-t border-sentinel-800 bg-sentinel-950/80 backdrop-blur-sm"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Ready to Upgrade Your On-Chain Execution?</h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Start exploring fresh token mints, holder clusters, and trading routes on Solana Mainnet.
          </p>
          <Link href="/terminal">
            <Button variant="buy" size="lg" className="px-10 py-3 text-base shadow-glow-buy transition-transform hover:scale-105 active:scale-95">
              Enter Sentinel Terminal Now
            </Button>
          </Link>
        </motion.section>

        {/* Footer */}
        <footer className="border-t border-sentinel-800 bg-sentinel-950/90 backdrop-blur-sm px-6 py-8 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <div>
            <p className="font-bold text-slate-300">Project Sentinel © 2026</p>
            <p className="text-2xs text-slate-500 mt-0.5">Solana Market Integrity & Decision Intelligence Layer</p>
          </div>
          <div className="flex gap-4">
            <Link href="/help" className="hover:text-slate-300 cursor-pointer">Documentation</Link>
            <Link href="/settings" className="hover:text-slate-300 cursor-pointer">Preferences</Link>
            <Link href="/terminal" className="hover:text-slate-300 cursor-pointer">Screener</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
