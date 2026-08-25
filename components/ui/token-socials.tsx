'use client';

import React from 'react';
import { Globe, MessageCircle, ExternalLink, BarChart2 } from 'lucide-react';

export interface TokenSocialLinks {
  twitter?: string;
  telegram?: string;
  website?: string;
  discord?: string;
}

export interface TokenSocialsProps {
  socials?: TokenSocialLinks;
  symbol?: string;
  mint?: string;
  showHandles?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const KNOWN_PROJECT_SOCIALS: Record<string, TokenSocialLinks> = {
  SENT: {
    twitter: 'https://x.com/Sentinel_SOL',
    telegram: 'https://t.me/SentinelSolana',
    website: 'https://sentinel.trade',
    discord: 'https://discord.gg/sentinel',
  },
  SOL: {
    twitter: 'https://x.com/solana',
    telegram: 'https://t.me/solana',
    website: 'https://solana.com',
  },
  WSOL: {
    twitter: 'https://x.com/solana',
    telegram: 'https://t.me/solana',
    website: 'https://solana.com',
  },
  BONK: {
    twitter: 'https://x.com/bonk_inu',
    telegram: 'https://t.me/bonk_inu',
    website: 'https://bonkcoin.com',
  },
  WIF: {
    twitter: 'https://x.com/dogwifcoin',
    telegram: 'https://t.me/dogwifhat',
    website: 'https://dogwifhat.org',
  },
  JUP: {
    twitter: 'https://x.com/JupiterExchange',
    telegram: 'https://t.me/jupiterexchange',
    website: 'https://jup.ag',
    discord: 'https://discord.gg/jup',
  },
  RAY: {
    twitter: 'https://x.com/RaydiumProtocol',
    telegram: 'https://t.me/raydiumprotocol',
    website: 'https://raydium.io',
  },
  ORCA: {
    twitter: 'https://x.com/orca_so',
    telegram: 'https://t.me/orca_so',
    website: 'https://orca.so',
  },
  POPCAT: {
    twitter: 'https://x.com/POPCATSOLANA',
    telegram: 'https://t.me/popcatsolana',
    website: 'https://popcatsolana.xyz',
  },
};

/**
 * Resolves authentic social links, avoiding fake auto-generated links.
 */
export function getDefaultSocialsForToken(symbol?: string): TokenSocialLinks {
  const cleanSymbol = (symbol || '').replace(/^\$/, '').toUpperCase();
  if (cleanSymbol && KNOWN_PROJECT_SOCIALS[cleanSymbol]) {
    return KNOWN_PROJECT_SOCIALS[cleanSymbol];
  }

  // Safe fallback: Real search query for the token symbol on Twitter / X
  return {
    twitter: cleanSymbol ? `https://x.com/search?q=${encodeURIComponent(`$${cleanSymbol}`)}` : undefined,
  };
}

/** Extract clean handle display from url */
function extractHandle(url: string, platform: 'twitter' | 'telegram', fallbackSymbol?: string): string {
  try {
    if (url.startsWith('@')) return url;
    if (url.includes('x.com/search') || url.includes('twitter.com/search')) {
      return fallbackSymbol ? `$${fallbackSymbol.replace('$', '')}` : 'Search X';
    }
    const clean = url.replace(/\/$/, '').split('?')[0];
    const parts = clean.split('/');
    const last = parts[parts.length - 1];
    return last ? `@${last}` : (fallbackSymbol ? `$${fallbackSymbol}` : '@handle');
  } catch {
    return fallbackSymbol ? `$${fallbackSymbol}` : '@community';
  }
}

// X / Twitter SVG Icon
export function XTwitterIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Telegram SVG Icon
export function TelegramIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export function TokenSocials({
  socials: customSocials,
  symbol,
  mint,
  showHandles = true,
  size = 'xs',
  className = '',
}: TokenSocialsProps) {
  const fallback = getDefaultSocialsForToken(symbol);
  const twitter = customSocials?.twitter || fallback.twitter;
  const telegram = customSocials?.telegram || fallback.telegram;
  const website = customSocials?.website || fallback.website;
  const discord = customSocials?.discord || fallback.discord;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const isPump = mint?.toLowerCase().endsWith('pump');

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`} onClick={handleClick}>
      {/* Twitter / X Handle Link */}
      {twitter && (
        <a
          href={twitter}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/40 hover:text-white font-mono transition group text-2xs"
          title={twitter.includes('search') ? `Search Twitter/X for $${symbol}` : `Official Twitter/X`}
        >
          <XTwitterIcon className="h-2.5 w-2.5 shrink-0 text-sky-400 group-hover:text-white" />
          {showHandles && <span className="font-semibold">{extractHandle(twitter, 'twitter', symbol)}</span>}
          <ExternalLink className="h-2 w-2 opacity-50 group-hover:opacity-100" />
        </a>
      )}

      {/* Telegram Channel Link (Only if verified URL exists) */}
      {telegram && (
        <a
          href={telegram}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:text-white font-mono transition group text-2xs"
          title="Telegram Community"
        >
          <TelegramIcon className="h-2.5 w-2.5 shrink-0 text-cyan-400 group-hover:text-white" />
          {showHandles && (
            <span className="font-semibold">
              {extractHandle(telegram, 'telegram', symbol)}
            </span>
          )}
        </a>
      )}

      {/* Official Website Link (Only if verified URL exists) */}
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-white transition text-2xs font-mono"
          title={`Website: ${website}`}
        >
          <Globe className="h-2.5 w-2.5 shrink-0" />
          {showHandles && <span className="font-semibold">Website</span>}
        </a>
      )}

      {/* Discord Link */}
      {discord && (
        <a
          href={discord}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 p-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:text-white transition text-2xs"
          title="Discord Community"
        >
          <MessageCircle className="h-2.5 w-2.5" />
        </a>
      )}

      {/* DexScreener Chart Link (if mint provided) */}
      {mint && (
        <a
          href={`https://dexscreener.com/solana/${mint}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition text-2xs font-mono"
          title="View on DexScreener"
        >
          <BarChart2 className="h-2.5 w-2.5 text-emerald-400" />
          {showHandles && <span className="font-semibold">DexScreener</span>}
        </a>
      )}

      {/* Pump.fun Link if applicable */}
      {isPump && mint && (
        <a
          href={`https://pump.fun/coin/${mint}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-white transition text-2xs font-mono font-bold"
          title="View on Pump.fun"
        >
          <span>💊</span>
          {showHandles && <span>Pump.fun</span>}
        </a>
      )}
    </div>
  );
}

export default TokenSocials;
