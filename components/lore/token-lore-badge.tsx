'use client';

import React, { useState, useRef } from 'react';
import {
  BookOpen,
  Award,
  Flame,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useTokenLore } from '@/lib/hooks/use-token-lore';
import { TokenLoreDrawer } from './token-lore-drawer';

export interface TokenLoreBadgeProps {
  mint: string;
  symbol?: string;
  name?: string;
  pairCreatedAt?: number;
  marketCapUsd?: number;
  variant?: 'compact' | 'full';
  className?: string;
}

export function TokenLoreBadge({
  mint,
  symbol,
  name,
  pairCreatedAt,
  marketCapUsd,
  variant = 'compact',
  className = '',
}: TokenLoreBadgeProps) {
  const { lore, isLoading } = useTokenLore(mint, {
    symbol,
    name,
    pairCreatedAt,
    marketCapUsd,
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  };

  const isOg = lore?.runnerStatus.isFirstRunner ?? true;
  const runnerRank = lore?.runnerStatus.runnerRank ?? 1;
  const flippedOg = lore?.runnerStatus.flippedOg ?? false;

  return (
    <>
      <div
        className={`relative inline-block ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className={`group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-xs transition-all duration-150 select-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
            flippedOg
              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
              : isOg
              ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
              : 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.15)]'
          }`}
          title="Click or tap to view full Token Lore & Narrative"
          aria-label="View Token Lore and Narrative"
        >
          <BookOpen className="w-3 h-3 shrink-0 text-current" />
          <span className="font-extrabold tracking-tight">Lore</span>

          {/* Runner Status Indicator */}
          {isLoading ? (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
          ) : isOg ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold font-mono px-1 py-px rounded bg-amber-400/20 text-amber-200">
              <Award className="w-2.5 h-2.5 text-amber-300" />
              <span>OG Runner</span>
            </span>
          ) : flippedOg ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold font-mono px-1 py-px rounded bg-rose-400/20 text-rose-200">
              <Flame className="w-2.5 h-2.5 text-rose-300" />
              <span>Flipped OG</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold font-mono px-1 py-px rounded bg-violet-400/20 text-violet-200">
              <span>Runner #{runnerRank}</span>
            </span>
          )}
        </button>

        {/* Desktop Hover Floating Preview Popover */}
        {isHovered && lore && (
          <div
            className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 z-50 w-80 max-w-[90vw] p-3.5 rounded-xl bg-[#090d16] border border-slate-700/80 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header with Category & Runner status */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                {lore.narrativeCategory}
              </span>
              <span
                className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded ${
                  isOg
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                }`}
              >
                {lore.runnerStatus.badgeLabel}
              </span>
            </div>

            {/* Headline */}
            <h4 className="text-xs font-bold text-white mt-2 leading-tight">
              {lore.headline}
            </h4>

            {/* Lore snippet */}
            <p className="text-[11px] text-slate-300 mt-1.5 line-clamp-3 leading-relaxed">
              {lore.loreSummary}
            </p>

            {/* Runner Cohort Insight */}
            <div className="mt-2.5 p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[10px] text-slate-300 flex items-start gap-1.5">
              <Award className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-tight">
                {lore.runnerStatus.explanation}
              </span>
            </div>

            {/* Why It's Flying Snippet */}
            {lore.whyItsFlying && lore.whyItsFlying.length > 0 && (
              <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">{lore.whyItsFlying[0]}</span>
              </div>
            )}

            {/* Action CTA */}
            <button
              onClick={() => {
                setIsHovered(false);
                setIsDrawerOpen(true);
              }}
              className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <span>Read Full Lore Backstory</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Full Lore Drawer for Desktop Click & Mobile Tap */}
      <TokenLoreDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        lore={lore}
        isLoading={isLoading}
      />
    </>
  );
}
