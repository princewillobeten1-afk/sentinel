'use client';

import React from 'react';
import { Droplets } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

interface LiquidityDisplayProps {
  liquidityUsd: number;
  marketCount?: number;
  showIcon?: boolean;
}

export function LiquidityDisplay({
  liquidityUsd,
  marketCount,
  showIcon = true,
}: LiquidityDisplayProps) {
  const formatted =
    liquidityUsd >= 1_000_000
      ? `$${(liquidityUsd / 1_000_000).toFixed(2)}M`
      : liquidityUsd >= 1_000
      ? `$${(liquidityUsd / 1_000).toFixed(1)}K`
      : `$${liquidityUsd.toFixed(0)}`;

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-slate-200">
      {showIcon && <Droplets className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
      <span className="font-bold">{formatted}</span>
      {marketCount !== undefined && marketCount > 1 && (
        <span className="text-2xs text-slate-500 font-mono">({marketCount} pools)</span>
      )}
    </div>
  );
}
