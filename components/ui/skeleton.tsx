import React from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'rectangular', width, height, style, ...props }: SkeletonProps) {
  return (
    <div
      style={{ width, height, ...style }}
      className={clsx(
        'animate-pulse bg-sentinel-800/60',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-3 rounded-md w-full',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      {...props}
    />
  );
}
