'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRightLeft, BookmarkPlus, BellRing, ExternalLink } from 'lucide-react';
import { useWatchlist } from '@/lib/store';

interface IntelligenceActionsProps {
  symbol: string;
  chain: string;
  address: string;
  name: string;
}

export function IntelligenceActions({ symbol, chain, address, name }: IntelligenceActionsProps) {
  const { isWatchlisted, toggleWatchlist } = useWatchlist();
  const inWatchlist = isWatchlisted(address || symbol);

  return (
    <div className="bg-sentinel-900 border border-sentinel-700/60 rounded-xl p-5 shadow-card my-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>Take Action</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Execute trades, bookmark token, or set automated alert triggers.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        {/* Trade Link */}
        <Link
          href={`/trade?token=${encodeURIComponent(symbol)}`}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow-glow"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Trade {symbol}</span>
        </Link>

        {/* Watchlist Toggle */}
        <button
          onClick={() => toggleWatchlist(address || symbol)}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border font-semibold text-xs transition-colors ${
            inWatchlist
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              : 'bg-sentinel-800 border-sentinel-700 text-slate-200 hover:bg-sentinel-750'
          }`}
        >
          <BookmarkPlus className="w-4 h-4" />
          <span>{inWatchlist ? 'Watchlisted' : 'Watchlist'}</span>
        </button>

        {/* Set Alert */}
        <Link
          href={`/alerts?token=${encodeURIComponent(symbol)}`}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sentinel-800 border border-sentinel-700 text-slate-200 hover:bg-sentinel-750 font-semibold text-xs transition-colors"
        >
          <BellRing className="w-4 h-4 text-sky-400" />
          <span>Set Alert</span>
        </Link>

        {/* Explorer Link */}
        <a
          href={`https://explorer.solana.com/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-lg bg-sentinel-800 border border-sentinel-700 text-slate-400 hover:text-white transition-colors"
          title="View on Explorer"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
