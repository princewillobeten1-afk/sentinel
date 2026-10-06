'use client';

import React from 'react';
import { useTrendRadarStore } from '@/lib/store/trend-radar-store';
import { Flame, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

interface TrendRadarButtonProps {
  variant?: 'footer' | 'header' | 'toolbar';
  className?: string;
}

export function TrendRadarButton({ variant = 'footer', className }: TrendRadarButtonProps) {
  const { isOpen, toggleOpen, unreadCount } = useTrendRadarStore();

  if (variant === 'toolbar') {
    return (
      <button
        onClick={toggleOpen}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-mono font-bold transition border select-none',
          isOpen
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
            : 'bg-sentinel-900/90 text-slate-300 border-sentinel-700 hover:text-white hover:border-slate-500',
          className
        )}
        title="Toggle Meme Trends & Viral Newsfeed"
      >
        <Flame className="w-3.5 h-3.5 text-amber-400" />
        <span>Trends</span>
        {unreadCount > 0 && !isOpen && (
          <span className="ml-0.5 px-1 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-bold">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  if (variant === 'header') {
    return (
      <button
        onClick={toggleOpen}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition border select-none',
          isOpen
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
            : 'bg-sentinel-900/80 text-slate-300 border-sentinel-800 hover:text-white hover:border-sentinel-700 hover:bg-sentinel-800/60',
          className
        )}
        title="Toggle Meme Trends & Viral Newsfeed"
      >
        <Flame className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-mono text-2xs font-bold uppercase tracking-wider">Trends</span>
        {unreadCount > 0 && !isOpen && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </button>
    );
  }

  // Footer status bar style (matching X Social button)
  return (
    <button
      onClick={toggleOpen}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-0.5 rounded-md transition border text-2xs font-mono font-bold select-none',
        isOpen
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
          : 'bg-sentinel-900/90 text-slate-300 border-sentinel-800 hover:text-white hover:border-sentinel-700 hover:bg-white/[0.03]',
        className
      )}
      title="Open Viral Meme Trends & Newsfeed"
    >
      <Flame className="w-3 h-3 text-amber-400" />
      <span>Trends</span>
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          isOpen ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
        )}
      />
      {unreadCount > 0 && !isOpen && (
        <span className="px-1 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-bold">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
