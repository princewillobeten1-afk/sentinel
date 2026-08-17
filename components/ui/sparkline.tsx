import React from 'react';
import { clsx } from 'clsx';

export interface SparklineProps {
  data: number[];
  type?: 'line' | 'bar';
  color?: 'emerald' | 'rose' | 'sky' | 'amber';
  height?: number;
  width?: number;
  className?: string;
}

export function Sparkline({ data, type = 'line', color = 'sky', height = 24, width = 64, className }: SparklineProps) {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const colorStyles = {
    emerald: 'stroke-emerald-400 fill-emerald-500/20 bg-emerald-500',
    rose: 'stroke-rose-400 fill-rose-500/20 bg-rose-500',
    sky: 'stroke-sky-400 fill-sky-500/20 bg-sky-500',
    amber: 'stroke-amber-400 fill-amber-500/20 bg-amber-500',
  };

  if (type === 'bar') {
    return (
      <div style={{ height: `${height}px`, width: `${width}px` }} className={clsx('flex items-end gap-0.5', className)}>
        {data.map((val, idx) => {
          const pct = Math.max(15, Math.round(((val - min) / range) * 100));
          return (
            <div
              key={idx}
              style={{ height: `${pct}%` }}
              className={clsx('flex-1 rounded-t-xs opacity-80 hover:opacity-100 transition-opacity', colorStyles[color].split(' ')[2])}
            />
          );
        })}
      </div>
    );
  }

  // SVG Line Chart Sparkline
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className={clsx('overflow-visible', className)}>
      <polyline
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={colorStyles[color].split(' ')[0]}
      />
    </svg>
  );
}
