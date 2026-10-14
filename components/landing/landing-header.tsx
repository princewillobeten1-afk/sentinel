'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, ShieldCheck, Activity, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMarketSummary } from '@/lib/hooks/use-market-summary';

export function LandingHeader() {
  const { marketSummary } = useMarketSummary();

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#070709]/85 backdrop-blur-xl px-4 sm:px-8 py-3"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-400/60 group-hover:bg-emerald-500/20">
            <Zap className="h-4 w-4 fill-emerald-400/20 text-emerald-400" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-neutral-400 uppercase">PROJECT</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-accent-500/10 text-accent-300 border border-accent-500/20 font-semibold">SOLANA</span>
            </div>
            <h1 className="font-heading text-xs sm:text-sm font-black tracking-wider text-white group-hover:text-emerald-400 transition-colors">
              SENTINEL <span className="text-[10px] text-neutral-500 font-mono font-normal">// TERMINAL</span>
            </h1>
          </div>
        </Link>

        {/* Live Network & System Status Badge (Axiom Style) */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
          {/* Solana Mainnet Live Metric */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-neutral-900/90 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-neutral-300 font-medium">Mainnet</span>
            {marketSummary?.solPriceUsd ? (
              <>
                <span className="text-neutral-600">|</span>
                <span className="text-neutral-400">SOL:</span>
                <span className="text-white font-bold tabular-nums">${marketSummary.solPriceUsd.toFixed(2)}</span>
                {marketSummary.solChange24h !== null && (
                  <span className={`text-[11px] font-semibold tabular-nums ${marketSummary.solChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {marketSummary.solChange24h >= 0 ? `+${marketSummary.solChange24h.toFixed(1)}%` : `${marketSummary.solChange24h.toFixed(1)}%`}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-neutral-600">|</span>
                <span className="text-neutral-400">Cluster:</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </>
            )}
          </div>

          {/* Jito Dynamic Routing */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-neutral-900/90 border border-white/[0.08] text-neutral-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-neutral-300">Jito Anti-MEV:</span>
            <span className="text-emerald-400 font-semibold">Protected</span>
          </div>

          {/* Quick CA / Token Search hint */}
          <Link
            href="/discover"
            className="flex items-center gap-2 px-3 py-1 rounded-md bg-neutral-900/60 border border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.15] transition-all cursor-pointer"
          >
            <span className="text-neutral-400">Search CA / Pair</span>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono">
              ⌘K
            </kbd>
          </Link>
        </div>

        {/* Navigation & Action CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/discover"
            className="text-xs font-mono text-neutral-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-neutral-850 transition-colors"
          >
            Screener
          </Link>
          <Link
            href="/ai"
            className="hidden sm:inline-flex text-xs font-mono text-neutral-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-neutral-850 transition-colors"
          >
            AI Copilot
          </Link>
          <Link
            href="/help"
            className="hidden md:inline-flex text-xs font-mono text-neutral-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-neutral-850 transition-colors"
          >
            Docs
          </Link>
          
          {/* High-Impact Terminal CTA Button */}
          <Button
            href="/discover"
            variant="buy"
            size="sm"
            className="font-mono text-xs font-bold bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-neutral-950 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_30px_rgba(16,185,129,0.55)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] px-3.5 py-1.5"
            rightIcon={<ArrowRight className="h-3.5 w-3.5 ml-1" />}
          >
            Launch Terminal
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
