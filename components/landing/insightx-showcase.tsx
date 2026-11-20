'use client';

import React, { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Layers,
  Network,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
} from 'lucide-react';
import { AtlasLivePanel } from '@/components/insightx/atlas-live-panel';

interface ShowcasePreset {
  id: string;
  symbol: string;
  name: string;
  chain: 'solana' | 'robinhood';
  chainLabel: string;
  address: string;
}

const PRESETS: ShowcasePreset[] = [
  {
    id: 'bonk',
    symbol: 'BONK',
    name: 'Bonk',
    chain: 'solana',
    chainLabel: 'SOL',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  },
  {
    id: 'wif',
    symbol: 'WIF',
    name: 'dogwifhat',
    chain: 'solana',
    chainLabel: 'SOL',
    address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  },
  {
    id: 'jup',
    symbol: 'JUP',
    name: 'Jupiter',
    chain: 'solana',
    chainLabel: 'SOL',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  },
  {
    id: 'wsol',
    symbol: 'WSOL',
    name: 'Wrapped SOL',
    chain: 'solana',
    chainLabel: 'SOL',
    address: 'So11111111111111111111111111111111111111112',
  },
  {
    id: 'weth',
    symbol: 'WETH',
    name: 'Wrapped ETH',
    chain: 'robinhood',
    chainLabel: 'ROBINHOOD',
    address: '0x4200000000000000000000000000000000000006',
  },
];

export function InsightXShowcase() {
  const [selectedChain, setSelectedChain] = useState<'solana' | 'robinhood'>(PRESETS[0].chain);
  const [selectedAddress, setSelectedAddress] = useState<string>(PRESETS[0].address);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(PRESETS[0].symbol);
  const [queryInput, setQueryInput] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleSelectPreset = (preset: ShowcasePreset) => {
    setSelectedChain(preset.chain);
    setSelectedAddress(preset.address);
    setSelectedSymbol(preset.symbol);
    setInputError(null);
  };

  const handleInspectSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = queryInput.trim();
    if (!trimmed) {
      setInputError('Paste a Solana mint or 0x... Robinhood Chain token address.');
      return;
    }

    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setSelectedChain('robinhood');
      setSelectedAddress(trimmed.toLowerCase());
      setSelectedSymbol(`${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`);
      setInputError(null);
      return;
    }

    if (trimmed.length >= 32 && !trimmed.startsWith('0x')) {
      setSelectedChain('solana');
      setSelectedAddress(trimmed);
      setSelectedSymbol(`${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`);
      setInputError(null);
      return;
    }

    setInputError('Enter a valid Solana mint (32+ chars) or Robinhood EVM 0x address (42 chars).');
  };

  return (
    <div
      data-testid="insightx-landing-showcase"
      className="w-full rounded-2xl border border-[#1E222D] bg-[#0B0E15]/95 shadow-2xl backdrop-blur-xl overflow-hidden font-mono"
    >
      {/* Top Toolbar: Title, Preset Selector & Live Address Search */}
      <div className="flex flex-col gap-4 border-b border-[#1E222D] bg-[#080A10]/90 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-sky-400">
            <Network className="h-3.5 w-3.5" />
            <span>INSIGHTX ATLAS LIVE // MULTI-CHAIN CLUSTER ENGINE</span>
          </div>
          <h3 className="text-base font-bold text-white tracking-wide">
            Live Wallet Clusters, Snipers & Entity Maps
          </h3>
        </div>

        {/* Presets + Address Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#1E222D] bg-[#06070B] p-1">
            {PRESETS.map((preset) => {
              const isActive =
                selectedChain === preset.chain &&
                selectedAddress.toLowerCase() === preset.address.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`insightx-preset-${preset.id}`}
                  onClick={() => handleSelectPreset(preset)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    isActive
                      ? 'bg-[#526FFF]/20 text-[#8EA2FF] border border-[#526FFF]/40'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  <span>{preset.symbol}</span>
                  <span className="text-[9px] text-slate-500">{preset.chainLabel}</span>
                </button>
              );
            })}
          </div>

          <Link
            href={`/trade/${selectedChain}/${selectedAddress}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            <span>Open in Pro Terminal</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Interactive Token Search Bar */}
      <div className="border-b border-[#1E222D] bg-[#0A0D13] px-5 py-3">
        <form onSubmit={handleInspectSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Paste any Solana mint or 0x... Robinhood Chain token contract to inspect in InsightX..."
              className="w-full rounded-xl border border-[#1E222D] bg-[#06070B] py-2 pl-9 pr-3 text-xs font-mono text-white placeholder:text-slate-500 focus:border-[#526FFF]/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#415CF2] hover:bg-[#526FFF] px-4 py-2 text-xs font-bold text-white transition"
          >
            <span>Inspect in InsightX</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
        {inputError && (
          <p className="mt-1.5 text-[11px] font-mono text-rose-400">{inputError}</p>
        )}
      </div>

      {/* Live InsightX Atlas Panel */}
      <div className="p-4 sm:p-5 bg-[#06070B]/80">
        <AtlasLivePanel
          chain={selectedChain}
          address={selectedAddress}
          symbol={selectedSymbol}
        />
      </div>

      {/* 4-Item Capability Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-[#1E222D] bg-[#080A10]/90 p-4 sm:p-5 text-xs">
        <div className="rounded-xl border border-[#1E222D] bg-[#0B0F17] p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-sky-400 font-bold text-[11px]">
            <Network className="h-3.5 w-3.5" />
            <span>InsightX Atlas Live</span>
          </div>
          <p className="text-[11px] font-sans text-slate-400 leading-relaxed">
            Interactive multi-wallet cluster graph for Solana and Robinhood Chain tokens.
          </p>
        </div>

        <div className="rounded-xl border border-[#1E222D] bg-[#0B0F17] p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
            <Layers className="h-3.5 w-3.5" />
            <span>Distribution Metrics</span>
          </div>
          <p className="text-[11px] font-sans text-slate-400 leading-relaxed">
            Quantifies Gini inequality, HHI concentration, Nakamoto coefficient, and top-10 share.
          </p>
        </div>

        <div className="rounded-xl border border-[#1E222D] bg-[#0B0F17] p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Snipers, Bundlers & Insiders</span>
          </div>
          <p className="text-[11px] font-sans text-slate-400 leading-relaxed">
            Tracks early block snipers, slot-level bundlers, insider supply, and dev wallet holdings.
          </p>
        </div>

        <div className="rounded-xl border border-[#1E222D] bg-[#0B0F17] p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
            <Tag className="h-3.5 w-3.5" />
            <span>Wallet & Contract Labels</span>
          </div>
          <p className="text-[11px] font-sans text-slate-400 leading-relaxed">
            Tags funding addresses, volume bots, liquidity pools, exchanges, team, and burn wallets.
          </p>
        </div>
      </div>
    </div>
  );
}
