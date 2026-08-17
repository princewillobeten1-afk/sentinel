import React from 'react';
import { clsx } from 'clsx';
import { Zap, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceChange } from '@/components/ui/price-change';
import { TokenBadge, TokenBadgeType } from '@/components/ui/token-badge';
import { Sparkline } from '@/components/ui/sparkline';
import { TokenSocials } from '@/components/ui/token-socials';

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
    badges = [],
    sparklineData,
  } = token;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border border-white/[0.08] bg-sentinel-900/80 backdrop-blur-xl p-3.5 shadow-card hover:border-sky-500/40 hover:bg-sentinel-850 hover:shadow-card-lift transition-all duration-200 hover:-translate-y-0.5 cursor-pointer space-y-2.5 relative overflow-hidden group',
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-glass opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      {/* Top Bar: Logo, Name, Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sentinel-750 font-bold text-sky-300 text-xs border border-sentinel-600/80 shrink-0 shadow-inner">
            {symbol.replace('$', '').slice(0, 3)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <h3 className="font-bold text-slate-100 text-xs truncate group-hover:text-sky-300 transition-colors">{name}</h3>
              <span className="text-[11px] font-mono text-slate-400 shrink-0">{symbol}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-slate-500 font-numeric">{mint.slice(0, 4)}...{mint.slice(-4)}</p>
              <TokenSocials symbol={symbol} showHandles={false} size="xs" />
            </div>
          </div>
        </div>

        {/* Intelligence Score Tag */}
        <div className="text-right font-numeric shrink-0">
          <span className="text-[9px] text-slate-500 uppercase font-mono block">Score</span>
          <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-md border', intelligenceScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(0,229,153,0.2)]' : intelligenceScore >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(255,184,0,0.2)]' : 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_8px_rgba(255,59,105,0.2)]')}>
            {intelligenceScore}/100
          </span>
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

      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-sentinel-800/80 text-[11px] font-numeric">
        <div>
          <span className="text-slate-500 text-[9px] uppercase font-mono block">MCap</span>
          <span className="font-bold text-slate-200">{mcap}</span>
        </div>
        <div>
          <span className="text-slate-500 text-[9px] uppercase font-mono block">Liquidity</span>
          <span className="font-bold text-slate-200">{liquidity}</span>
        </div>
        <div>
          <span className="text-slate-500 text-[9px] uppercase font-mono block">24h Vol</span>
          <span className="font-bold text-emerald-400">{volume24h}</span>
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
          className="w-full mt-1.5 text-xs font-bold shadow-[0_0_10px_rgba(0,229,153,0.25)]"
          leftIcon={<Zap className="h-3 w-3 fill-current" />}
        >
          Quick Trade
        </Button>
      )}
    </div>
  );
}
