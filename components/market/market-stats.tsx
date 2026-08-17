'use client';

import React from 'react';
import { DollarSign, Activity, Droplets, Layers, TrendingUp, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MarketStatsProps {
  solPriceUsd?: number;
  solChange24h?: number;
  totalVolume24hUsd?: number;
  totalLiquidityUsd?: number;
  activePoolsCount?: number;
  sentiment?: 'bullish' | 'neutral' | 'bearish';
}

export function MarketStats({
  solPriceUsd = 150.0,
  solChange24h = 8.42,
  totalVolume24hUsd = 142_850_000,
  totalLiquidityUsd = 485_200_000,
  activePoolsCount = 1420,
  sentiment = 'bullish',
}: MarketStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-2xl bg-sentinel-900/50 border border-white/5 backdrop-blur-xl">
      {/* SOL Native Price */}
      <div className="space-y-1">
        <span className="text-2xs text-slate-500 font-mono uppercase block">SOL / USD</span>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-sm font-bold text-white">${solPriceUsd.toFixed(2)}</span>
          <span
            className={`text-2xs font-bold ${
              solChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {solChange24h >= 0 ? '+' : ''}
            {solChange24h}%
          </span>
        </div>
      </div>

      {/* 24h Global Volume */}
      <div className="space-y-1">
        <span className="text-2xs text-slate-500 font-mono uppercase block">24h DEX Volume</span>
        <p className="text-sm font-bold text-sky-400 font-mono">
          ${(totalVolume24hUsd / 1_000_000).toFixed(1)}M
        </p>
      </div>

      {/* Total Tracked Liquidity */}
      <div className="space-y-1">
        <span className="text-2xs text-slate-500 font-mono uppercase block">Total TVL / Depth</span>
        <p className="text-sm font-bold text-emerald-400 font-mono">
          ${(totalLiquidityUsd / 1_000_000).toFixed(1)}M
        </p>
      </div>

      {/* Active Tracked Markets */}
      <div className="space-y-1">
        <span className="text-2xs text-slate-500 font-mono uppercase block">Active Pools</span>
        <p className="text-sm font-bold text-slate-200 font-mono">{activePoolsCount.toLocaleString()}</p>
      </div>

      {/* Market Sentiment */}
      <div className="space-y-1 col-span-2 sm:col-span-1">
        <span className="text-2xs text-slate-500 font-mono uppercase block">Market Sentiment</span>
        <div className="flex items-center gap-1.5">
          <div
            className={`h-2 w-2 rounded-full ${
              sentiment === 'bullish'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(18,181,116,0.55)]'
                : sentiment === 'bearish'
                ? 'bg-rose-400 shadow-[0_0_8px_rgba(236,90,95,0.55)]'
                : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-bold uppercase font-mono text-slate-200">{sentiment}</span>
        </div>
      </div>
    </div>
  );
}
