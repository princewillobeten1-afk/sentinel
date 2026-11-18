'use client';

import React from 'react';
import { Globe, Check } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { useAppState, useAppActions } from '@/lib/store';

export function NetworkSelectorPopover() {
  const { activeNetwork, activeChain } = useAppState();
  const { setActiveNetwork, setActiveChain } = useAppActions();

  const solanaNetworks = [
    { id: 'mainnet', name: 'Solana Mainnet-Beta', tps: 'Operational', status: 'Live RPC', color: 'text-emerald-400' },
    { id: 'devnet', name: 'Solana Devnet', tps: 'Testnet Active', status: 'Devnet', color: 'text-sky-400' },
    { id: 'testnet', name: 'Solana Testnet', tps: 'Staging Mode', status: 'Testnet', color: 'text-amber-400' },
  ];

  const isRobinhood = activeChain === 'robinhood';
  const currentNet = solanaNetworks.find((n) => n.id === activeNetwork) || solanaNetworks[0];

  return (
    <Popover
      trigger={
        <div className="flex items-center gap-1.5 rounded-lg border border-sentinel-700 bg-sentinel-850 px-2.5 py-1 text-xs text-slate-200 hover:border-sentinel-500 transition font-mono">
          <span className={`h-2 w-2 rounded-full animate-status-pulse ${isRobinhood ? 'bg-lime-400' : 'bg-emerald-400'}`} />
          <span className="font-bold text-slate-200 hidden sm:inline">
            {isRobinhood ? 'Robinhood Chain (4663)' : currentNet.name}
          </span>
          <span className="sm:hidden font-bold">{isRobinhood ? 'RH' : 'SOL'}</span>
        </div>
      }
    >
      <div className="w-60 space-y-1 font-mono text-xs select-none">
        <p className="px-2 py-1 text-2xs uppercase font-bold tracking-wider text-slate-500">Active Chain & Network</p>
        <button
          onClick={() => setActiveChain('robinhood')}
          className={`w-full flex items-center justify-between p-2 rounded-lg transition text-left ${
            isRobinhood
              ? 'bg-sentinel-800 text-lime-300 font-bold border border-lime-500/40'
              : 'text-slate-300 hover:bg-sentinel-850'
          }`}
        >
          <div>
            <p className="text-xs font-semibold text-slate-100">Robinhood Chain Mainnet</p>
            <p className="text-2xs text-lime-400">EVM L2 • Chain ID 4663</p>
          </div>
          {isRobinhood && <Check className="h-4 w-4 text-lime-400 shrink-0" />}
        </button>

        <div className="h-px bg-sentinel-800 my-1" />
        <p className="px-2 py-0.5 text-2xs uppercase font-bold tracking-wider text-slate-500">Solana Networks</p>
        {solanaNetworks.map((net) => {
          const isSelected = !isRobinhood && activeNetwork === net.id;
          return (
            <button
              key={net.id}
              onClick={() => {
                setActiveChain('solana');
                setActiveNetwork(net.id as 'mainnet' | 'devnet' | 'testnet');
              }}
              className={`w-full flex items-center justify-between p-2 rounded-lg transition text-left ${
                isSelected
                  ? 'bg-sentinel-800 text-sky-300 font-bold border border-sentinel-600'
                  : 'text-slate-300 hover:bg-sentinel-850'
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-slate-100">{net.name}</p>
                <p className={`text-2xs ${net.color}`}>{net.tps} • {net.status}</p>
              </div>
              {isSelected && <Check className="h-4 w-4 text-sky-400 shrink-0" />}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
