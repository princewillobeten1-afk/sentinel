'use client';

import React from 'react';
import { Activity } from 'lucide-react';

interface VolumeDisplayProps {
  volumeUsd: number;
  buyVolumeUsd?: number;
  sellVolumeUsd?: number;
  timeframe?: string;
}

export function VolumeDisplay({
  volumeUsd,
  buyVolumeUsd,
  sellVolumeUsd,
  timeframe = '24h',
}: VolumeDisplayProps) {
  const formatted =
    volumeUsd >= 1_000_000
      ? `$${(volumeUsd / 1_000_000).toFixed(2)}M`
      : volumeUsd >= 1_000
      ? `$${(volumeUsd / 1_000).toFixed(1)}K`
      : `$${volumeUsd.toFixed(0)}`;

  const totalBuySell = (buyVolumeUsd || 0) + (sellVolumeUsd || 0);
  const buyPct = totalBuySell > 0 ? ((buyVolumeUsd || 0) / totalBuySell) * 100 : 50;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 font-mono text-xs">
        <span className="font-bold text-slate-200">{formatted}</span>
        {timeframe && <span className="text-2xs text-slate-500 uppercase">{timeframe}</span>}
      </div>

      {totalBuySell > 0 && (
        <div className="w-full h-1 rounded-full bg-rose-500/40 overflow-hidden flex">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${buyPct}%` }}
            title={`Buys: ${buyPct.toFixed(0)}% / Sells: ${(100 - buyPct).toFixed(0)}%`}
          />
        </div>
      )}
    </div>
  );
}
