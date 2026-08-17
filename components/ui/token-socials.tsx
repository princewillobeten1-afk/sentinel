'use client';

import React from 'react';
import { Globe, MessageCircle, ExternalLink } from 'lucide-react';

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

/**
 * Generate default fallback social handles based on token symbol if none provided
 */
export function getDefaultSocialsForToken(symbol?: string, name?: string): TokenSocialLinks {
  const cleanSymbol = (symbol || 'SENT').replace('$', '').toLowerCase();
  
  if (cleanSymbol === 'sent' || cleanSymbol === 'sentinel') {
    return {
      twitter: 'https://x.com/Sentinel_SOL',
      telegram: 'https://t.me/SentinelSolana',
      website: 'https://sentinel.trade',
      discord: 'https://discord.gg/sentinel',
    };
  }

  if (cleanSymbol === 'sol' || cleanSymbol === 'solana') {
    return {
      twitter: 'https://x.com/solana',
      telegram: 'https://t.me/solana',
      website: 'https://solana.com',
    };
  }

  if (cleanSymbol === 'bonk') {
    return {
      twitter: 'https://x.com/bonk_inu',
      telegram: 'https://t.me/bonk_inu',
      website: 'https://bonkcoin.com',
    };
  }

  if (cleanSymbol === 'wif') {
    return {
      twitter: 'https://x.com/dogwifcoin',
      telegram: 'https://t.me/dogwifhat',
      website: 'https://dogwifhat.org',
    };
  }

  if (cleanSymbol === 'jup' || cleanSymbol === 'jupiter') {
    return {
      twitter: 'https://x.com/JupiterExchange',
      telegram: 'https://t.me/jupiterexchange',
      website: 'https://jup.ag',
      discord: 'https://discord.gg/jup',
    };
  }

  return {
    twitter: `https://x.com/${cleanSymbol}_sol`,
    telegram: `https://t.me/${cleanSymbol}_portal`,
    website: `https://${cleanSymbol}.xyz`,
  };
}

/** Extract username handle from url */
function extractHandle(url: string, platform: 'twitter' | 'telegram'): string {
  try {
    if (url.startsWith('@')) return url;
    const parts = url.replace(/\/$/, '').split('/');
    const last = parts[parts.length - 1];
    return last ? `@${last}` : '@handle';
  } catch {
    return '@community';
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
  const socials = customSocials || getDefaultSocialsForToken(symbol);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleText = socials.twitter ? extractHandle(socials.twitter, 'twitter') : `@${symbol?.toLowerCase() || 'token'}`;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`} onClick={handleClick}>
      {/* Twitter / X Handle Link */}
      {socials.twitter && (
        <a
          href={socials.twitter}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/40 hover:text-white font-mono transition group text-2xs"
          title={`Twitter / X: ${handleText}`}
        >
          <XTwitterIcon className="h-2.5 w-2.5 shrink-0 text-sky-400 group-hover:text-white" />
          {showHandles && <span className="font-semibold">{handleText}</span>}
          <ExternalLink className="h-2 w-2 opacity-50 group-hover:opacity-100" />
        </a>
      )}

      {/* Telegram Channel Link */}
      {socials.telegram && (
        <a
          href={socials.telegram}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:text-white font-mono transition group text-2xs"
          title="Telegram Community"
        >
          <TelegramIcon className="h-2.5 w-2.5 shrink-0 text-cyan-400 group-hover:text-white" />
          {showHandles && (
            <span className="font-semibold">
              {extractHandle(socials.telegram, 'telegram')}
            </span>
          )}
        </a>
      )}

      {/* Official Website Link */}
      {socials.website && (
        <a
          href={socials.website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 p-1 rounded-md border border-sentinel-750 bg-sentinel-850 hover:bg-sentinel-800 text-slate-400 hover:text-slate-200 transition text-2xs"
          title={`Website: ${socials.website}`}
        >
          <Globe className="h-2.5 w-2.5" />
        </a>
      )}

      {/* Discord Link */}
      {socials.discord && (
        <a
          href={socials.discord}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 p-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:text-white transition text-2xs"
          title="Discord Community"
        >
          <MessageCircle className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  );
}

export default TokenSocials;
