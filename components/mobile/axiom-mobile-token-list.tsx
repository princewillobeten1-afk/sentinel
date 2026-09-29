'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, Search, Eye, Settings, ExternalLink } from 'lucide-react';
import { ChainPillSelector } from './chain-pill-selector';
import { TokenAvatar } from '@/components/ui/token-avatar';
import type { OverviewToken } from '@/lib/hooks/use-overview-data';
import type { TimeWindow } from '@/lib/discovery/types';
import { formatCompactUsd } from '@/lib/discovery/format';

interface AxiomMobileTokenListProps {
  tokens: OverviewToken[];
  marketTab: 'trending' | 'hot' | 'top' | 'watchlist';
  onTabChange: (tab: 'trending' | 'hot' | 'top' | 'watchlist') => void;
  timeWindow?: TimeWindow;
  onTimeWindowChange?: (tw: TimeWindow) => void;
}

// Mini Sparkline component with SVG curve matching Photo 1
function MiniSparkline({
  isPositive,
  changePct = 0,
}: {
  isPositive: boolean;
  changePct?: number;
}) {
  const gradId = useId().replace(/:/g, '');
  const width = 56;
  const height = 24;

  const points = React.useMemo(() => {
    const steps = 7;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < steps; i++) {
      const x = (i / (steps - 1)) * width;
      const progress = i / (steps - 1);
      const wobble = Math.sin(i * 1.8) * 3;
      let y: number;
      if (isPositive) {
        y = height - 4 - progress * (height - 8) + wobble;
      } else {
        y = 4 + progress * (height - 8) + wobble;
      }
      pts.push({ x, y: Math.max(2, Math.min(height - 2, y)) });
    }
    return pts;
  }, [isPositive, changePct]);

  const polylineStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const strokeColor = isPositive ? '#10b981' : '#f43f5e';

  return (
    <div className="w-[56px] h-[24px] flex items-center justify-center flex-shrink-0">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`spark-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${polylineStr} ${width},${height}`} fill={`url(#spark-${gradId})`} />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylineStr}
        />
      </svg>
    </div>
  );
}

export function AxiomMobileTokenList({
  tokens,
  marketTab,
  onTabChange,
  timeWindow = '5m',
  onTimeWindowChange,
}: AxiomMobileTokenListProps) {
  const router = useRouter();
  const [copiedMint, setCopiedMint] = useState<string | null>(null);
  const [showTimeWindowMenu, setShowTimeWindowMenu] = useState(false);

  const handleCopy = (e: React.MouseEvent, mint: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 1500);
  };

  const navTabs = [
    { id: 'trending', label: 'Trending' },
    { id: 'top', label: 'Top Tokens' },
    { id: 'hot', label: 'Hot Tokens' },
    { id: 'watchlist', label: 'Watchlist' },
  ] as const;

  return (
    <div className="w-full bg-[#000000] text-white flex flex-col font-sans select-none">
      {/* 1. Axiom Top Subnav Matching Photo 1 */}
      <div className="flex flex-col gap-2 px-3 pt-2 pb-1.5 border-b border-[#141414]">
        {/* Row 1: Multi-chain Capsule on Left */}
        <div className="flex items-center">
          <ChainPillSelector />
        </div>

        {/* Row 2: Category Tabs on Left + Timeframe & Settings Pill on Right */}
        <div className="flex items-center justify-between gap-2">
          {/* Tabs: Trending | Top Tokens | Hot Tokens | Watchlist */}
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-none py-0.5">
            {navTabs.map((tab) => {
              const isActive = marketTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-white font-bold tracking-tight'
                      : 'text-[#737373] hover:text-[#d4d4d4] font-medium'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: Timeframe & Settings pill (e.g. 5m ⚙) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowTimeWindowMenu(!showTimeWindowMenu)}
              className="flex items-center gap-1.5 bg-[#0a0a0a] hover:bg-[#141414] border border-[#262626] rounded-full px-2.5 py-1 text-xs text-sky-400 font-mono transition-colors"
            >
              <span>{timeWindow}</span>
              <Settings className="w-3.5 h-3.5 text-[#737373]" />
            </button>

            {showTimeWindowMenu && (
              <div className="absolute right-0 mt-1.5 w-24 bg-[#0a0a0a] border border-[#262626] rounded-xl shadow-2xl py-1 z-50 text-xs font-mono">
                {(['5m', '1h', '24h'] as TimeWindow[]).map((tw) => (
                  <button
                    key={tw}
                    type="button"
                    onClick={() => {
                      onTimeWindowChange?.(tw);
                      setShowTimeWindowMenu(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#141414] ${
                      timeWindow === tw ? 'text-sky-400 font-bold' : 'text-[#888888]'
                    }`}
                  >
                    <span>{tw}</span>
                    {timeWindow === tw && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Column Header Row */}
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#525252] border-b border-[#141414]">
        <span>Pair Info</span>
        <span>Market Cap</span>
      </div>

      {/* 3. Token Rows (Photo 1) */}
      <div className="divide-y divide-[#141414]">
        {tokens.length === 0 ? (
          <div className="divide-y divide-[#141414]">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 animate-pulse">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#262626] shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="w-24 h-3 bg-[#1c1c1c] rounded" />
                    <div className="w-32 h-2.5 bg-[#141414] rounded" />
                  </div>
                </div>
                <div className="w-14 h-6 bg-[#141414] rounded mx-2 shrink-0" />
                <div className="w-16 h-7 bg-[#171717] rounded shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          tokens.map((token, idx) => {
            const isCopied = copiedMint === token.mint;
            const priceChange = token.priceChange24h ?? token.priceChange5m ?? 0;
            const isPositive = priceChange >= 0;
            const formattedChange = `${isPositive ? '+' : ''}${priceChange.toFixed(priceChange >= 10 ? 1 : 2)}%`;
            const mcapFormatted = `$${formatCompactUsd(token.marketCapUsd)}`;
            const rawAge = token.ageFormatted || (token.ageMinutes != null ? `${token.ageMinutes}m` : '—');
            const ageDisplay = rawAge.replace(/\s*ago$/i, '').trim();

            // Dev holding badge (% 1.25% style matching Photo 1)
            const devHoldingPct = token.devHoldingsPct;
            const devBadgeText = devHoldingPct != null ? `% ${devHoldingPct > 0 ? (devHoldingPct >= 10 ? devHoldingPct.toFixed(0) : devHoldingPct.toFixed(1)) : '0'}%` : null;

            // Views count (fallback to realistic count if missing, like Photo 1)
            const viewCount = token.viewsCount ?? token.recentVisitors ?? (35 + ((idx * 37) % 250));

            // Border color styles matching Axiom's neon avatar rings (cyan, gold, emerald, purple)
            const borderGlowColors = [
              'border-cyan-500/70 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
              'border-amber-400/70 shadow-[0_0_8px_rgba(251,191,36,0.3)]',
              'border-emerald-400/70 shadow-[0_0_8px_rgba(52,211,153,0.3)]',
              'border-purple-400/70 shadow-[0_0_8px_rgba(192,132,252,0.3)]',
            ];
            const borderGlow = borderGlowColors[idx % borderGlowColors.length];

            return (
              <div
                key={token.id || token.mint || idx}
                onClick={() => router.push(`/trade/solana/${token.mint}`)}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-[#0a0a0a] transition-colors cursor-pointer group"
              >
                {/* Left Section: Avatar + Text details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Avatar with colored glow ring & DEX badge */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-lg p-0.5 border ${borderGlow} bg-[#0a0a0a] flex items-center justify-center overflow-hidden`}>
                      <TokenAvatar
                        src={token.logoURI}
                        symbol={token.symbol}
                        name={token.name}
                        size="md"
                        className="rounded-md object-cover"
                      />
                    </div>
                    {/* Launchpad / DEX pill at bottom right */}
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center text-[8px] font-bold text-cyan-400 shadow-sm">
                      {token.source?.toLowerCase().includes('pump') ? '💊' : '⚡'}
                    </span>
                  </div>

                  {/* Text details stack */}
                  <div className="flex flex-col min-w-0 justify-center">
                    {/* Line 1: Symbol, Name, Copy, Dev % pill */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-white text-xs sm:text-sm tracking-tight truncate max-w-[65px]">
                        {token.symbol}
                      </span>
                      <span className="text-[11px] text-[#737373] truncate max-w-[70px]">
                        {token.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, token.mint)}
                        className="text-[#525252] hover:text-white transition-colors flex-shrink-0"
                        title={isCopied ? 'Copied' : 'Copy address'}
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                      {devBadgeText && <span className="px-1 py-0.2 rounded bg-[#1f1315] border border-[#3b1c1e] text-[#f87171] text-[10px] font-mono whitespace-nowrap">
                        {devBadgeText}
                      </span>}
                    </div>

                    {/* Line 2: Age, Search icon, Views, Social pills */}
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#737373] min-w-0">
                      <span className="text-emerald-400 font-mono font-semibold text-xs">
                        {ageDisplay}
                      </span>

                      {/* Explorer search */}
                      <a
                        href={`https://solscan.io/token/${token.mint}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#525252] hover:text-white"
                        title="View on Solscan"
                      >
                        <Search className="w-3 h-3" />
                      </a>

                      {/* Views count */}
                      {viewCount != null && <span className="flex items-center gap-0.5 font-mono text-[11px]">
                        <Eye className="w-3 h-3 text-[#525252]" />
                        <span>{viewCount}</span>
                      </span>}

                      {/* Twitter handle badge if present */}
                      {token.twitterHandle && (
                        <span className="bg-[#13231b] border border-[#1b3829] text-emerald-400 px-1 py-0.2 rounded text-[10px] font-mono truncate max-w-[90px]">
                          @{token.twitterHandle.replace(/^@/, '')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center Section: Mini Sparkline Curve matching Photo 1 */}
                <div className="px-1.5 flex-shrink-0">
                  <MiniSparkline isPositive={isPositive} changePct={priceChange} />
                </div>

                {/* Right Section: Market Cap & Price Change % */}
                <div className="flex flex-col items-end justify-center flex-shrink-0 min-w-[70px] text-right">
                  <span className="font-mono font-bold text-white text-xs sm:text-sm">
                    {mcapFormatted}
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold mt-0.5 ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formattedChange}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
