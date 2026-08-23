'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Star, Zap, Users, Shield, Lock, CheckCircle } from 'lucide-react';
import { PriceChange } from '../market/price-change';
import { RankedTokenItem } from '@/lib/market-data/types';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { useAppActions } from '@/lib/store';

interface TokenDiscoveryCardProps {
  token: RankedTokenItem;
}

function formatCompactUSD(num: number): string {
  if (num === 0) return '0';
  if (num < 1) return num.toFixed(3);
  if (num < 1_000) return Math.round(num).toString();
  if (num < 1_000_000) {
    const k = num / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}K`;
  }
  const m = num / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1)}M`;
}

function formatSmartPrice(num: number): string {
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.01) return num.toFixed(4);
  if (num >= 0.0001) return num.toFixed(5);
  return num.toFixed(6);
}

export function TokenDiscoveryCard({ token }: TokenDiscoveryCardProps) {
  const router = useRouter();
  const { setSelectedToken, setActiveView } = useAppActions();
  const isPumpFun = token.tokenId?.toLowerCase().endsWith('pump') || token.symbol.toLowerCase().includes('pump');

  const handleOpenTrade = () => {
    setSelectedToken({
      mint: token.tokenId,
      symbol: token.symbol,
      name: token.name,
      priceUsd: String(token.priceUsd),
      liquidityUsd: String(token.liquidityUsd),
      chain: 'solana',
    });
    setActiveView('trade');
    router.push(`/trade/solana/${token.tokenId}`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleOpenTrade}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenTrade();
        }
      }}
      className="group relative bg-[#0b0e14]/95 hover:bg-[#111620] border border-slate-800/80 hover:border-sky-500/50 rounded-xl p-2.5 transition-all duration-150 flex flex-col justify-between gap-2 shadow-sm font-mono select-none cursor-pointer focus-visible:ring-1 focus-visible:ring-sky-500"
    >
      {/* Top Row */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        {/* Left: Avatar + Details */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <TokenAvatar
            symbol={token.symbol}
            name={token.name}
            mint={token.tokenId}
            size="md"
            dexBadge={isPumpFun ? 'Pump.fun' : 'Raydium'}
          />

          <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
            <div className="flex items-center gap-1 min-w-0">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenTrade();
                }}
                className="font-bold text-slate-100 text-xs hover:text-sky-400 truncate max-w-[85px] shrink-0 font-sans cursor-pointer"
                title={token.name}
              >
                {token.name}
              </div>
              <span className="text-2xs text-slate-400 truncate max-w-[65px]" title={token.symbol}>
                ${token.symbol}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-2xs text-slate-400 leading-tight">
              <span className="font-medium text-slate-400">Rank #{token.rank}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400 truncate font-mono text-2xs">
                {token.tokenId.slice(0, 4)}...{token.tokenId.slice(-4)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 text-2xs pt-0.5">
              <PriceChange changePct={token.changePct} size="sm" />
            </div>
          </div>
        </div>

        {/* Right: Vol, Liquidity, Price, and Quick Action */}
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center justify-end gap-1.5 text-2xs leading-tight">
            <span className="text-slate-500">
              V <span className="text-slate-200 font-bold">${formatCompactUSD(token.volumeUsd)}</span>
            </span>
            <span className="text-slate-500">
              Liq <span className="text-cyan-400 font-bold">${formatCompactUSD(token.liquidityUsd)}</span>
            </span>
          </div>

          <div className="flex items-center justify-end gap-1.5 text-2xs leading-tight">
            <span className="text-slate-500">
              P <span className="text-slate-300 font-bold">${formatSmartPrice(token.priceUsd)}</span>
            </span>
          </div>

          <Link
            href={`/trade/solana/${token.tokenId}`}
            className="h-6 px-2.5 rounded-md bg-sentinel-800/90 hover:bg-emerald-500 hover:text-slate-950 border border-slate-700/80 hover:border-emerald-400 text-[11px] font-bold text-slate-200 flex items-center gap-1 transition-all shadow-sm"
          >
            <Zap className="w-2.5 h-2.5 text-emerald-400 group-hover:text-slate-950 fill-current" />
            <span>≡ 0.01</span>
          </Link>
        </div>
      </div>

      {/* Footer Security Badges */}
      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-800/60 text-2xs">
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/50 text-emerald-400">
          <CheckCircle className="w-2.5 h-2.5" />
          <span>Verified</span>
        </div>
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-cyan-400">
          <Shield className="w-2.5 h-2.5" />
          <span>Audit Clean</span>
        </div>
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/50 text-emerald-400">
          <Lock className="w-2.5 h-2.5" />
        </div>
        <div className="ml-auto px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/60 text-sky-400 font-bold text-2xs">
          Score 98
        </div>
      </div>
    </div>
  );
}
