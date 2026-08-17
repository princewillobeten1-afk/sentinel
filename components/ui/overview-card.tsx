import React from 'react';
import { clsx } from 'clsx';

interface OverviewCardProps {
  title: string;
  value: string;
  description: string;
  className?: string;
}

export function OverviewCard({ title, value, description, className }: OverviewCardProps) {
  return (
    <article className={clsx('rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-5 shadow-card transition-all hover:border-sentinel-600 hover:bg-sentinel-800', className)}>
      <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{title}</p>
      <p className="mt-3 text-2xl font-bold font-numeric text-white">{value}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{description}</p>
    </article>
  );
}
