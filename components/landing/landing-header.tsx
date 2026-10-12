'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, ShieldCheck, Activity, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingHeader() {
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-xl px-4 sm:px-8 py-3.5"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400 border border-accent-500/30 shadow-glow transition-all duration-300 group-hover:scale-105 group-hover:border-accent-400/60 group-hover:bg-accent-500/20">
            <Zap className="h-4.5 w-4.5 fill-accent-400/20 text-accent-400" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-buy-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-buy-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-3xs font-mono font-bold tracking-[0.25em] text-neutral-400 uppercase">PROJECT</span>
              <span className="text-3xs font-mono px-1 py-0.2 rounded bg-accent-500/10 text-accent-300 border border-accent-500/20">SOLANA</span>
            </div>
            <h1 className="font-heading text-sm font-black tracking-wider text-neutral-100 group-hover:text-white transition-colors">
              SENTINEL
            </h1>
          </div>
        </Link>

        {/* Live Network & System Status Badge */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-neutral-400">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-900/90 border border-neutral-800">
            <span className="h-2 w-2 rounded-full bg-buy-500 animate-pulse" />
            <span className="text-neutral-300 font-medium">Solana Mainnet</span>
            <span className="text-neutral-600">|</span>
            <span className="text-buy-400 font-semibold">2,840 TPS</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-900/90 border border-neutral-800">
            <Activity className="h-3.5 w-3.5 text-accent-400" />
            <span className="text-neutral-300">Route Latency:</span>
            <span className="text-accent-300 font-semibold">18ms</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-900/90 border border-neutral-800">
            <ShieldCheck className="h-3.5 w-3.5 text-buy-400" />
            <span className="text-neutral-300">Jito Anti-MEV:</span>
            <span className="text-buy-300 font-semibold">Active</span>
          </div>
        </div>

        {/* Navigation & Action CTA: ONLY ONE PRIMARY BUTTON TO DISCOVER */}
        <div className="flex items-center gap-3">
          <Link
            href="/discover"
            className="text-xs font-mono text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-neutral-850 transition-colors"
          >
            Screener
          </Link>
          <Link
            href="/ai"
            className="hidden sm:inline-flex text-xs font-mono text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-neutral-850 transition-colors"
          >
            AI Copilot
          </Link>
          <Link
            href="/help"
            className="hidden sm:inline-flex text-xs font-mono text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-neutral-850 transition-colors"
          >
            Docs
          </Link>
          
          {/* THE SINGLE OPT-IN CTA BUTTON */}
          <Button
            href="/discover"
            variant="buy"
            size="sm"
            className="font-mono text-xs font-bold shadow-glow-buy transition-all duration-200 hover:scale-105 active:scale-95"
            rightIcon={<ArrowRight className="h-3.5 w-3.5 ml-1" />}
          >
            Launch Screener
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
