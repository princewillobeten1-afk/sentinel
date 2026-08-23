import React from 'react';
import { clsx } from 'clsx';
import { Zap, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceChange } from '@/components/ui/price-change';
import { TokenBadge, TokenBadgeType } from '@/components/ui/token-badge';
import { Sparkline } from '@/components/ui/sparkline';
import { TokenSocials } from '@/components/ui/token-socials';
import { TokenAvatar } from '@/components/ui/token-avatar';

export interface TokenCardData {
  name: string;
  symbol: string;
  mint: string;
  price: string;
  priceChange24h: number;
  mcap: string;
  liquidity: string;
  volume24h: string;
  intelligenceScore: number;
  logoURI?: string;
  badges?: TokenBadgeType[];
  sparklineData?: number[];
}

export interface TokenCardProps {
  token: TokenCardData;
  onQuickBuy?: () => void;
  onClick?: () => void;
  className?: string;
}

export function TokenCard({ token, onQuickBuy, onClick, className }: TokenCardProps) {
  const {
    name,
    symbol,
    mint,
    price,
    priceChange24h,
    mcap,
    liquidity,
    volume24h,
    intelligenceScore,
    logoURI,
    badges = [],
    sparklineData,
  } = token;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border border-white/[0.08] bg-sentinel-900/80 backdrop-blur-xl p-3.5 shadow-card hover:border-sky-500/40 hover:bg-sentinel-850 hover:shadow-card-lift transition-all duration-200 hover:-translate-y-0.5 cursor-pointer space-y-2.5 relative overflow-hidden group flex flex-col h-full',
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-glass opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

      {/* Identity row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <TokenAvatar
            src={logoURI}
            symbol={symbol}
            name={name}
            mint={mint}
            size="md"
          />
          {/* min-w-0 at every level: without it a flex item refuses to shrink
              below its content width and `truncate` silently does nothing. */}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-100 text-xs truncate group-hover:text-sky-300 transition-colors">
              {name}
            </h3>
            <span className="text-2xs font-mono text-slate-400 block truncate">{symbol}</span>
          </div>
        </div>

        {/* Intelligence Score. The glow shadows here referenced the retired neon
            palette (0,229,153 / 255,184,0 / 255,59,105) and read as a smear
            across the digits at this size — replaced by the border alone. */}
        <div className="text-right font-numeric shrink-0 leading-none">
          <span className="text-2xs text-slate-500 uppercase font-mono block mb-1">Score</span>
          <span
            className={clsx(
              'text-2xs font-bold px-1.5 py-0.5 rounded-md border inline-block whitespace-nowrap',
              intelligenceScore >= 80
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : intelligenceScore >= 50
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30',
            )}
          >
            {intelligenceScore}/100
          </span>
        </div>
      </div>

      {/* Address + socials, on their own line with room to sit inline. */}
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-2xs text-slate-500 font-numeric shrink-0">
          {mint.slice(0, 4)}...{mint.slice(-4)}
        </p>
        <div className="min-w-0 overflow-hidden">
          <TokenSocials symbol={symbol} showHandles={false} size="xs" className="flex-nowrap" />
        </div>
      </div>

      {/* Badges Row */}
      {badges.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {badges.map((b) => (
            <TokenBadge key={b} type={b} size="sm" />
          ))}
        </div>
      )}

      {/* Price & Sparkline */}
      <div className="flex items-baseline justify-between pt-0.5 font-numeric">
        <div>
          <span className="text-base font-bold text-white tracking-tight">{price}</span>
          <div className="mt-0.5">
            <PriceChange value={priceChange24h} size="xs" />
          </div>
        </div>

        {sparklineData && (
          <Sparkline
            data={sparklineData}
            color={priceChange24h >= 0 ? 'emerald' : 'rose'}
            width={65}
            height={24}
          />
        )}
      </div>

      {/* Financial metrics.
          Labels are abbreviated and each column is `min-w-0` + truncate: at a
          third of a narrow card, "Liquidity" and "24h Vol" overflowed their
          columns and ran together as the single string "LIQUIDITY24H VOL". */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-sentinel-800/80 text-2xs font-numeric">
        <div className="min-w-0">
          <span className="text-slate-500 text-2xs uppercase font-mono block truncate">MCap</span>
          <span className="font-bold text-slate-200 block truncate" title={mcap}>{mcap}</span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-500 text-2xs uppercase font-mono block truncate">Liq</span>
          <span className="font-bold text-slate-200 block truncate" title={liquidity}>{liquidity}</span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-500 text-2xs uppercase font-mono block truncate">Vol 24h</span>
          <span className="font-bold text-emerald-400 block truncate" title={volume24h}>{volume24h}</span>
        </div>
      </div>

      {/* Action Execution Button */}
      {onQuickBuy && (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onQuickBuy();
          }}
          variant="buy"
          size="xs"
          className="w-full mt-auto text-xs font-bold"
          leftIcon={<Zap className="h-3 w-3 fill-current" />}
        >
          Quick Trade
        </Button>
      )}
    </div>
  );
}
