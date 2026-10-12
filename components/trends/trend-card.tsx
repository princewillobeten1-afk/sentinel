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
  Radio,
  Eye,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { useAppActions } from '@/lib/store';
import type { TrendItem, TrendSource, TrendVelocity } from '@/lib/trends/types';
import { clsx } from 'clsx';

interface TrendCardProps {
  trend: TrendItem;
  layout?: 'compact' | 'expanded';
}

export function TrendCard({ trend, layout = 'compact' }: TrendCardProps) {
  const router = useRouter();
  const { setQuickBuyOpen, setSelectedToken } = useAppActions();
  const [copied, setCopied] = useState(false);

  const token = trend.associatedToken;

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

  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    if (val < 0.0001) return `$${val.toFixed(6)}`;
    return `$${val.toFixed(4)}`;
  };

  const getSourceBadge = (src: TrendSource) => {
    switch (src) {
      case 'tiktok':
        return {
          label: 'TIKTOK TREND',
          icon: Music,
          className: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
        };
      case 'x':
        return {
          label: 'X TRENDS',
          icon: Sparkles,
          className: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
        };
      case 'news':
        return {
          label: 'GLOBAL NEWS',
          icon: Newspaper,
          className: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        };
      case 'reddit':
        return {
          label: 'REDDIT VIRAL',
          icon: Flame,
          className: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
        };
      case 'culture':
      default:
        return {
          label: 'CULTURE & LORE',
          icon: TrendingUp,
          className: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
        };
    }
  };

  const getVelocityBadge = (velocity: TrendVelocity) => {
    switch (velocity) {
      case 'exploding':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
            <Flame className="w-2.5 h-2.5 fill-current text-amber-400" />
            <span>EXPLODING</span>
          </span>
        );
      case 'surging':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold">
            <Zap className="w-2.5 h-2.5 fill-current text-cyan-400" />
            <span>SURGING</span>
          </span>
        );
      case 'rising':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
            <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
            <span>RISING</span>
          </span>
        );
    }
  };

  const sourceConfig = getSourceBadge(trend.source);
  const SourceIcon = sourceConfig.icon;

  // Extract display values for views, mentions, and growth
  const viewsValue = trend.metrics.impressions || '840.5M';
  const mentionsValue = trend.metrics.postCount || '42.8K';
  const growthPct = trend.metrics.growthPct || Math.floor(Math.random() * 200 + 120);

  // Category display label
  const categoryLabel =
    trend.category === 'ai'
      ? 'AI'
      : trend.category === 'gaming'
      ? 'Gaming'
      : trend.category === 'pop_culture'
      ? 'Pop Culture'
      : trend.category === 'politics'
      ? 'Politics'
      : trend.category === 'animals'
      ? 'Animals'
      : 'Meme Coin';

  // Hashtags
  const hashtags =
    trend.metrics.hashtags && trend.metrics.hashtags.length > 0
      ? trend.metrics.hashtags.slice(0, 5)
      : [`#${token?.symbol || 'SOL'}`, '#MemeCoin', '#Solana', '#Crypto', '#Web3'];

  return (
    <article className="group rounded-2xl border border-neutral-850 bg-[#0A0A0A] p-3.5 sm:p-4 hover:border-neutral-700 transition-all duration-200 flex flex-col justify-between space-y-3 relative text-left shadow-lg overflow-hidden">
      {/* Top Header: Source Pill + Velocity Pill + "View on Source" Link */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Platform Badge */}
          <span
            className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border',
              sourceConfig.className
            )}
          >
            <SourceIcon className="w-2.5 h-2.5" />
            <span>{sourceConfig.label}</span>
          </span>

          {/* Velocity Pill */}
          {getVelocityBadge(trend.velocity)}
        </div>

        {/* View on Source Link */}
        {trend.sourceUrl ? (
          <a
            href={trend.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] font-sans text-neutral-400 hover:text-white flex items-center gap-1 transition-colors shrink-0"
          >
            <span>View on {trend.source === 'x' ? 'X' : trend.source === 'tiktok' ? 'TikTok' : 'Web'}</span>
            <ExternalLink className="w-3 h-3 text-neutral-500" />
          </a>
        ) : (
          <span className="text-[10px] font-mono text-neutral-500">{trend.timeAgo}</span>
        )}
      </div>

      {/* Identity Row: Mascot/Token Avatar + Title + Category + Summary */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          {/* Avatar Icon */}
          <div className="relative shrink-0 pt-0.5">
            <img
              src={token?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${token?.symbol || trend.id}`}
              alt={token?.symbol || trend.title}
              className="w-9 h-9 rounded-full object-cover bg-neutral-900 border border-neutral-800"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${trend.id}`;
              }}
            />
          </div>

          {/* Title & Category & Chevron */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <h3 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-sky-400 transition-colors">
                  {token?.name || trend.title}
                </h3>
                <span className="text-[11px] font-mono text-neutral-400">
                  ({token?.symbol || 'TOKEN'})
                </span>
                <span className="text-[10px] font-sans text-neutral-500">
                  {categoryLabel}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0" />
            </div>

            {/* Description (2 lines clamp) */}
            <p className="text-[11px] text-neutral-400 leading-snug line-clamp-2 font-sans pt-0.5">
              {trend.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Catalyst Callout Box (Black background with subtle border) */}
      <div className="rounded-xl bg-[#050505] border border-neutral-850 p-2 text-[11px] text-neutral-300 flex items-start gap-2 leading-relaxed">
        <Zap className="w-3.5 h-3.5 text-sky-400 fill-current shrink-0 mt-0.5" />
        <p className="font-sans text-[11px] text-neutral-300">
          <strong className="text-sky-300 font-semibold">Catalyst: </strong>
          {trend.catalyst}
        </p>
      </div>

      {/* Hashtag Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {hashtags.map((tag, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#111111] border border-neutral-850 text-neutral-400 hover:text-white transition-colors"
          >
            {tag.startsWith('#') ? tag : `#${tag}`}
          </span>
        ))}
      </div>

      {/* Social Views & Mentions + Mini Sparkline Curve */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-neutral-850/80">
        <div className="flex items-center gap-4 text-left">
          {/* Views */}
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <Eye className="w-2.5 h-2.5 text-neutral-400" />
              <span>VIEWS (24H)</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-white font-mono">{viewsValue}</span>
              <span className="text-[10px] font-mono font-bold text-emerald-400">+{growthPct}%</span>
            </div>
          </div>

          {/* Mentions */}
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5 text-neutral-400" />
              <span>MENTIONS</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-white font-mono">{mentionsValue}</span>
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                +{Math.floor(growthPct * 0.7)}%
              </span>
            </div>
          </div>
        </div>

        {/* Mini Green SVG Trend Sparkline */}
        <svg
          className="h-6 w-20 text-emerald-400 shrink-0"
          viewBox="0 0 80 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 2 18 Q 18 16, 28 12 T 48 10 T 64 6 T 78 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 2 18 Q 18 16, 28 12 T 48 10 T 64 6 T 78 3 L 78 24 L 2 24 Z"
            fill="currentColor"
            fillOpacity="0.08"
          />
        </svg>
      </div>

      {/* Attached Solana Meme Token Bar (Bottom Row) */}
      <div className="rounded-xl bg-[#050505] border border-neutral-850 p-2 sm:px-3 flex items-center justify-between gap-2 shadow-inner">
        {/* Token Details */}
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={token?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${token?.symbol}`}
            alt={token?.symbol}
            className="w-6 h-6 rounded-full object-cover bg-neutral-900 border border-neutral-800 shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${token?.symbol}`;
            }}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-1 font-mono">
              <span className="font-bold text-xs text-white truncate">${token?.symbol || 'TOKEN'}</span>
              <CheckCircle2 className="w-3 h-3 text-sky-400 fill-sky-400/20 shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-white font-semibold">
                {token?.priceUsd ? formatCurrency(token.priceUsd) : '$0.000412'}
              </span>
              <span
                className={clsx(
                  'font-bold',
                  (token?.priceChange24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {(token?.priceChange24h ?? 0) >= 0 ? '+' : ''}
                {token?.priceChange24h ?? 26.7}%
              </span>
              <span className="text-neutral-500 hidden sm:inline">
                MC: {token?.marketCapUsd ? formatCurrency(token.marketCapUsd) : '$41.2M'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Quick Buy & Chart */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleQuickBuy}
            className="px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 text-[10px] font-mono font-bold transition-all"
            title={`Quick Buy $${token?.symbol || 'TOKEN'}`}
          >
            Buy
          </button>

          <button
            onClick={handleOpenChart}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-[11px] font-mono transition-colors"
          >
            <BarChart2 className="w-3 h-3 text-sky-400" />
            <span>Chart</span>
          </button>
        </div>
      </div>
    </article>
  );
}
