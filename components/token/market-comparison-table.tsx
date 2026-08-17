'use client';

import React from 'react';
import { Layers, Star, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Market } from '@/lib/market-data/types';

interface ComparisonMarket extends Market {
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd?: number;
  spreadPct?: number;
  isPrimary?: boolean;
}

interface MarketComparisonTableProps {
  markets: ComparisonMarket[];
  onSelectMarket?: (marketId: string) => void;
}

export function MarketComparisonTable({
  markets,
  onSelectMarket,
}: MarketComparisonTableProps) {
  return (
    <div className="w-full bg-sentinel-900/40 border border-white/5 rounded-2xl overflow-hidden font-mono text-xs">
      <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            DEX Market Comparison ({markets.length} Pools)
          </h4>
        </div>
        <span className="text-2xs text-slate-500">Cross-Pool Arbitrage & Depth</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] text-slate-500 text-2xs uppercase border-b border-white/5">
              <th className="p-3">DEX Protocol</th>
              <th className="p-3">Type</th>
              <th className="p-3">Price (USD)</th>
              <th className="p-3">Liquidity Depth</th>
              <th className="p-3">Est. Spread</th>
              <th className="p-3">Classification</th>
              <th className="p-3 text-right">Pool Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {markets.map((m, idx) => {
              const isPrimary = m.isPrimary || idx === 0;

              return (
                <tr
                  key={m.marketId}
                  onClick={() => onSelectMarket?.(m.marketId)}
                  className={`hover:bg-white/[0.02] transition cursor-pointer ${
                    isPrimary ? 'bg-sky-500/[0.03]' : ''
                  }`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white uppercase">{m.protocol.replace('_', ' ')}</span>
                      {isPrimary && (
                        <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-2xs border border-sky-500/30 flex items-center gap-0.5 font-bold">
                          <Star className="h-2.5 w-2.5 fill-sky-400 text-sky-400" /> Primary
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3">
                    <Badge variant="neutral" size="sm" className="text-2xs">
                      {m.marketType}
                    </Badge>
                  </td>

                  <td className="p-3 font-bold text-white">
                    ${m.priceUsd ? m.priceUsd.toFixed(4) : '-'}
                  </td>

                  <td className="p-3 text-slate-200">
                    ${m.liquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>

                  <td className="p-3 text-slate-400">
                    {m.spreadPct !== undefined ? `${m.spreadPct.toFixed(2)}%` : '< 0.05%'}
                  </td>

                  <td className="p-3">
                    <Badge
                      variant={
                        m.status === 'ACTIVE'
                          ? 'success'
                          : m.status === 'SUSPICIOUS'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {m.status}
                    </Badge>
                  </td>

                  <td className="p-3 text-right text-slate-500">
                    <span title={m.address}>
                      {m.address.slice(0, 6)}...{m.address.slice(-4)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
