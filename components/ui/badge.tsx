import React from 'react';
import { clsx } from 'clsx';

export type BadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'risk-low'
  | 'risk-med'
  | 'risk-high'
  | 'risk-critical'
  | 'cyan'
  | 'purple'
  | 'mono'
  | 'outline'
  | 'secondary'
  | 'default'
  | 'destructive';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const badgeVariants: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(0,229,153,0.15)]',
  danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(255,59,105,0.15)]',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(255,184,0,0.15)]',
  info: 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-[0_0_8px_rgba(0,240,255,0.15)]',
  neutral: 'bg-sentinel-800 text-slate-300 border border-sentinel-700',

  'risk-low': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold shadow-[0_0_8px_rgba(0,229,153,0.15)]',
  'risk-med': 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono font-bold shadow-[0_0_8px_rgba(255,184,0,0.15)]',
  'risk-high': 'bg-rose-500/15 text-rose-400 border border-rose-500/40 font-mono font-bold shadow-[0_0_10px_rgba(255,59,105,0.2)]',
  'risk-critical': 'bg-rose-500/25 text-rose-300 border border-rose-500/60 font-mono font-extrabold shadow-[0_0_12px_rgba(255,59,105,0.3)]',

  cyan: 'bg-sky-500/10 text-sky-300 border border-sky-500/30 font-mono shadow-[0_0_8px_rgba(0,240,255,0.15)]',
  purple: 'bg-purple-500/10 text-purple-300 border border-purple-500/30 font-mono shadow-[0_0_8px_rgba(168,85,247,0.15)]',
  mono: 'bg-sentinel-900/90 text-slate-300 border border-sentinel-700/80 font-mono',
  outline: 'bg-transparent text-slate-200 border border-sentinel-700',
  secondary: 'bg-sentinel-800 text-slate-300 border border-sentinel-700',
  default: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
  destructive: 'bg-rose-500/15 text-rose-400 border border-rose-500/40',
};

export function Badge({ className, variant = 'neutral', size = 'md', pulse = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md font-semibold uppercase select-none whitespace-nowrap',
        'tracking-[0.06em] leading-none',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-2xs',
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {pulse && <span className="h-1.5 w-1.5 rounded-full bg-current animate-status-pulse shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
