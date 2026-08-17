'use client';

import React, { useState } from 'react';
import {
  ArrowUpDown,
  TrendingUp,
  Droplets,
  Coins,
  Search,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { PriceChange } from './price-change';
import { LiquidityDisplay } from './liquidity-display';
import { VolumeDisplay } from './volume-display';
import { MarketCapDisplay } from './market-cap-display';
import { Sparkline } from './sparkline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TokenMarketSnapshot } from '@/lib/market-data/types';

interface TokenTableProps {
  tokens: TokenMarketSnapshot[];
  onSelectToken?: (tokenId: string) => void;
  onTradeToken?: (tokenId: string) => void;
}

export function TokenTable({
  tokens,
  onSelectToken,
  onTradeToken,
}: TokenTableProps) {
  const [sortField, setSortField] = useState<'volume' | 'liquidity' | 'mcap' | 'change'>('volume');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: 'volume' | 'liquidity' | 'mcap' | 'change') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sorted = [...tokens].sort((a, b) => {
    let diff = 0;
    if (sortField === 'volume') diff = a.volume24hUsd - b.volume24hUsd;
    else if (sortField === 'liquidity') diff = a.totalLiquidityUsd - b.totalLiquidityUsd;
    else if (sortField === 'mcap') diff = a.marketCapUsd - b.marketCapUsd;
    else if (sortField === 'change') diff = a.priceChange24h - b.priceChange24h;
    return sortAsc ? diff : -diff;
  });

  return (
    <div className="w-full rounded-2xl bg-sentinel-900/40 border border-white/5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono text-2xs uppercase select-none">
              <th className="p-3.5">#</th>
              <th className="p-3.5">Token Pair</th>
              <th className="p-3.5">Price</th>
              <th
                onClick={() => handleSort('change')}
                className="p-3.5 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1">
                  <span>24h Change</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort('volume')}
                className="p-3.5 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1">
                  <span>24h Volume</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort('liquidity')}
                className="p-3.5 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1">
                  <span>Liquidity</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort('mcap')}
                className="p-3.5 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1">
                  <span>Market Cap</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th className="p-3.5 text-right">Quick Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {sorted.map((t, idx) => (
              <tr
                key={t.tokenId}
                onClick={() => onSelectToken?.(t.tokenId)}
                className="hover:bg-white/[0.02] transition cursor-pointer group"
              >
                <td className="p-3.5 text-slate-500">{idx + 1}</td>
                <td className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-300 font-mono text-xs shrink-0">
                      {t.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-sky-300 transition flex items-center gap-1.5 font-sans">
                        {t.name}
                        <span className="text-xs text-sky-400 font-mono font-bold">${t.symbol}</span>
                      </p>
                      <p className="text-2xs text-slate-500 font-mono">
                        {t.marketCount} {t.marketCount === 1 ? 'Pool' : 'Pools'} • {t.dataQualityScore}% Quality
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3.5">
                  <span className="font-bold text-white text-xs">
                    ${t.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                </td>
                <td className="p-3.5">
                  <PriceChange changePct={t.priceChange24h} size="sm" />
                </td>
                <td className="p-3.5">
                  <VolumeDisplay volumeUsd={t.volume24hUsd} />
                </td>
                <td className="p-3.5">
                  <LiquidityDisplay liquidityUsd={t.totalLiquidityUsd} marketCount={t.marketCount} />
                </td>
                <td className="p-3.5">
                  <MarketCapDisplay marketCapUsd={t.marketCapUsd} fdvUsd={t.fdvUsd} confidence={t.confidence} />
                </td>
                <td className="p-3.5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTradeToken?.(t.tokenId);
                    }}
                    className="text-2xs h-7 px-3 border-sky-500/30 text-sky-300 hover:bg-sky-500/20"
                  >
                    Trade
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
