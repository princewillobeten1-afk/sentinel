import React, { useState } from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface MetricTileProps {
  title: string;
  rawValue?: string;
  value?: string;
  adjustedValue?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  isPositive?: boolean;
  icon?: any;
  subtitle?: string;
  badgeText?: string;
  badgeVariant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'risk-low' | 'risk-med' | 'risk-high';
  tooltipText?: string;
  sparklineData?: number[];
  className?: string;
}

export function MetricTile({
  title,
  rawValue,
  value,
  adjustedValue,
  change,
  changeType = 'neutral',
  isPositive,
  icon: Icon,
  subtitle,
  badgeText,
  badgeVariant = 'neutral',
  tooltipText,
  sparklineData,
  className,
}: MetricTileProps) {
  const [showAdjusted, setShowAdjusted] = useState(false);
  const actualRaw = rawValue || value || '';
  const displayValue = showAdjusted && adjustedValue ? adjustedValue : actualRaw;
  const actualChangeType = isPositive !== undefined ? (isPositive ? 'positive' : 'negative') : changeType;

  return (
    <div
      className={clsx(
        'rounded-xl border border-white/[0.08] bg-sentinel-900/80 backdrop-blur-xl p-3.5 sm:p-4 shadow-card hover:shadow-card-lift transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-500/35 relative overflow-hidden group',
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-glass opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{title}</span>
          {tooltipText && (
            <span className="text-slate-500 hover:text-slate-300 cursor-help" title={tooltipText}>
              <Info className="h-3 w-3" />
            </span>
          )}
        </div>
        {adjustedValue && (
          <button
            onClick={() => setShowAdjusted(!showAdjusted)}
            className={clsx(
              'px-1.5 py-0.5 rounded text-2xs font-mono transition-colors border',
              showAdjusted
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                : 'bg-sentinel-950 text-slate-400 border-sentinel-800 hover:text-slate-200'
            )}
          >
            {showAdjusted ? 'ADJUSTED' : 'RAW'}
          </button>
        )}
        {badgeText && !adjustedValue && (
          <Badge variant={badgeVariant as any} size="sm">
            {badgeText}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold font-numeric text-white tracking-tight">{displayValue}</span>
          {change && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 text-xs font-mono font-bold',
                actualChangeType === 'positive' && 'text-emerald-400',
                actualChangeType === 'negative' && 'text-rose-400',
                actualChangeType === 'neutral' && 'text-slate-400'
              )}
            >
              {actualChangeType === 'positive' && <TrendingUp className="h-3 w-3" />}
              {actualChangeType === 'negative' && <TrendingDown className="h-3 w-3" />}
              {change}
            </span>
          )}
        </div>

        {sparklineData && (
          <div className="h-6 w-16 flex items-end gap-0.5 opacity-75 group-hover:opacity-100 transition-opacity">
            {sparklineData.map((val, idx) => (
              <div
                key={idx}
                style={{ height: `${Math.min(100, Math.max(15, val))}%` }}
                className={clsx(
                  'w-2 rounded-t-[1px]',
                  actualChangeType === 'positive' ? 'bg-emerald-400/80 shadow-[0_0_4px_rgba(0,229,153,0.3)]' : actualChangeType === 'negative' ? 'bg-rose-400/80 shadow-[0_0_4px_rgba(255,59,105,0.3)]' : 'bg-sky-400/80'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-400 truncate">{subtitle}</p>}

      {showAdjusted && (
        <div className="mt-2 pt-1.5 border-t border-sentinel-700/50 flex items-center justify-between text-2xs text-sky-400 font-mono">
          <span className="flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Sentinel Adjusted Intelligence
          </span>
          <span>Raw: {actualRaw}</span>
        </div>
      )}
    </div>
  );
}
