'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PriceChangeProps {
  changePct: number;
  timeframe?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function PriceChange({
  changePct,
  timeframe,
  size = 'md',
  showIcon = true,
}: PriceChangeProps) {
  const isPositive = changePct > 0;
  const isZero = changePct === 0;

  const colorClass = isZero
    ? 'text-slate-400 bg-slate-500/10 border-slate-500/20'
    : isPositive
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

  const sizeClass =
    size === 'sm'
      ? 'text-2xs px-1.5 py-0.5'
      : size === 'lg'
      ? 'text-sm px-3 py-1 font-bold'
      : 'text-xs px-2 py-0.5 font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border font-mono ${colorClass} ${sizeClass}`}
    >
      {showIcon && (
        <>
          {isZero ? (
            <Minus className="h-3 w-3" />
          ) : isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
        </>
      )}
      <span>
        {isPositive ? '+' : ''}
        {changePct.toFixed(2)}%
      </span>
      {timeframe && <span className="text-2xs opacity-70">({timeframe})</span>}
    </span>
  );
}
