import React from 'react';
import { clsx } from 'clsx';
import { ShieldCheck, Sparkles, TrendingUp, AlertTriangle, Zap, Bot } from 'lucide-react';

export type TokenBadgeType = 'verified' | 'new' | 'trending' | 'high-risk' | 'smart-money' | 'ai-flagged';

export interface TokenBadgeProps {
  type: TokenBadgeType;
  size?: 'sm' | 'md';
  className?: string;
}

const badgeConfigs: Record<TokenBadgeType, { label: string; icon: React.ComponentType<{ className?: string }>; style: string }> = {
  verified: { label: 'VERIFIED', icon: ShieldCheck, style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  new: { label: 'NEW', icon: Sparkles, style: 'bg-sky-500/15 text-sky-400 border-sky-500/40' },
  trending: { label: 'TRENDING', icon: TrendingUp, style: 'bg-purple-500/15 text-purple-300 border-purple-500/40' },
  'high-risk': { label: 'HIGH RISK', icon: AlertTriangle, style: 'bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse' },
  'smart-money': { label: 'SMART MONEY', icon: Zap, style: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  'ai-flagged': { label: 'AI FLAGGED', icon: Bot, style: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' },
};

export function TokenBadge({ type, size = 'sm', className }: TokenBadgeProps) {
  const config = badgeConfigs[type];
  const IconComponent = config.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded font-mono font-bold tracking-wider uppercase border select-none',
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs',
        config.style,
        className
      )}
    >
      <IconComponent className="h-3 w-3 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}
