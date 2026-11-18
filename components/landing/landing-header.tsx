'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, ShieldCheck, Activity, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhivexLogoMark } from '@/components/ui/phivex-logo';
import { useMarketSummary } from '@/lib/hooks/use-market-summary';

export function LandingHeader() {
  const { marketSummary } = useMarketSummary();

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-50 border-b border-[#1E222D] bg-[#06070B]/90 backdrop-blur-xl px-4 sm:px-8 py-3"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <PhivexLogoMark size="sm" className="group-hover:scale-105 group-hover:border-[#526FFF]/60 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2FE3AC] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2FE3AC]" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold tracking-[0.25em] text-[#828598] uppercase">INTELLIGENCE FIRST</span>
            </div>
            <h1 className="font-heading text-xs sm:text-sm font-black tracking-[0.14em] text-[#F7F8F9] group-hover:text-[#8EA2FF] transition-colors">
              PHIVEX <span className="text-[10px] text-[#525866] font-mono font-normal tracking-normal">{'//'} TERMINAL</span>
            </h1>
          </div>
        </Link>

        {/* Live Network & System Status Badge (Axiom Style) */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
          {/* Solana Mainnet Live Metric */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-[6px] bg-[#0D1015]/90 border border-[#1E222D]">
            <span className="h-2 w-2 rounded-full bg-[#2FE3AC] animate-pulse" />
            <span className="text-[#C8C9D1] font-medium">Mainnet</span>
            {marketSummary?.solPriceUsd ? (
              <>
                <span className="text-[#32374A]">|</span>
                <span className="text-[#828598]">SOL:</span>
                <span className="text-[#F7F8F9] font-semibold tabular-nums">${marketSummary.solPriceUsd.toFixed(2)}</span>
                {marketSummary.solChange24h !== null && (
                  <span className={`text-[11px] font-semibold tabular-nums ${marketSummary.solChange24h >= 0 ? 'text-[#2FE3AC]' : 'text-[#EC397A]'}`}>
                    {marketSummary.solChange24h >= 0 ? `+${marketSummary.solChange24h.toFixed(1)}%` : `${marketSummary.solChange24h.toFixed(1)}%`}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-[#32374A]">|</span>
                <span className="text-[#828598]">Cluster:</span>
                <span className="text-[#2FE3AC] font-semibold">Active</span>
              </>
            )}
          </div>

          {/* Jito Dynamic Routing */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-[6px] bg-[#0D1015]/90 border border-[#1E222D] text-[#828598]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#2FE3AC]" />
            <span className="text-[#C8C9D1]">Jito Anti-MEV:</span>
            <span className="text-[#2FE3AC] font-semibold">Protected</span>
          </div>

          {/* Quick CA / Token Search hint */}
          <Link
            href="/discover"
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1015]/80 border border-[#1E222D] text-[#828598] hover:text-[#F7F8F9] hover:border-[#526FFF]/40 transition-all cursor-pointer"
          >
            <span className="text-[#828598]">Search CA / Pair</span>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-[#151821] text-[#C8C9D1] border border-[#222634] font-mono">
              ⌘K
            </kbd>
          </Link>
        </div>

        {/* Navigation & Action CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/discover"
            className="text-xs font-mono text-[#C8C9D1] hover:text-[#F7F8F9] px-3 py-1.5 rounded-[6px] hover:bg-[#11141B] transition-colors"
          >
            Screener
          </Link>
          <Link
            href="/ai"
            className="hidden sm:inline-flex text-xs font-mono text-[#828598] hover:text-[#F7F8F9] px-3 py-1.5 rounded-[6px] hover:bg-[#11141B] transition-colors"
          >
            AI Copilot
          </Link>
          <Link
            href="/help"
            className="hidden md:inline-flex text-xs font-mono text-[#828598] hover:text-[#F7F8F9] px-3 py-1.5 rounded-[6px] hover:bg-[#11141B] transition-colors"
          >
            Docs
          </Link>
          
          {/* High-Impact Terminal CTA Button */}
          <Button
            href="/discover"
            variant="primary"
            size="sm"
            className="rounded-full text-xs font-semibold bg-[#415CF2] hover:bg-[#526FFF] text-white border border-[#6683FF]/50 shadow-[0_0_20px_rgba(65,92,242,0.38)] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] px-4 py-1.5"
            rightIcon={<ArrowRight className="h-3.5 w-3.5 ml-1" />}
          >
            Launch Terminal
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
