'use client';

import React from 'react';
import { Activity, Flame, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface TradeFeedItem {
  id: string;
  side: 'BUY' | 'SELL';
  priceUsd: number;
  baseAmount: string;
  quoteAmount: string;
  volumeUsd: number;
  isLargeTrade?: boolean;
  senderWallet: string;
  txHash: string;
  timestamp: string;
}

interface TradeHistoryFeedProps {
  trades: TradeFeedItem[];
  tokenSymbol: string;
}

export function TradeHistoryFeed({
  trades,
  tokenSymbol,
}: TradeHistoryFeedProps) {
  return (
    <div className="w-full bg-sentinel-900/40 border border-white/5 rounded-2xl overflow-hidden font-mono">
      <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Realtime Trade Stream
          </h4>
        </div>
        <span className="text-2xs text-slate-500">Live DEX Swaps</span>
      </div>

      <div className="overflow-x-auto max-h-[360px] overflow-y-auto divide-y divide-white/5">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-white/[0.02] text-slate-500 text-2xs uppercase sticky top-0 backdrop-blur-md">
              <th className="p-2.5">Side</th>
              <th className="p-2.5">Price (USD)</th>
              <th className="p-2.5">Amount (${tokenSymbol})</th>
              <th className="p-2.5">Total Value</th>
              <th className="p-2.5">Wallet</th>
              <th className="p-2.5 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {trades.map((trade) => {
              const isBuy = trade.side === 'BUY';
              const timeFormatted = new Date(trade.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <tr
                  key={trade.id}
                  className="hover:bg-white/[0.02] transition cursor-default"
                >
                  <td className="p-2.5">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-2xs ${
                        isBuy
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {trade.side}
                    </span>
                  </td>

                  <td className="p-2.5">
                    <span className={`font-bold ${isBuy ? 'text-emerald-300' : 'text-rose-300'}`}>
                      ${trade.priceUsd.toFixed(4)}
                    </span>
                  </td>

                  <td className="p-2.5 text-white">{trade.baseAmount}</td>

                  <td className="p-2.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-200">
                      <span>${trade.volumeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      {trade.isLargeTrade && (
                        <span
                          className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-2xs border border-amber-500/30 flex items-center gap-0.5"
                          title="Large Trade detected"
                        >
                          <Flame className="h-2.5 w-2.5" /> Large
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-2.5 text-slate-500 text-2xs">{trade.senderWallet}</td>

                  <td className="p-2.5 text-right text-slate-500 text-2xs">{timeFormatted}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
