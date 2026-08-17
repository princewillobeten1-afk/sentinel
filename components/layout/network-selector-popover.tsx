'use client';

import React from 'react';
import { Globe, Check } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { useAppState, useAppActions } from '@/lib/store';

export function NetworkSelectorPopover() {
  const { activeNetwork } = useAppState();
  const { setActiveNetwork } = useAppActions();

  const networks = [
    { id: 'mainnet', name: 'Solana Mainnet-Beta', tps: '2,840 TPS', status: 'Operational', color: 'text-emerald-400' },
    { id: 'devnet', name: 'Solana Devnet', tps: '1,420 TPS', status: 'Testnet Active', color: 'text-sky-400' },
    { id: 'testnet', name: 'Solana Testnet', tps: '2,100 TPS', status: 'Staging Mode', color: 'text-amber-400' },
  ];

  const currentNet = networks.find((n) => n.id === activeNetwork) || networks[0];

  return (
    <Popover
      trigger={
        <div className="flex items-center gap-1.5 rounded-lg border border-sentinel-700 bg-sentinel-850 px-2.5 py-1 text-xs text-slate-200 hover:border-sentinel-500 transition font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-status-pulse" />
          <span className="font-bold text-slate-200 hidden sm:inline">{currentNet.name}</span>
          <span className="sm:hidden font-bold">SOL</span>
        </div>
      }
    >
      <div className="w-56 space-y-1 font-mono text-xs select-none">
        <p className="px-2 py-1 text-2xs uppercase font-bold tracking-wider text-slate-500">Select Solana Network</p>
        {networks.map((net) => (
          <button
            key={net.id}
            onClick={() => setActiveNetwork(net.id as 'mainnet' | 'devnet' | 'testnet')}
            className={`w-full flex items-center justify-between p-2 rounded-lg transition text-left ${
              activeNetwork === net.id
                ? 'bg-sentinel-800 text-sky-300 font-bold border border-sentinel-600'
                : 'text-slate-300 hover:bg-sentinel-850'
            }`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-100">{net.name}</p>
              <p className={`text-2xs ${net.color}`}>{net.tps} • {net.status}</p>
            </div>
            {activeNetwork === net.id && <Check className="h-4 w-4 text-sky-400 shrink-0" />}
          </button>
        ))}
      </div>
    </Popover>
  );
}
