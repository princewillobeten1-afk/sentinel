'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Flame,
  Zap,
  BarChart2,
  Copy,
  Check,
  ExternalLink,
  Music,
  Newspaper,
  Sparkles,
  TrendingUp,
  Share2,
} from 'lucide-react';
import { useAppActions } from '@/lib/store';
import type { TrendItem, TrendSource } from '@/lib/trends/types';
import { clsx } from 'clsx';

interface TrendCardProps {
  trend: TrendItem;
  layout?: 'compact' | 'expanded';
}

export function TrendCard({ trend, layout = 'compact' }: TrendCardProps) {
  const router = useRouter();
  const { setQuickBuyOpen, setSelectedToken } = useAppActions();
  const [copied, setCopied] = useState(false);

  const { associatedToken: token } = trend;

  const handleCopyMint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token?.mint) return;
    navigator.clipboard.writeText(token.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    setQuickBuyOpen(true, {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      price: String(token.priceUsd),
      mcap: String(token.marketCapUsd),
      liquidity: '50000',
    });
  };

  const handleOpenChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    setSelectedToken({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      priceUsd: String(token.priceUsd),
      marketCapUsd: String(token.marketCapUsd),
      liquidityUsd: '50000',
      chain: 'solana',
    });
    router.push(`/trade?token=${token.mint}`);
  };

  const formatMarketCap = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  const getSourceConfig = (src: TrendSource) => {
    switch (src) {
      case 'tiktok':
        return {
          label: 'TikTok Viral',
          icon: Music,
          badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          dotColor: 'bg-rose-400',
        };
      case 'x':
        return {
          label: '𝕏 Trending',
          icon: Sparkles,
          badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          dotColor: 'bg-sky-400',
        };
      case 'news':
        return {
          label: 'Global News',
          icon: Newspaper,
          badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dotColor: 'bg-amber-400',
        };
      case 'culture':
      default:
        return {
          label: 'Web Lore',
          icon: TrendingUp,
          badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          dotColor: 'bg-purple-400',
        };
    }
  };

  const sourceConfig = getSourceConfig(trend.source);
  const SourceIcon = sourceConfig.icon;

  return (
    <article className="rounded-xl border border-sentinel-800 bg-sentinel-900/70 p-3 sm:p-3.5 hover:border-sentinel-700/80 hover:bg-sentinel-900/90 transition shadow-sm space-y-2.5">
      {/* Header: Source, Time, Virality Metric */}
      <div className="flex items-center justify-between gap-2 text-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Platform Badge */}
          <span
            className={clsx(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-mono font-bold uppercase border',
              sourceConfig.badgeColor
            )}
          >
            <SourceIcon className="w-2.5 h-2.5" />
            <span>{sourceConfig.label}</span>
          </span>

          {/* Time Ago */}
          <span className="text-slate-400 text-3xs font-mono">{trend.timeAgo}</span>

          {/* Metrics snippet if available */}
          {trend.metrics.impressions && (
            <span className="hidden xs:inline-block px-1.5 py-0.2 rounded bg-white/[0.04] text-slate-300 text-3xs font-mono border border-white/[0.06]">
              {trend.metrics.impressions}
            </span>
          )}
        </div>

        {/* Virality Score */}
        <div className="flex items-center gap-1 shrink-0 font-mono text-3xs">
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 border',
              trend.viralityScore >= 95
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : trend.viralityScore >= 90
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            )}
          >
            <Flame className="w-2.5 h-2.5 fill-current" />
            <span>{trend.viralityScore} Virality</span>
          </span>
        </div>
      </div>

      {/* Trend Title & Narrative Breakdown */}
      <div>
        <h3 className="font-bold text-sm text-white leading-snug group-hover:text-amber-300 transition">
          {trend.title}
        </h3>
        <p className="mt-1 text-2xs text-slate-300 leading-relaxed line-clamp-2">
          {trend.summary}
        </p>
      </div>

      {/* Narrative Catalyst Callout */}
      <div className="rounded-lg bg-black/40 border border-white/[0.06] p-2 text-3xs text-slate-400 flex items-start gap-1.5">
        <Sparkles className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
        <span className="leading-tight">
          <strong className="text-slate-200">Viral Catalyst: </strong>
          {trend.catalyst}
        </span>
      </div>

      {/* Attached Solana Meme Token Card */}
      <div className="rounded-xl border border-sentinel-700/80 bg-sentinel-950 p-2.5 flex items-center justify-between gap-2.5 shadow-inner">
        {/* Token Info Left */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar + Launchpad Badge */}
          <div className="relative shrink-0">
            <img
              src={token.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${token.symbol}`}
              alt={token.symbol}
              className="w-8 h-8 rounded-lg object-cover bg-sentinel-900 border border-white/10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${token.symbol}`;
              }}
            />
            {token.launchpad && token.launchpad !== 'unknown' && (
              <span
                className={clsx(
                  'absolute -bottom-1 -right-1 px-1 py-0.2 rounded font-mono text-4xs font-bold uppercase border scale-75',
                  token.launchpad === 'pump.fun'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                    : 'bg-sky-950 text-sky-300 border-sky-700/60'
                )}
              >
                {token.launchpad === 'pump.fun' ? 'PUMP' : 'RAY'}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">${token.symbol}</span>
              <span className="text-3xs text-slate-400 truncate max-w-[80px] hidden sm:inline">
                {token.name}
              </span>
              <button
                onClick={handleCopyMint}
                className="text-slate-500 hover:text-white transition p-0.5"
                title="Copy token mint"
              >
                {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-3xs font-mono">
              <span className="text-slate-300 font-bold">{formatMarketCap(token.marketCapUsd)}</span>
              <span
                className={clsx(
                  'font-semibold',
                  token.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {token.priceChange24h >= 0 ? '+' : ''}
                {token.priceChange24h}%
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Right */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Buy Button */}
          <button
            onClick={handleQuickBuy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 active:scale-95 transition font-mono text-2xs font-bold shadow-sm"
            title={`Quick Buy $${token.symbol}`}
          >
            <Zap className="w-3 h-3 fill-current" />
            <span>Buy 0.5</span>
          </button>

          {/* Chart Button */}
          <button
            onClick={handleOpenChart}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-sentinel-850 hover:bg-sentinel-800 border border-sentinel-700 text-slate-300 hover:text-white transition font-mono text-3xs"
            title="Open Token Chart"
          >
            <BarChart2 className="w-3 h-3 text-sky-400" />
            <span>Chart</span>
          </button>
        </div>
      </div>
    </article>
  );
}
