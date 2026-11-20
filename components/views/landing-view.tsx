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
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhivexLogoLockup } from '@/components/ui/phivex-logo';
import dynamic from 'next/dynamic';

// Modular Landing Sections
import { LandingHeader } from '@/components/landing/landing-header';
import { TerminalChartFlow } from '@/components/landing/terminal-chart-flow';
import { PipelineFlowDiagram } from '@/components/landing/pipeline-flow-diagram';
import { InsightXShowcase } from '@/components/landing/insightx-showcase';
import { ExitabilityDepthFlow } from '@/components/landing/exitability-depth-flow';
import { LiveMarketRadar } from '@/components/landing/live-market-radar';
import { ComparisonTable } from '@/components/landing/comparison-table';
import { FaqSection } from '@/components/landing/faq-section';
import { LandingFooter } from '@/components/landing/landing-footer';
import { WalletModal } from '@/components/layout/wallet-modal';
import { HotkeyModal } from '@/components/layout/hotkey-modal';
import { ExecutionConsole } from '@/components/layout/execution-console';
import { XTrackerDrawer } from '@/components/x-tracker/x-tracker-drawer';
import { TrendRadarDrawer } from '@/components/trends/trend-radar-drawer';
import { LiveAlertsDrawer } from '@/components/alerts/live-alerts-drawer';

// Dynamically import the 3D canvas scene with resilience against dev chunk timeouts
const HeroScene = dynamic(
  () =>
    import('@/components/3d/hero-scene')
      .then((mod) => mod.HeroScene)
      .catch(async (firstErr) => {
        console.warn('HeroScene 3D background initial load delayed or failed, retrying...', firstErr);
        try {
          await new Promise((resolve) => setTimeout(resolve, 800));
          const retryMod = await import('@/components/3d/hero-scene');
          return retryMod.HeroScene;
        } catch (retryErr) {
          console.warn('HeroScene 3D background chunk unavailable, falling back to ambient gradient:', retryErr);
          return function HeroFallback() {
            return (
              <div
                aria-hidden="true"
                className="absolute inset-0 w-full h-full pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-[#070709] to-[#070709]"
              />
            );
          };
        }
      }),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-[#070709] to-[#070709]"
      />
    ),
  }
);

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
    <div className="landing-page relative min-h-screen bg-[#06070B] text-[#F7F8F9] font-sans selection:bg-[#526FFF]/35 overflow-x-hidden">
      {/* Dual Atmospheric Radial Lighting (Electric Cobalt + Emerald) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[540px] bg-[radial-gradient(ellipse_55%_45%_at_50%_0%,rgba(82,111,255,0.14),transparent),radial-gradient(ellipse_40%_35%_at_75%_15%,rgba(47,227,172,0.08),transparent)] z-0"
      />
      
      {/* 3D Instanced Candlestick Background Scene */}
      <HeroScene />

      {/* Top Header Navigation */}
      <LandingHeader />

      {/* Main Page Body Container */}
      <div className="relative z-10 w-full space-y-24 sm:space-y-32 pb-16">
        
        {/* ========================================================================= */}
        {/* HERO SECTION */}
        {/* ========================================================================= */}
        <section className="pt-10 sm:pt-16 px-4 sm:px-6 max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="text-center space-y-6 max-w-4xl mx-auto"
          >
            {/* Official Brand Lockup */}
            <motion.div variants={fadeInUp} className="flex justify-center">
              <PhivexLogoLockup size="md" />
            </motion.div>

            {/* Live Status Pill */}
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 rounded-full border border-[#222634] bg-[#0D1015]/90 px-3.5 py-1 text-[11px] font-mono text-[#C8C9D1] backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
              <span className="flex h-2 w-2 rounded-full bg-[#2FE3AC] animate-pulse shadow-[0_0_8px_#2FE3AC]" />
              <span className="text-[#F7F8F9] font-semibold">SOLANA + ROBINHOOD L2</span>
              <span className="text-[#32374A]">|</span>
              <span className="text-[#2FE3AC] font-semibold">MEV-PROTECTED EXECUTION</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 variants={fadeInUp} className="font-heading text-4xl sm:text-6xl lg:text-7xl font-black text-[#F7F8F9] tracking-[-0.04em] leading-[1.03]">
              The High-Frequency Terminal <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-[#52C5FF] via-[#526FFF] to-[#2FE3AC] bg-clip-text text-transparent">
                Built for On-Chain Truth.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeInUp} className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-[#C8C9D1] leading-relaxed font-sans">
              Stop trading blind into fabricated volume and coordinated insider cabals. Phivex dissects holder funding genealogies, filters circular wash cycles, and routes private validator fills with zero toxic slippage.
            </motion.p>

            {/* Action CTAs: Enter Screener + Open Trade Terminal */}
            <motion.div variants={fadeInUp} className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/discover"
                id="hero-enter-screener-btn"
                className="group inline-flex items-center gap-2.5 px-7 py-3 rounded-full bg-[#415CF2] hover:bg-[#526FFF] text-white font-semibold text-sm shadow-[0_0_24px_rgba(65,92,242,0.42)] border border-[#6683FF]/50 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <span>Enter Screener</span>
                <ArrowRight className="h-4 w-4 text-white group-hover:translate-x-1 transition-transform duration-150" />
              </Link>
              <Link
                href="/trade"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0D1015]/90 hover:bg-[#151821] border border-[#222634] hover:border-[#32374A] text-[#F7F8F9] font-semibold text-sm backdrop-blur-md transition-all duration-150 active:scale-[0.98]"
              >
                <span>Open Pro Terminal</span>
              </Link>
            </motion.div>

            {/* Core Capability Pillars */}
            <motion.div
              variants={fadeInUp}
              className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-3.5 max-w-4xl mx-auto font-mono text-left"
            >
              <div className="p-3.5 rounded-[10px] bg-[#0D1015]/90 border border-[#1E222D] backdrop-blur-sm space-y-1 hover:border-[#526FFF]/40 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase text-[#828598] font-semibold tracking-wider">Volume Integrity</p>
                  <Activity className="h-3.5 w-3.5 text-[#FFB224]" />
                </div>
                <p className="text-base sm:text-lg font-bold text-[#FFB224] tracking-tight">Wash Detection</p>
                <p className="text-[11px] text-[#828598] font-sans leading-relaxed">Separates genuine liquidity from circular bot loops</p>
              </div>

              <div className="p-3.5 rounded-[10px] bg-[#0D1015]/90 border border-[#1E222D] backdrop-blur-sm space-y-1 hover:border-[#2FE3AC]/40 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase text-[#828598] font-semibold tracking-wider">Execution Speed</p>
                  <Zap className="h-3.5 w-3.5 text-[#2FE3AC]" />
                </div>
                <p className="text-base sm:text-lg font-bold text-[#2FE3AC] tracking-tight">Sub-Second Fills</p>
                <p className="text-[11px] text-[#828598] font-sans leading-relaxed">Local session keys and direct validator routing</p>
              </div>

              <div className="p-3.5 rounded-[10px] bg-[#0D1015]/90 border border-[#1E222D] backdrop-blur-sm space-y-1 hover:border-[#526FFF]/40 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase text-[#828598] font-semibold tracking-wider">Cluster Forensics</p>
                  <Layers className="h-3.5 w-3.5 text-[#52C5FF]" />
                </div>
                <p className="text-base sm:text-lg font-bold text-[#52C5FF] tracking-tight">Live Cluster Map</p>
                <p className="text-[11px] text-[#828598] font-sans leading-relaxed">Live wallet clusters, sniper &amp; bundler supply, and entity labels</p>
              </div>

              <div className="p-3.5 rounded-[10px] bg-[#0D1015]/90 border border-[#1E222D] backdrop-blur-sm space-y-1 hover:border-[#2FE3AC]/40 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase text-[#828598] font-semibold tracking-wider">Mempool Defense</p>
                  <ShieldCheck className="h-3.5 w-3.5 text-[#526FFF]" />
                </div>
                <p className="text-base sm:text-lg font-bold text-[#8EA2FF] tracking-tight">Zero Sandwiching</p>
                <p className="text-[11px] text-[#828598] font-sans leading-relaxed">Direct private Jito bundles bypass public mempools</p>
              </div>
            </motion.div>
          </motion.div>

          {/* ========================================================================= */}
          {/* TERMINAL CANVAS SHOWCASE */}
          {/* ========================================================================= */}
          <div className="mt-14 max-w-6xl mx-auto">
            <div className="text-center space-y-1 mb-6">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-emerald-400">
                LIVE TERMINAL ENGINE // REAL-TIME EXECUTION CANVAS
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
        {/* SECTION 2: 4-STAGE INTELLIGENCE PIPELINE */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <PipelineFlowDiagram />
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: INTERACTIVE HOLDER CLUSTER ENGINE */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-10">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-sky-400">
              PHIVEX CLUSTER ENGINE // WALLET CLUSTER &amp; RISK INTELLIGENCE
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white tracking-tight">
              Interactive Holder Cluster Maps Built Into Phivex
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto font-sans">
              Built-in real-time holder cluster intelligence across Solana and Robinhood Chain. Switch tokens or paste any contract address below to inspect wallet clusters, distribution inequality, snipers, bundlers, and entity labels live.
            </p>
          </div>

          <InsightXShowcase />
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: SIMULATED EXIT DEPTH WATERFALL */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-10">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-amber-400">
              LIQUIDITY SIMULATOR // SLIPPAGE STRESS TEST
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white tracking-tight">
              Paper Liquidity vs. Simulated Executable Depth
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto font-sans">
              Simulate high-volume market exits before deploying capital. Observe multi-pool fragmentation, price impact curves, and private validator bundle execution.
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
                  PHIVEX AI CO-PILOT & AUDIT AGENT
                </span>
                <h3 className="font-heading text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Natural Language Forensics. Ask Anything About Any Mint.
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
                  Audit smart contract authorities, query creator launch history, simulate large trade slippage, and review wallet clustering in plain English. Powered by dedicated financial reasoning models grounded directly in real Solana transaction graphs.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Button
                    href="/ai"
                    variant="cyber"
                    size="md"
                    rightIcon={<Sparkles className="h-4 w-4 ml-1" />}
                  >
                    Open Phivex AI Copilot
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
                    <span className="text-white font-bold">Phivex AI Query</span>
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
