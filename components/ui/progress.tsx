import React from 'react';
import { clsx } from 'clsx';

export interface ProgressProps {
  value: number; // 0 to 100
  color?: 'emerald' | 'rose' | 'sky' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function Progress({ value, color = 'sky', size = 'md', showLabel = false, className }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const heightStyles = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3.5',
  };

  const colorStyles = {
    emerald: 'bg-emerald-400',
    rose: 'bg-rose-400',
    sky: 'bg-sky-400',
    amber: 'bg-amber-400',
  };

  return (
    <div className={clsx('w-full space-y-1 select-none', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span>Progress</span>
          <span className="font-bold text-slate-200">{clampedValue}%</span>
        </div>
      )}
      <div className={clsx('w-full rounded-full bg-sentinel-950 overflow-hidden border border-sentinel-800', heightStyles[size])}>
        <div
          style={{ width: `${clampedValue}%` }}
          className={clsx('h-full transition-all duration-300', colorStyles[color])}
        />
      </div>
    </div>
  );
}
