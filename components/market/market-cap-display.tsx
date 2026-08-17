'use client';

import React from 'react';
import { Coins, HelpCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

interface MarketCapDisplayProps {
  marketCapUsd: number;
  fdvUsd?: number | null;
  confidence?: number;
}

export function MarketCapDisplay({
  marketCapUsd,
  fdvUsd,
  confidence,
}: MarketCapDisplayProps) {
  const formattedMcap =
    marketCapUsd >= 1_000_000_000
      ? `$${(marketCapUsd / 1_000_000_000).toFixed(2)}B`
      : marketCapUsd >= 1_000_000
      ? `$${(marketCapUsd / 1_000_000).toFixed(2)}M`
      : marketCapUsd >= 1_000
      ? `$${(marketCapUsd / 1_000).toFixed(1)}K`
      : `$${marketCapUsd.toFixed(0)}`;

  const formattedFdv =
    fdvUsd && fdvUsd > 0
      ? fdvUsd >= 1_000_000_000
        ? `$${(fdvUsd / 1_000_000_000).toFixed(2)}B`
        : fdvUsd >= 1_000_000
        ? `$${(fdvUsd / 1_000_000).toFixed(2)}M`
        : `$${(fdvUsd / 1_000).toFixed(1)}K`
      : null;

  return (
    <div className="space-y-0.5 font-mono text-xs">
      <div className="flex items-center gap-1.5 text-slate-200 font-bold">
        <span>{formattedMcap}</span>
        {confidence !== undefined && (
          <span
            className={`text-2xs px-1 rounded border ${
              confidence >= 0.9
                ? 'text-emerald-400 border-emerald-500/30'
                : 'text-amber-400 border-amber-500/30'
            }`}
            title={`Supply Confidence: ${(confidence * 100).toFixed(0)}%`}
          >
            {(confidence * 100).toFixed(0)}% Conf
          </span>
        )}
      </div>

      {formattedFdv && (
        <div className="text-2xs text-slate-500">
          FDV: <span className="text-slate-400">{formattedFdv}</span>
        </div>
      )}
    </div>
  );
}
