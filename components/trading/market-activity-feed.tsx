'use client';

import React from 'react';
import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';

export interface MarketActivityItem {
  id: string;
  side: 'buy' | 'sell';
  tokenSymbol: string;
  tokenAmount: string;
  baseAmountSol: string;
  valueUsd: string;
  walletAddress: string;
  time: string;
}

const MOCK_ACTIVITY: MarketActivityItem[] = [
  { id: 'm1', side: 'buy', tokenSymbol: 'SENT', tokenAmount: '12,500 SENT', baseAmountSol: '3.02 SOL', valueUsd: '$43,125.00', walletAddress: '7xK9...3a19', time: '8s ago' },
  { id: 'm2', side: 'sell', tokenSymbol: 'BONK', tokenAmount: '50,000,000 BONK', baseAmountSol: '9.98 SOL', valueUsd: '$1,422.00', walletAddress: '4zW8...9kL2', time: '18s ago' },
  { id: 'm3', side: 'buy', tokenSymbol: 'SENT', tokenAmount: '1,200 SENT', baseAmountSol: '0.29 SOL', valueUsd: '$4,140.00', walletAddress: '1aM3...2b88', time: '35s ago' },
  { id: 'm4', side: 'buy', tokenSymbol: 'SOL', tokenAmount: '15.5 SOL', baseAmountSol: '15.5 SOL', valueUsd: '$2,208.75', walletAddress: '9pQ1...4c00', time: '42s ago' },
  { id: 'm5', side: 'sell', tokenSymbol: 'QUANT', tokenAmount: '8,000 QUANT', baseAmountSol: '2.31 SOL', valueUsd: '$329.60', walletAddress: '3mR8...1a84', time: '1m ago' },
];

export function MarketActivityFeed() {
  return (
    <Panel variant="default" className="space-y-3 font-mono">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="font-bold flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-emerald-400" /> Live Market Activity
        </span>
        <span className="text-2xs text-slate-500">Real-Time DEX Swaps</span>
      </div>

      <div className="divide-y divide-sentinel-800/80 text-xs">
        {MOCK_ACTIVITY.map((item) => (
          <div key={item.id} className="py-2.5 flex items-center justify-between hover:bg-sentinel-900/40 px-2 rounded-lg transition">
            <div className="flex items-center gap-2.5">
              <Badge variant={item.side === 'buy' ? 'success' : 'danger'} size="sm">
                {item.side === 'buy' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {item.side.toUpperCase()}
              </Badge>
              <div>
                <p className="font-bold text-slate-200">{item.tokenAmount}</p>
                <p className="text-2xs text-slate-500">
                  Wallet: <span className="text-slate-300">{item.walletAddress}</span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-bold text-slate-100">{item.valueUsd}</p>
              <p className="text-2xs text-slate-500">{item.baseAmountSol} • {item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
