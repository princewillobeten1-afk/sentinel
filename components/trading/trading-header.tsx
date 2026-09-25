'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Layers,
  Bell,
  Compass,
  Star,
  Shield,
  Radio,
  Command,
  ChevronRight,
} from 'lucide-react';
import { tokenSearchEngine } from '@/lib/market-data/rankings/search-engine';
import { RankedTokenItem } from '@/lib/market-data/types';
import { WalletConnectButton } from '../wallet/wallet-connect-button';
import { PriceChange } from '../market/price-change';

export function TradingHeader() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RankedTokenItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      const res = tokenSearchEngine.search(val, undefined, 6);
      setSearchResults(res.items);
      setIsSearchOpen(true);
      setSelectedIndex(0);
    } else {
      setSearchResults([]);
      setIsSearchOpen(false);
    }
  };

  const handleSelectToken = (tokenId: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    router.push(`/trade/solana/${tokenId}`);
  };

  const handleKeyDownNav = (e: React.KeyboardEvent) => {
    if (!isSearchOpen || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelectToken(searchResults[selectedIndex].tokenId);
      }
    }
  };

  return (
    <header className="w-full h-16 bg-sentinel-950/80 border-b border-white/5 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-40">
      {/* Brand & Quick Nav */}
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            ST
          </div>
          <div className="hidden sm:block font-mono">
            <span className="font-bold text-white tracking-tight text-sm block">SCALE TRADER</span>
            <span className="text-2xs text-sky-400 font-semibold block">TERMINAL v2</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 font-mono text-xs text-slate-400">
          <Link
            href="/discover"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/[0.04] transition"
          >
            <Compass className="h-3.5 w-3.5 text-sky-400" />
            <span>Discover</span>
          </Link>
          <Link
            href="/portfolio"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/[0.04] transition"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span>Portfolio</span>
          </Link>
        </nav>
      </div>

      {/* Global Token Search Bar */}
      <div className="relative flex-1 max-w-md hidden sm:block">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchQuery && setIsSearchOpen(true)}
            onKeyDown={handleKeyDownNav}
            placeholder="Search tokens, symbols, contracts... (Press '/' to focus)"
            className="w-full h-10 pl-10 pr-12 rounded-xl bg-white/[0.03] border border-white/10 hover:border-sky-500/30 focus:border-sky-500 focus:bg-sentinel-900 focus:outline-none text-xs font-mono text-white placeholder:text-slate-500 transition shadow-inner"
          />
          <kbd className="absolute right-3 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-2xs text-slate-400 font-mono">
            /
          </kbd>
        </div>

        {/* Search Results Dropdown */}
        {isSearchOpen && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl bg-sentinel-900 border border-white/10 shadow-2xl backdrop-blur-xl z-50 font-mono text-xs divide-y divide-white/5">
            {searchResults.map((item, idx) => (
              <div
                key={item.tokenId}
                onClick={() => handleSelectToken(item.tokenId)}
                className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition ${
                  idx === selectedIndex ? 'bg-sky-500/10 border border-sky-500/30' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-300 text-2xs">
                    {item.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{item.name}</span>
                      <span className="text-sky-400 font-bold text-2xs">${item.symbol}</span>
                    </div>
                    <span className="text-2xs text-slate-500">
                      Liq: ${(item.liquidityUsd / 1_000).toFixed(0)}K • Vol: ${(item.volumeUsd / 1_000).toFixed(0)}K
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-white block">${item.priceUsd.toFixed(4)}</span>
                  <PriceChange changePct={item.changePct} size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Network, Notifications & Wallet Connect */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs font-mono text-slate-300">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold">Solana Mainnet</span>
        </div>

        <WalletConnectButton />
      </div>
    </header>
  );
}
