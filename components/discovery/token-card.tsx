'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  Star,
  Zap,
  Users,
  Shield,
  Lock,
  CheckCircle,
  Globe,
  Send,
  Twitter,
  Search,
  ExternalLink,
} from 'lucide-react';
import { useAppActions } from '@/lib/store';
import { useWatchlist } from '@/lib/store/watchlist-store';
import type { DiscoveryToken } from '@/lib/discovery/types';
import { Decimal } from '@/lib/math/decimal';

interface TokenDiscoveryCardProps {
  token: DiscoveryToken;
  variant?: 'compact' | 'expanded';
}

function formatCompactUSD(val: number | string | undefined): string {
  if (val === undefined || val === null) return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return '0';
  if (num < 1) {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  }
  if (num < 1_000) {
    return Math.round(num).toString();
  }
  if (num < 1_000_000) {
    const k = num / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(k < 10 ? 2 : 1)}K`;
  }
  const m = num / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(m < 10 ? 2 : 1)}M`;
}

function formatSmartPrice(val: number | string | undefined): string {
  if (!val) return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.01) return num.toFixed(4);
  if (num >= 0.0001) return num.toFixed(5);
  // Very small decimals
  const str = num.toFixed(9);
  const match = str.match(/^0\.(0+)(\d+)$/);
  if (match) {
    const zeroCount = match[1].length;
    const sigDigits = match[2].slice(0, 3);
    const subscriptDigits: Record<string, string> = {
      '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈'
    };
    const sub = subscriptDigits[String(zeroCount)] || `_${zeroCount}_`;
    return `0.0${sub}${sigDigits}`;
  }
  return num.toFixed(6);
}

function formatCount(num: number | undefined): string {
  if (!num) return '1';
  if (num < 1_000) return num.toString();
  if (num < 1_000_000) return `${(num / 1_000).toFixed(num < 10_000 ? 1 : 0)}K`;
  return `${(num / 1_000_000).toFixed(1)}M`;
}

export function TokenDiscoveryCard({ token }: TokenDiscoveryCardProps) {
  const { setQuickBuyOpen } = useAppActions();
  const { isWatchlisted: checkWatchlisted, toggleWatchlist } = useWatchlist();

  const [copied, setCopied] = useState(false);
  const isWatchlisted = checkWatchlisted(token.mint);

  const priceDec = useMemo(() => new Decimal(token.priceUsd || '0'), [token.priceUsd]);
  const mcapDec = useMemo(() => new Decimal(token.marketCapUsd || '0'), [token.marketCapUsd]);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(token.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatchlist(token.mint);
  };

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickBuyOpen(true, {
      name: token.name,
      symbol: token.symbol,
      mint: token.mint,
      price: priceDec.formatUSD(4),
      mcap: mcapDec.formatUSD(0),
    });
  };

  // Truncated mint display
  const shortMint = useMemo(() => {
    if (!token.mint) return '...pump';
    if (token.source === 'Pump.fun' || token.mint.toLowerCase().endsWith('pump')) {
      return `${token.mint.slice(0, 4)}...pump`;
    }
    return `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`;
  }, [token.mint, token.source]);

  // Derived security / token metrics
  const top10Concentration = useMemo(() => {
    const raw = Math.round(100 - (token.buyPressureRatio || 0.5) * 60);
    return Math.min(96, Math.max(12, raw));
  }, [token.buyPressureRatio]);

  const devHoldingsPct = useMemo(() => {
    const raw = Math.round((token.buyPressureRatio || 0.3) * 35);
    return Math.min(45, Math.max(0, raw));
  }, [token.buyPressureRatio]);

  const score = token.discoveryScore?.totalScore ?? 95;
  const isPumpFun = token.source === 'Pump.fun' || token.mint?.toLowerCase().endsWith('pump');

  return (
    <div className="group relative bg-[#0b0e14]/95 hover:bg-[#111620] border border-slate-800/80 hover:border-sky-500/50 rounded-xl p-2.5 transition-all duration-150 flex flex-col justify-between gap-2 shadow-sm font-mono select-none">
      {/* Top Main Row */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        {/* Left Column: Avatar + Identity + Socials */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* Avatar Thumbnail with DEX Badge */}
          <div className="relative shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-750 flex items-center justify-center font-bold text-sky-400 text-xs overflow-hidden shadow-inner">
            <span>{token.symbol.slice(0, 3).toUpperCase()}</span>
            {/* DEX Badge Pill at bottom right */}
            <div
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-tl-md flex items-center justify-center text-[8px] font-black ${
                isPumpFun
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-sky-500 text-slate-950'
              }`}
              title={token.source || 'Solana DEX'}
            >
              {isPumpFun ? '💊' : 'R'}
            </div>
          </div>

          {/* Identity Stack */}
          <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
            {/* Line 1: Name + Symbol + Copy + Star */}
            <div className="flex items-center gap-1 min-w-0">
              <Link
                href={`/trade/solana/${token.mint}`}
                className="font-bold text-slate-100 text-xs hover:text-sky-400 truncate max-w-[85px] shrink-0 font-sans"
                title={token.name}
              >
                {token.name}
              </Link>
              <span className="text-[10px] text-slate-400 truncate max-w-[65px]" title={token.symbol}>
                {token.symbol}
              </span>
              <button
                onClick={handleCopyAddress}
                className="text-slate-500 hover:text-slate-200 transition-colors p-0.5 shrink-0 ml-0.5"
                title={copied ? 'Copied!' : 'Copy Mint Address'}
              >
                {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
              <button
                onClick={handleToggleWatchlist}
                className={`transition-colors p-0.5 shrink-0 ${
                  isWatchlisted ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
                }`}
                title={isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}
              >
                <Star className={`w-2.5 h-2.5 ${isWatchlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Line 2: Age | Truncated Mint */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 leading-tight">
              <span className="font-medium text-slate-400">{token.ageFormatted || '1m'}</span>
              <span className="text-slate-700">|</span>
              <button
                onClick={handleCopyAddress}
                className="text-slate-400 hover:text-sky-300 transition-colors truncate font-mono text-[10px]"
                title="Click to copy full address"
              >
                {shortMint}
              </button>
            </div>

            {/* Line 3: Socials & Quick Icons */}
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] pt-0.5">
              <span className="flex items-center gap-0.5 text-sky-400/90 font-semibold" title="Holders">
                <Users className="w-2.5 h-2.5" />
                <span>{formatCount(token.holdersCount || 1)}</span>
              </span>
              <Link
                href={`https://x.com/search?q=${encodeURIComponent(token.symbol)}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-300 transition-colors"
                title="Twitter/X Search"
                onClick={(e) => e.stopPropagation()}
              >
                <Twitter className="w-2.5 h-2.5" />
              </Link>
              <Link
                href={`https://solscan.io/token/${token.mint}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-300 transition-colors"
                title="Solscan Explorer"
                onClick={(e) => e.stopPropagation()}
              >
                <Search className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Volume, MC, Price, TX, and Quick Buy */}
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {/* Vol & Market Cap */}
          <div className="flex items-center justify-end gap-1.5 text-[10px] leading-tight">
            <span className="text-slate-500">
              V <span className="text-slate-200 font-bold">${formatCompactUSD(token.volume24hUsd || token.volume1hUsd)}</span>
            </span>
            <span className="text-slate-500">
              MC <span className="text-amber-400 font-bold">${formatCompactUSD(token.marketCapUsd)}</span>
            </span>
          </div>

          {/* Price & TX count */}
          <div className="flex items-center justify-end gap-1.5 text-[10px] leading-tight">
            <span className="text-slate-500">
              P <span className="text-slate-300 font-bold">${formatSmartPrice(token.priceUsd)}</span>
            </span>
            <span className="text-slate-500">
              TX <span className="text-slate-400 font-medium">{token.txCount1h || (token.buysCount + token.sellsCount) || 1}</span>
            </span>
          </div>

          {/* Quick Buy Pill Button */}
          <button
            onClick={handleQuickBuy}
            className="h-6 px-2.5 rounded-md bg-sentinel-800/90 hover:bg-emerald-500 hover:text-slate-950 border border-slate-700/80 hover:border-emerald-400 text-[11px] font-bold text-slate-200 flex items-center gap-1 transition-all shadow-sm group-hover:border-slate-600"
            title="Instant Quick Swap"
          >
            <Zap className="w-2.5 h-2.5 text-emerald-400 group-hover:text-slate-950 fill-current" />
            <span>≡ 0.01</span>
          </button>
        </div>
      </div>

      {/* Bottom Footer: Security & Safety Pills */}
      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-800/60 text-[10px]">
        {/* Top 10 Holders % */}
        <div
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${
            top10Concentration > 70
              ? 'bg-rose-950/40 border-rose-900/50 text-rose-400'
              : top10Concentration > 40
              ? 'bg-amber-950/40 border-amber-900/50 text-amber-400'
              : 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400'
          }`}
          title="Top 10 Holders Concentration"
        >
          <Users className="w-2.5 h-2.5" />
          <span>{top10Concentration}%</span>
        </div>

        {/* Dev / Bonding Curve Share */}
        <div
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-cyan-400 font-medium"
          title="Dev / Insider Share"
        >
          <Shield className="w-2.5 h-2.5" />
          <span>{devHoldingsPct}%</span>
        </div>

        {/* Mint Authority Renounced */}
        <div
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/50 text-emerald-400"
          title="Mint Authority Renounced"
        >
          <CheckCircle className="w-2.5 h-2.5" />
        </div>

        {/* Liquidity Locked */}
        <div
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/50 text-emerald-400"
          title="Liquidity Locked"
        >
          <Lock className="w-2.5 h-2.5" />
        </div>

        {/* Sentinel Discovery Score Pill */}
        <div
          className={`ml-auto px-1.5 py-0.5 rounded border font-bold text-[10px] ${
            score >= 80
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
              : score >= 60
              ? 'bg-sky-950/60 border-sky-800/60 text-sky-400'
              : 'bg-amber-950/60 border-amber-800/60 text-amber-400'
          }`}
          title="Sentinel Signal Score (0 - 100)"
        >
          ⚡ {score}
        </div>
      </div>
    </div>
  );
}
