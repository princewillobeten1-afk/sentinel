import React from 'react';
import { clsx } from 'clsx';
import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-4 space-y-3 shadow-card', className)}>
      <div className="flex items-center justify-between">
        <Skeleton variant="circular" width={36} height={36} />
        <Skeleton variant="rectangular" width={60} height={20} />
      </div>
      <Skeleton variant="text" width="60%" height={16} />
      <Skeleton variant="rectangular" width="100%" height={40} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={clsx('w-full overflow-hidden rounded-lg border border-sentinel-700/70 bg-sentinel-900/60 p-4 space-y-3', className)}>
      <div className="flex justify-between border-b border-sentinel-800 pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" width={80} height={16} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex justify-between py-2 border-b border-sentinel-800/40">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton key={cIdx} variant="text" width={70 + (cIdx % 3) * 20} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMetric({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-4 space-y-2 shadow-card', className)}>
      <Skeleton variant="text" width="40%" height={14} />
      <Skeleton variant="rectangular" width="70%" height={28} />
      <Skeleton variant="text" width="50%" height={12} />
    </div>
  );
}

export function SkeletonTokenCard({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-4 space-y-3 shadow-card', className)}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="space-y-1">
            <Skeleton variant="text" width={100} height={16} />
            <Skeleton variant="text" width={60} height={12} />
          </div>
        </div>
        <Skeleton variant="rectangular" width={50} height={20} />
      </div>
      <div className="flex justify-between items-end pt-2">
        <Skeleton variant="rectangular" width={80} height={24} />
        <Skeleton variant="rectangular" width={60} height={20} />
      </div>
      <Skeleton variant="rectangular" width="100%" height={32} />
    </div>
  );
}

export function SkeletonPortfolio({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-5 space-y-4 shadow-card', className)}>
      <Skeleton variant="text" width="30%" height={14} />
      <Skeleton variant="rectangular" width="50%" height={32} />
      <Skeleton variant="rectangular" width="100%" height={12} />
      <div className="space-y-2 pt-2">
        <Skeleton variant="text" width="100%" height={14} />
        <Skeleton variant="text" width="100%" height={14} />
      </div>
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={clsx('h-80 w-full rounded-xl border border-sentinel-700 bg-sentinel-950 p-4 flex flex-col justify-between shadow-card', className)}>
      <div className="flex justify-between">
        <Skeleton variant="rectangular" width={120} height={20} />
        <Skeleton variant="rectangular" width={160} height={20} />
      </div>
      <div className="h-48 w-full flex items-end justify-between gap-2 px-4">
        {Array.from({ length: 16 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" width="100%" height={`${30 + (i * 7) % 60}%`} />
        ))}
      </div>
      <Skeleton variant="rectangular" width="100%" height={16} />
    </div>
  );
}
