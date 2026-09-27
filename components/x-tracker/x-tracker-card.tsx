'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ExternalLink,
  CheckCircle2,
  Heart,
  MessageCircle,
  TrendingUp,
  Zap,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import type { XTrackerCall } from '@/lib/x-tracker/types';
import { useXTrackerStore } from '@/lib/store/x-tracker-store';
import { useAppActions } from '@/lib/store';
import { clsx } from 'clsx';

interface XTrackerCardProps {
  call: XTrackerCall;
}

function formatMcap(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatPosition(val: number): string {
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

export function XTrackerCard({ call }: XTrackerCardProps) {
  const router = useRouter();
  const { textSize } = useXTrackerStore();
  const { setQuickBuyOpen, setSelectedToken } = useAppActions();
  const { token, caller, metrics, socialMetrics, relativeTime, text, tweetUrl } = call;

  const tradeRoute = `/trade/solana/${token.mint}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Avoid triggering when clicking links or buttons
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) return;
    router.push(tradeRoute);
  };

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedToken({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.avatarUrl,
      chain: 'solana',
      priceUsd: String(token.priceUsd),
      marketCapUsd: String(metrics.currentMcap),
    });
    setQuickBuyOpen(true, {
      name: token.name,
      symbol: token.symbol,
      mint: token.mint,
      price: String(token.priceUsd),
      mcap: String(metrics.currentMcap),
      customAmountSol: 0.05,
      logoURI: token.avatarUrl,
      priceChange24h: metrics.pnlPercent,
    });
  };

  const isPositivePnl = metrics.pnlPercent >= 0;
  const isHighMultiplier = metrics.multiplier >= 1.5;

  return (
    <article
      onClick={handleCardClick}
      className={clsx(
        'group relative border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors cursor-pointer select-none',
        textSize === 'compact' ? 'p-2.5' : textSize === 'spacious' ? 'p-4' : 'p-3'
      )}
    >
      {/* Top Token & Multiplier Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Token Avatar with Solana Chain Badge */}
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-md overflow-hidden bg-sentinel-900 border border-white/10 flex items-center justify-center">
              {token.avatarUrl ? (
                <img
                  src={token.avatarUrl}
                  alt={token.symbol}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${token.mint}`;
                  }}
                />
              ) : (
                <span className="text-2xs font-bold text-slate-300">{token.symbol.slice(0, 3)}</span>
              )}
            </div>
            {/* Small Solana Logo Badge at bottom-right */}
            <div
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-black border border-sentinel-700 flex items-center justify-center shadow"
              title="Solana Network"
            >
              <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-purple-500 to-emerald-400" />
            </div>
          </div>

          {/* Symbol, Launchpad Icon, External Arrow & Timestamp */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-white text-xs sm:text-sm tracking-wide group-hover:text-sky-300 transition-colors">
                {token.symbol}
              </span>

              {/* Launchpad Pill Indicator */}
              {token.launchpad === 'pump.fun' ? (
                <span
                  className="inline-flex items-center px-1 py-0.2 rounded bg-emerald-950/60 border border-emerald-800/40 text-[10px] text-emerald-400"
                  title="Pump.fun Bonding Curve"
                >
                  💊
                </span>
              ) : (
                <span
                  className="inline-flex items-center px-1 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/40 text-[10px] text-cyan-400"
                  title="Raydium DEX"
                >
                  ⚡
                </span>
              )}

              {/* Direct Trade Link Arrow */}
              <Link
                href={tradeRoute}
                onClick={(e) => e.stopPropagation()}
                className="text-slate-500 hover:text-sky-400 transition-colors"
                title={`Trade ${token.symbol} on Sentinel`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>

              {/* Relative Timestamp */}
              <span className="text-2xs font-mono text-slate-500">{relativeTime}</span>
            </div>
          </div>
        </div>

        {/* Right: Multiplier Badge (Axiom style e.g. 1.0x or +75.6%) */}
        <div className="flex items-center gap-1 shrink-0">
          <div
            className={clsx(
              'px-2 py-0.5 rounded text-2xs font-mono font-bold transition',
              isHighMultiplier
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                : 'bg-emerald-950/50 border border-emerald-800/40 text-emerald-400'
            )}
          >
            {metrics.multiplier > 1.0 ? `+${metrics.pnlPercent.toFixed(1)}%` : `${metrics.multiplier.toFixed(1)}x`}
          </div>
        </div>
      </div>

      {/* Author / Caller Row */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-sentinel-800 border border-white/10">
          <img
            src={caller.avatarUrl}
            alt={caller.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${caller.handle}`;
            }}
          />
        </div>

        <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">{caller.name}</span>

        {/* Verified Blue Badge */}
        {caller.isVerified && (
          <span title="Verified Alpha Caller" className="inline-flex items-center">
            <CheckCircle2 className="w-3 h-3 text-sky-400 fill-sky-400/20 shrink-0" />
          </span>
        )}

        {/* Twitter Handle */}
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-0.5 text-2xs text-slate-500 hover:text-sky-400 transition-colors truncate max-w-[100px]"
          title={`View on X: ${caller.handle}`}
        >
          <span className="font-bold text-[10px]">𝕏</span>
          <span>{caller.handle}</span>
        </a>
      </div>

      {/* Tweet Body Content */}
      <p className="mt-1.5 text-xs text-slate-200 leading-snug line-clamp-2 select-text font-sans">
        {text}
      </p>

      {/* Bottom Metrics Bar (MC, Position, PnL, Likes, Replies) */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-1 text-2xs font-numeric text-slate-400">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {/* Market Cap */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-slate-500 font-medium">MC</span>
            <span className="font-bold text-white font-mono">{formatMcap(metrics.currentMcap)}</span>
          </div>

          {/* Caller Position Size */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-slate-500 font-medium">Position</span>
            <span className="font-bold text-white font-mono">{formatPosition(metrics.positionSizeUsd)}</span>
          </div>

          {/* Unrealized PnL */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-slate-500 font-medium">PnL</span>
            <span
              className={clsx(
                'font-bold font-mono',
                isPositivePnl ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {isPositivePnl ? '+' : ''}
              {metrics.pnlPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Social Engagement & Quick Buy Action */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span className="flex items-center gap-0.5" title="Likes">
              <Heart className="w-2.5 h-2.5" />
              <span>{socialMetrics.likes}</span>
            </span>
            <span className="flex items-center gap-0.5" title="Replies">
              <MessageCircle className="w-2.5 h-2.5" />
              <span>{socialMetrics.replies}</span>
            </span>
          </div>

          {/* Quick Buy Trigger */}
          <button
            onClick={handleQuickBuy}
            className="px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-semibold transition"
            title={`Quick Buy 0.05 SOL of ${token.symbol}`}
          >
            ⚡ Buy
          </button>
        </div>
      </div>
    </article>
  );
}
