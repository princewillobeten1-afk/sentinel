import React from 'react';
import { clsx } from 'clsx';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface PriceChangeProps {
  value: number; // percentage e.g. +14.2 or -5.8 or 0
  formatted?: string; // explicit text if provided
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showTextPrefix?: boolean; // Sprint 32 §45: Color Independence (e.g. + / - or Profit / Loss)
  className?: string;
}

/**
 * Accessible, Color-Independent Price Change Component (Sprint 32 §44-45).
 *
 * Ensures that price change indicators do not rely solely on color (green/red)
 * to communicate gain/loss, providing directional icons, unambiguous mathematical signs (+ / -),
 * and descriptive ARIA labels for screen readers.
 */
export function PriceChange({
  value,
  formatted,
  size = 'sm',
  showIcon = true,
  showTextPrefix = true,
  className,
}: PriceChangeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  const sign = isPositive ? '+' : isNegative ? '-' : '';
  const absValue = Math.abs(value);
  const displayString = formatted || `${sign}${absValue.toFixed(2)}%`;
  const ariaLabel = isPositive
    ? `Profit of ${displayString}`
    : isNegative
    ? `Loss of ${displayString}`
    : `Neutral change 0.00%`;

  const sizeClasses = {
    xs: 'text-2xs gap-0.5',
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1.5 font-bold',
  };

  const iconSizes = {
    xs: 'h-2.5 w-2.5',
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-4 w-4',
  };

  return (
    <span
      role="text"
      aria-label={ariaLabel}
      className={clsx(
        'inline-flex items-center font-mono font-semibold select-none',
        sizeClasses[size],
        isPositive && 'text-emerald-400',
        isNegative && 'text-rose-400',
        isNeutral && 'text-slate-400',
        className
      )}
    >
      {showIcon && (
        <span aria-hidden="true" className="shrink-0 inline-flex items-center">
          {isPositive && <ArrowUpRight className={clsx('shrink-0', iconSizes[size])} />}
          {isNegative && <ArrowDownRight className={clsx('shrink-0', iconSizes[size])} />}
          {isNeutral && <Minus className={clsx('shrink-0', iconSizes[size])} />}
        </span>
      )}
      <span>{displayString}</span>
    </span>
  );
}
