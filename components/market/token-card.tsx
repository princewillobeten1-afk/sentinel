'use client';

import React from 'react';
import { Sparkles, ArrowUpRight, Droplets, Activity, Coins } from 'lucide-react';
import { PriceChange } from './price-change';
import { Sparkline } from './sparkline';
import { Badge } from '@/components/ui/badge';
import { TokenMarketSnapshot } from '@/lib/market-data/types';

interface TokenCardProps {
  token: TokenMarketSnapshot;
  sparklineData?: number[];
  onClick?: () => void;
  onTrade?: () => void;
}

export function TokenCard({
  token,
  sparklineData = [142, 144, 143, 146, 148, 147, 150],
  onClick,
  onTrade,
}: TokenCardProps) {
  const isPositive = token.priceChange24h >= 0;

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-2xl bg-sentinel-900/60 border border-white/5 hover:border-sky-500/30 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4 hover:shadow-[0_4px_20px_rgba(56,189,248,0.1)]"
    >
      {/* Top Header: Symbol, Name, Price Change */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-300 font-mono text-sm shadow-inner">
            {token.symbol.slice(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition">
                {token.name}
              </h4>
              <span className="text-xs text-sky-400 font-mono font-bold">${token.symbol}</span>
            </div>
            <p className="text-2xs text-slate-500 font-mono">
              {token.marketCount} {token.marketCount === 1 ? 'Market' : 'Markets'} • {token.dataQualityScore}% Quality
            </p>
          </div>
        </div>

        <PriceChange changePct={token.priceChange24h} size="sm" />
      </div>

      {/* Center: Price & Sparkline */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <span className="text-2xs text-slate-500 font-mono block">Price (USD)</span>
          <p className="text-lg font-bold text-white font-mono tracking-tight">
            ${token.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </p>
        </div>

        <div className="shrink-0">
          <Sparkline data={sparklineData} width={90} height={28} isPositive={isPositive} />
        </div>
      </div>

      {/* Bottom Metrics Bar */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 text-2xs font-mono">
        <div>
          <span className="text-2xs text-slate-500 block uppercase">24h Vol</span>
          <span className="text-slate-200 font-semibold truncate block">
            ${(token.volume24hUsd / 1_000_000).toFixed(1)}M
          </span>
        </div>

        <div>
          <span className="text-2xs text-slate-500 block uppercase">Liquidity</span>
          <span className="text-slate-200 font-semibold truncate block">
            ${(token.totalLiquidityUsd / 1_000_000).toFixed(1)}M
          </span>
        </div>

        <div>
          <span className="text-2xs text-slate-500 block uppercase">Market Cap</span>
          <span className="text-slate-200 font-semibold truncate block">
            ${(token.marketCapUsd / 1_000_000).toFixed(1)}M
          </span>
        </div>
      </div>
    </div>
  );
}
