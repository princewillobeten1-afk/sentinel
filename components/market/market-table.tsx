'use client';

import React from 'react';
import { ExternalLink, Droplets, Activity, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Market } from '@/lib/market-data/types';

interface EnrichedMarket extends Market {
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd?: number;
}

interface MarketTableProps {
  tokenId: string;
  markets: EnrichedMarket[];
  onSelectMarket?: (marketId: string) => void;
}

export function MarketTable({
  tokenId,
  markets,
  onSelectMarket,
}: MarketTableProps) {
  const totalLiq = markets.reduce((acc, m) => acc + (m.liquidityUsd || 0), 0);

  return (
    <div className="w-full rounded-2xl bg-sentinel-900/40 border border-white/5 overflow-hidden">
      <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            Active DEX Trading Pools ({markets.length})
          </h4>
        </div>
        <span className="text-2xs text-slate-500 font-mono">1 Token → N Markets</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 text-2xs uppercase">
              <th className="p-3">Protocol / DEX</th>
              <th className="p-3">Type</th>
              <th className="p-3">Pool Address</th>
              <th className="p-3">Price (USD)</th>
              <th className="p-3">Liquidity</th>
              <th className="p-3">Share</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {markets.map((m) => {
              const sharePct = totalLiq > 0 ? (m.liquidityUsd / totalLiq) * 100 : 0;
              return (
                <tr
                  key={m.marketId}
                  onClick={() => onSelectMarket?.(m.marketId)}
                  className="hover:bg-white/[0.02] transition cursor-pointer"
                >
                  <td className="p-3">
                    <span className="font-bold text-white uppercase">{m.protocol.replace('_', ' ')}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant="neutral" size="sm" className="text-2xs">
                      {m.marketType}
                    </Badge>
                  </td>
                  <td className="p-3 text-slate-400">
                    <span title={m.address}>
                      {m.address.slice(0, 6)}...{m.address.slice(-4)}
                    </span>
                  </td>
                  <td className="p-3 text-white font-bold">
                    ${m.priceUsd ? m.priceUsd.toFixed(4) : '-'}
                  </td>
                  <td className="p-3 text-slate-200">
                    ${m.liquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="p-3 text-sky-400 font-bold">{sharePct.toFixed(1)}%</td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
