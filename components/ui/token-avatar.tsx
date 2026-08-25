'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { resolveTokenLogoUrl, getTokenGradient } from '@/lib/tokens/token-logos';

export type TokenAvatarSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface TokenAvatarProps {
  src?: string | null;
  symbol?: string | null;
  name?: string | null;
  mint?: string | null;
  size?: TokenAvatarSize;
  className?: string;
  dexBadge?: 'pump' | 'meteora' | 'raydium' | 'orca' | string | null;
}

const SIZE_CLASSES: Record<TokenAvatarSize, { container: string; text: string; badge: string }> = {
  '2xs': { container: 'w-5 h-5 rounded-md', text: 'text-[9px]', badge: 'w-2.5 h-2.5 text-[7px]' },
  xs: { container: 'w-7 h-7 rounded-lg', text: 'text-[10px]', badge: 'w-3 h-3 text-[8px]' },
  sm: { container: 'w-8 h-8 rounded-lg', text: 'text-xs', badge: 'w-3.5 h-3.5 text-[8px]' },
  md: { container: 'w-9 h-9 rounded-xl', text: 'text-xs', badge: 'w-3.5 h-3.5 text-2xs' },
  lg: { container: 'w-11 h-11 rounded-xl', text: 'text-sm', badge: 'w-4 h-4 text-xs' },
  xl: { container: 'w-14 h-14 rounded-2xl', text: 'text-base', badge: 'w-5 h-5 text-xs' },
};

export function TokenAvatar({
  src,
  symbol = 'TOK',
  name,
  mint,
  size = 'md',
  className,
  dexBadge,
}: TokenAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const cleanSymbol = (symbol || 'TOK').replace(/^\$/, '').toUpperCase();
  const initials = cleanSymbol.slice(0, 3) || 'TOK';
  const resolvedSrc = resolveTokenLogoUrl({ src, symbol: cleanSymbol, mint });
  const gradient = getTokenGradient(mint || cleanSymbol);
  const sizeConfig = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const isPump = dexBadge === 'pump' || dexBadge === 'Pump.fun' || mint?.toLowerCase().endsWith('pump');
  const isMeteora = dexBadge === 'meteora' || dexBadge === 'Meteora';
  const isRaydium = dexBadge === 'raydium' || dexBadge === 'Raydium';
  const isOrca = dexBadge === 'orca' || dexBadge === 'Orca';

  const badgeContent = isPump ? '💊' : isMeteora ? 'M' : isRaydium ? 'R' : isOrca ? 'O' : dexBadge;
  const badgeBg = isPump
    ? 'bg-emerald-500 text-slate-950 font-black'
    : isMeteora
    ? 'bg-purple-500 text-white font-bold'
    : isRaydium
    ? 'bg-sky-500 text-slate-950 font-bold'
    : isOrca
    ? 'bg-amber-400 text-slate-950 font-bold'
    : 'bg-slate-700 text-slate-200 font-bold';

  return (
    <div
      className={clsx(
        'relative shrink-0 flex items-center justify-center font-bold overflow-hidden select-none border border-slate-750/80 shadow-inner bg-slate-900',
        sizeConfig.container,
        className
      )}
      title={name || cleanSymbol}
    >
      {resolvedSrc && !hasError ? (
        <img
          src={resolvedSrc}
          alt={name || cleanSymbol}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={clsx(
            'w-full h-full flex items-center justify-center bg-gradient-to-br font-sans tracking-tight',
            gradient,
            sizeConfig.text
          )}
        >
          <span>{initials}</span>
        </div>
      )}

      {/* Optional DEX Badge in bottom-right corner */}
      {dexBadge && (
        <div
          className={clsx(
            'absolute bottom-0 right-0 rounded-tl-md flex items-center justify-center leading-none shadow-sm',
            sizeConfig.badge,
            badgeBg
          )}
          title={`Exchange: ${dexBadge}`}
        >
          {badgeContent}
        </div>
      )}
    </div>
  );
}
