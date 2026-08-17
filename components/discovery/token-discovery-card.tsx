'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, TrendingUp, Droplets, Activity, Coins } from 'lucide-react';
import { PriceChange } from '../market/price-change';
import { RankedTokenItem } from '@/lib/market-data/types';

interface TokenDiscoveryCardProps {
  token: RankedTokenItem;
}

export function TokenDiscoveryCard({ token }: TokenDiscoveryCardProps) {
  return (
    <Link
      href={`/tokens/${token.tokenId}`}
      className="p-4 rounded-2xl bg-sentinel-900/60 border border-white/5 hover:border-sky-500/30 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4 hover:shadow-[0_4px_25px_rgba(56,189,248,0.12)] font-mono"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-600/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-300 text-sm shadow-inner shrink-0">
            {token.symbol.slice(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition font-sans">
                {token.name}
              </h4>
              <span className="text-xs text-sky-400 font-bold">${token.symbol}</span>
            </div>
            <span className="text-2xs text-slate-500">Rank #{token.rank}</span>
          </div>
        </div>

        <PriceChange changePct={token.changePct} size="sm" />
      </div>

      {/* Price */}
      <div>
        <span className="text-2xs text-slate-500 uppercase block">Price (USD)</span>
        <p className="text-xl font-bold text-white tracking-tight">
          ${token.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </p>
      </div>

      {/* Metrics Footer */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5 text-2xs">
        <div>
          <span className="text-2xs text-slate-500 uppercase block">24h Vol</span>
          <span className="text-slate-200 font-semibold block truncate">
            ${(token.volumeUsd / 1_000_000).toFixed(2)}M
          </span>
        </div>

        <div>
          <span className="text-2xs text-slate-500 uppercase block">Liquidity</span>
          <span className="text-slate-200 font-semibold block truncate">
            ${(token.liquidityUsd / 1_000_000).toFixed(2)}M
          </span>
        </div>
      </div>
    </Link>
  );
}
