'use client';

import React from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import {
  Zap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Activity,
  Layers,
  Lock,
  Cpu,
  BarChart2,
  TrendingUp,
  Search,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';

// Modular Landing Sections
import { LandingHeader } from '@/components/landing/landing-header';
import { TerminalChartFlow } from '@/components/landing/terminal-chart-flow';
import { PipelineFlowDiagram } from '@/components/landing/pipeline-flow-diagram';
import { ClusterAttackFlow } from '@/components/landing/cluster-attack-flow';
import { ExitabilityDepthFlow } from '@/components/landing/exitability-depth-flow';
import { LiveMarketRadar } from '@/components/landing/live-market-radar';
import { ComparisonTable } from '@/components/landing/comparison-table';
import { FaqSection } from '@/components/landing/faq-section';
import { LandingFooter } from '@/components/landing/landing-footer';
import { FooterStatusBar } from '@/components/layout/footer-status-bar';
import { WalletModal } from '@/components/layout/wallet-modal';
import { HotkeyModal } from '@/components/layout/hotkey-modal';
import { ExecutionConsole } from '@/components/layout/execution-console';
import { XTrackerDrawer } from '@/components/x-tracker/x-tracker-drawer';
import { TrendRadarDrawer } from '@/components/trends/trend-radar-drawer';
import { LiveAlertsDrawer } from '@/components/alerts/live-alerts-drawer';

// Dynamically import the 3D canvas scene to avoid SSR issues
const HeroScene = dynamic(() => import('@/components/3d/hero-scene').then((mod) => mod.HeroScene), {
  ssr: false,
});

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 25 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } },
};

export function LandingView() {
  return (
    <div className="landing-page relative min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-accent-500/30 overflow-x-hidden">
      
      {/* 3D Instanced Candlestick Background Scene */}
      <HeroScene />

      {/* Top Header Navigation */}
      <LandingHeader />

      {/* Main Page Body Container */}
      <div className="relative z-10 w-full space-y-24 sm:space-y-32 pb-16">
        
        {/* ========================================================================= */}
        {/* HERO SECTION */}
        {/* ========================================================================= */}
        <section className="pt-12 sm:pt-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="text-center space-y-6 max-w-4xl mx-auto"
          >
            {/* Live Status Pill */}
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3.5 py-1 text-2xs font-mono text-accent-300 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-buy-500 animate-pulse" />
              <span>SOLANA MAINNET LIVE • ENGINE V2.4</span>
              <span className="text-neutral-500">|</span>
              <span className="text-buy-400 font-bold">18ms EXECUTION</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 variants={fadeInUp} className="font-heading text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
              Zero Blind Spots <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-accent-400 via-sky-300 to-buy-400 bg-clip-text text-transparent">
                on Solana.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeInUp} className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-neutral-300 leading-relaxed font-sans drop-shadow-sm">
              Stop trading blind into fabricated volume and coordinated insider cabals. Sentinel dissects holder funding genealogies, filters wash cycles, maps executable liquidity depth, and routes MEV-protected fills in milliseconds.
            </motion.p>

            {/* Single CTA Container (Direct to /discover) */}
            <motion.div variants={fadeInUp} className="pt-3 flex flex-col items-center justify-center gap-3">
              <Link
                href="/discover"
                id="hero-enter-discover-btn"
                className="group relative inline-flex items-center gap-3.5 px-8 py-4 rounded-2xl bg-emerald-400 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-neutral-950 font-mono font-bold text-sm sm:text-base shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.65)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
              >
                {/* The Discover Pill indicator */}
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-950/20 text-neutral-950 border border-neutral-950/20 text-2xs uppercase tracking-wider font-extrabold">
                  <span className="h-2 w-2 rounded-full bg-neutral-950 animate-pulse" />
                  <span>DISCOVER</span>
                </div>

                <span className="tracking-tight text-neutral-950">Enter Discover Screener</span>
                <ArrowRight className="h-5 w-5 text-neutral-950 group-hover:translate-x-1.5 transition-transform duration-200" />
              </Link>

              {/* Supporting proof & reassurance */}
              <div className="flex items-center gap-2 text-2xs text-neutral-400 font-mono">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Instant access to 2,400+ verified Solana pairs</span>
                <span className="text-neutral-600">•</span>
                <span className="text-neutral-500">100% Non-custodial</span>
              </div>
            </motion.div>

            {/* Proof Counters Bar */}
            <motion.div
              variants={fadeInUp}
              className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto font-mono text-left"
            >
              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-750 backdrop-blur-sm">
                <p className="text-3xs uppercase text-neutral-400 font-semibold">24H Wash Vol Filtered</p>
                <p className="text-lg sm:text-xl font-black text-warn-400">$48.2M</p>
                <p className="text-3xs text-neutral-500 font-sans">Self-trading bot loops isolated</p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-750 backdrop-blur-sm">
                <p className="text-3xs uppercase text-neutral-400 font-semibold">Average Fill Latency</p>
                <p className="text-lg sm:text-xl font-black text-buy-400">18ms</p>
                <p className="text-3xs text-neutral-500 font-sans">Restricted local session keys</p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-750 backdrop-blur-sm">
                <p className="text-3xs uppercase text-neutral-400 font-semibold">Cabal Clusters Mapped</p>
                <p className="text-lg sm:text-xl font-black text-accent-300">1,420+</p>
                <p className="text-3xs text-neutral-500 font-sans">4-hop wallet genealogy graphs</p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-750 backdrop-blur-sm">
                <p className="text-3xs uppercase text-neutral-400 font-semibold">MEV Sandwich Loss</p>
                <p className="text-lg sm:text-xl font-black text-buy-400">0.00%</p>
                <p className="text-3xs text-neutral-500 font-sans">Direct private Jito validator bundles</p>
              </div>
            </motion.div>
          </motion.div>

          {/* ========================================================================= */}
          {/* CHART FLOW #1: INTERACTIVE LIVE TERMINAL PREVIEW */}
          {/* ========================================================================= */}
          <div className="mt-14 max-w-6xl mx-auto">
            <div className="text-center space-y-1 mb-6">
              <span className="text-3xs uppercase font-mono font-bold tracking-widest text-accent-400">
                CHART FLOW 01 • REAL-TIME TERMINAL CANVAS
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
                Inspect Real Price Action Beneath the Noise
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto font-sans">
                Interactive candlestick telemetry with live wash volume decomposition, cluster alerts, and real order tape flow.
              </p>
            </div>

            <TerminalChartFlow />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CHART FLOW #2: 4-STAGE INTELLIGENCE PIPELINE */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-10">
            <span className="text-3xs uppercase font-mono font-bold tracking-widest text-accent-400">
              CHART FLOW 02 • THE ARCHITECTURE
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white tracking-tight">
              The Sentinel Intelligence Pipeline Flow
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto font-sans">
              From raw 400ms Solana slot mempool packets to sub-20ms private execution, explore how Sentinel processes on-chain truth in four continuous stages.
            </p>
          </div>

          <PipelineFlowDiagram />
        </section>

        {/* ========================================================================= */}
        {/* CHART FLOW #3: FORENSIC CLUSTER RADAR (ATTACK VS MITIGATION) */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-10">
            <span className="text-3xs uppercase font-mono font-bold tracking-widest text-sell-400">
              CHART FLOW 03 • CABAL EXPOSURE
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white tracking-tight">
              Exposing the Sybil Cartel Before the Dump
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto font-sans">
              Token creators don&apos;t hold 50% in one public wallet anymore. They splinter it across 20 fresh addresses funded in the same 20-minute window. Toggle below to compare what retail sees versus what Sentinel reveals.
            </p>
          </div>

          <ClusterAttackFlow />
        </section>

        {/* ========================================================================= */}
        {/* CHART FLOW #4: SIMULATED EXIT DEPTH WATERFALL */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-10">
            <span className="text-3xs uppercase font-mono font-bold tracking-widest text-warn-400">
              CHART FLOW 04 • LIQUIDITY STRESS TEST
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white tracking-tight">
              Paper Liquidity vs. Simulated Executable Depth
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto font-sans">
              Test what happens when a $25K, $50K, or $100K market order hits the pool. See how Sentinel fragments trades across multiple AMM routes to prevent catastrophic slippage.
            </p>
          </div>

          <ExitabilityDepthFlow />
        </section>

        {/* ========================================================================= */}
        {/* LIVE TOKEN RADAR & MARKET SCREENER TABLE */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-10">
            <span className="text-3xs uppercase font-mono font-bold tracking-widest text-buy-400">
              MARKET INTELLIGENCE RADAR
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white tracking-tight">
              Live Verified On-Chain Screener
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto font-sans">
              Real-time monitoring across Solana&apos;s most active pairs. Filter by wash-trading loops, cluster threat score, or net smart money flow.
            </p>
          </div>

          <LiveMarketRadar />
        </section>

        {/* ========================================================================= */}
        {/* COMPETITIVE COMPARISON TABLE */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <ComparisonTable />
        </section>

        {/* ========================================================================= */}
        {/* AI COPILOT & RISK CIRCUIT BREAKER FEATURE BANNER */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="rounded-3xl border border-neutral-700 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 p-8 sm:p-12 relative overflow-hidden shadow-2xl">
            {/* Ambient Background Gradient Glows */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-7 space-y-4 font-mono">
                <span className="px-3 py-1 rounded-full text-3xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  SENTINEL AI CO-PILOT & AUDIT AGENT
                </span>
                <h3 className="font-heading text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Natural Language Forensics. Ask Anything About Any Mint.
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
                  Audit smart contract authorities, query creator launch history, simulate large trade slippage, and review wallet clustering in plain English. Powered by dedicated Gemini financial reasoning models grounded directly in real Solana transaction graphs.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Button
                    href="/ai"
                    variant="cyber"
                    size="md"
                    rightIcon={<Sparkles className="h-4 w-4 ml-1" />}
                  >
                    Open Sentinel AI Copilot
                  </Button>
                  <Button
                    href="/help"
                    variant="ghost"
                    size="md"
                  >
                    View AI Documentation
                  </Button>
                </div>
              </div>

              {/* Simulated Conversational Prompt Card */}
              <div className="lg:col-span-5">
                <div className="p-5 rounded-2xl bg-neutral-950/90 border border-neutral-750 shadow-2xl space-y-3 font-mono text-2xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-neutral-400">
                    <Sparkles className="h-3.5 w-3.5 text-accent-400" />
                    <span className="text-white font-bold">Sentinel AI Query</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
                    <span className="text-neutral-500">You: </span>
                    &ldquo;Audit 8wJp...11kQ for coordinated wallet dumps and wash trading.&rdquo;
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-900/80 border border-accent-500/30 text-neutral-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-accent-400 font-bold">AI Analysis Result:</span>
                      <span className="px-1.5 py-0.2 rounded bg-sell-500/20 text-sell-300 text-3xs font-bold">
                        HIGH RISK
                      </span>
                    </div>
                    <p className="text-3xs text-neutral-300 font-sans leading-relaxed">
                      &bull; Creator deployed 4 tokens previously; all 4 were drained within 48h.<br />
                      &bull; 24h volume of $6.2M decomposes to 61% circular self-trades.<br />
                      &bull; 14 top wallets share an exchange deposit progenitor.<br />
                      <strong>Recommendation: Do not enter position.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FREQUENTLY ASKED QUESTIONS */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <FaqSection />
        </section>

        {/* ========================================================================= */}
        {/* FINAL CLIMAX CTA */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-6">
          <div className="p-10 sm:p-16 rounded-3xl border border-neutral-700 bg-gradient-to-b from-neutral-900 via-neutral-900/90 to-neutral-950 shadow-2xl backdrop-blur-xl space-y-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-radial-gradient from-accent-500/10 to-transparent pointer-events-none" />

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-buy-500/10 text-buy-400 border border-buy-500/30 text-2xs font-mono font-bold">
              <Zap className="h-3.5 w-3.5" />
              <span>READY FOR DEPLOYMENT</span>
            </div>

            <h2 className="font-heading text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Trade With Clarity. <br />
              <span className="text-accent-400">Not Hope.</span>
            </h2>

            <p className="text-xs sm:text-base text-neutral-300 max-w-xl mx-auto font-sans leading-relaxed">
              Join thousands of serious Solana on-chain traders who refuse to donate liquidity to insider cartels and deceptive wash-trading loops.
            </p>

            <div className="pt-2 flex items-center justify-center">
              <Button
                href="/discover"
                variant="buy"
                size="lg"
                className="px-12 py-4 font-mono text-sm sm:text-base font-bold shadow-glow-buy hover:scale-105 active:scale-95 transition-transform"
                rightIcon={<ArrowRight className="h-4 w-4 ml-2" />}
              >
                Enter Screener Now
              </Button>
            </div>

            <p className="text-3xs text-neutral-500 font-mono pt-4">
              Non-custodial • 100% On-chain Verified • Sub-20ms Routing • Jito MEV Protection
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <LandingFooter />

      {/* Persistent Bottom Status Bar - Fixed at bottom just like header stays at top */}
      <FooterStatusBar layout="page" />

      {/* Global Modals & Drawers */}
      <WalletModal />
      <HotkeyModal />
      <ExecutionConsole />
      <XTrackerDrawer />
      <TrendRadarDrawer />
      <LiveAlertsDrawer />
    </div>
  );
}
