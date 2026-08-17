'use client';

import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Star, Share2, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { watchlistService } from '@/lib/watchlist/watchlist-service';

interface TokenIdentityHeaderProps {
  tokenId: string;
  symbol: string;
  name: string;
  chainId: string;
  verifiedStatus: 'VERIFIED' | 'UNVERIFIED' | 'SUSPICIOUS';
  logoUrl?: string | null;
  initialWatchlisted?: boolean;
}

export function TokenIdentityHeader({
  tokenId,
  symbol,
  name,
  chainId,
  verifiedStatus,
  logoUrl,
  initialWatchlisted = false,
}: TokenIdentityHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [isWatchlisted, setIsWatchlisted] = useState(initialWatchlisted);

  const shortAddress = `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(tokenId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleWatchlist = () => {
    const newState = !isWatchlisted;
    setIsWatchlisted(newState);
    if (newState) {
      watchlistService.addToWatchlist('user_default', tokenId);
    } else {
      watchlistService.removeFromWatchlist('user_default', tokenId);
    }
  };

  // Dynamic Explorer Link based on chain
  const explorerUrl =
    chainId === 'solana'
      ? `https://solscan.io/token/${tokenId}`
      : chainId === 'base'
      ? `https://basescan.org/token/${tokenId}`
      : `https://etherscan.io/token/${tokenId}`;

  return (
    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-sentinel-900/50 border border-white/5 backdrop-blur-xl font-mono">
      {/* Left: Logo, Name, Symbol, Verification Badge */}
      <div className="flex items-center gap-3.5">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-600/20 border border-sky-500/30 flex items-center justify-center font-black text-sky-300 text-base shadow-[0_0_20px_rgba(56,189,248,0.15)] shrink-0">
          {symbol.slice(0, 3)}
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{name}</h1>
            <span className="text-sm font-bold text-sky-400">${symbol}</span>

            {/* Verification Status Badge */}
            {verifiedStatus === 'VERIFIED' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-2xs font-bold">
                <ShieldCheck className="h-3 w-3" />
                VERIFIED
              </span>
            ) : verifiedStatus === 'SUSPICIOUS' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-2xs font-bold">
                <ShieldAlert className="h-3 w-3" />
                SUSPICIOUS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-2xs font-bold">
                <AlertTriangle className="h-3 w-3" />
                UNVERIFIED
              </span>
            )}
          </div>

          {/* Contract Address & Explorer */}
          <div className="flex items-center gap-3 pt-1 text-xs text-slate-400">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-white transition group"
              title="Copy Token Contract Address"
            >
              <span>{shortAddress}</span>
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              )}
            </button>

            <span>•</span>

            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-sky-300 transition text-2xs"
            >
              <span>Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <span>•</span>

            <span className="text-2xs text-slate-500 uppercase">{chainId}</span>
          </div>
        </div>
      </div>

      {/* Right: Watchlist & Share Buttons */}
      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          onClick={handleToggleWatchlist}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
            isWatchlisted
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${isWatchlisted ? 'fill-amber-400 text-amber-400' : ''}`} />
          <span>{isWatchlisted ? 'Watchlisted' : 'Watchlist'}</span>
        </button>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: name, url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
            }
          }}
          className="h-8 w-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition"
          title="Share Token Link"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
