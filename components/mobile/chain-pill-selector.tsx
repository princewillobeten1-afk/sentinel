'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ChainPillSelectorProps {
  selectedChain?: string;
  onSelectChain?: (chain: string) => void;
}

export function ChainPillSelector({ selectedChain = 'solana', onSelectChain }: ChainPillSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 bg-[#0a0a0a] hover:bg-[#141414] border border-[#262626] rounded-full px-2.5 py-1 transition-colors"
        aria-label="Current Blockchain: Solana"
      >
        {/* Solana Logo with official linear gradient */}
        <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-[#9945FF] to-[#14F195] flex items-center justify-center text-[7px] font-black text-black shadow-sm shrink-0">
          S
        </span>
        <span className="text-xs font-semibold text-white tracking-tight">Solana</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <ChevronDown className="w-2.5 h-2.5 text-[#737373] ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-44 bg-[#0a0a0a] border border-[#262626] rounded-xl shadow-2xl py-1 z-50 text-xs">
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#525252] tracking-wider">
            Network
          </div>
          {/* Solana - Active */}
          <button
            type="button"
            onClick={() => {
              onSelectChain?.('solana');
              setIsOpen(false);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#141414] transition-colors text-white font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-[#9945FF] to-[#14F195] flex items-center justify-center text-[7px] font-bold text-black">
                S
              </span>
              <span>Solana</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded-full">
              Active
            </span>
          </button>

          <div className="h-px bg-[#1a1a1a] my-1" />

          {/* Other Chains Disabled with Coming Soon */}
          {[
            { id: 'ethereum', name: 'Ethereum', icon: 'Ξ', color: 'bg-[#627EEA]' },
            { id: 'bsc', name: 'BNB Chain', icon: 'B', color: 'bg-[#F3BA2F]' },
            { id: 'base', name: 'Base', icon: '●', color: 'bg-[#0052FF]' },
          ].map((chain) => (
            <div
              key={chain.id}
              className="w-full px-3 py-1.5 text-left flex items-center justify-between opacity-35 cursor-not-allowed select-none text-[#737373]"
            >
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold ${chain.color} text-white`}>
                  {chain.icon}
                </span>
                <span>{chain.name}</span>
              </div>
              <span className="text-[9px] text-[#737373] font-mono border border-[#262626] px-1 py-0.2 rounded">
                Soon
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
