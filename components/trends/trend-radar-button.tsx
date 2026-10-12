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
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-mono font-bold transition-all border select-none',
          isOpen
            ? 'bg-warn-500/20 text-warn-300 border-warn-500/50 shadow-glow-amber'
            : 'bg-neutral-900/90 text-neutral-300 border-neutral-750 hover:text-white hover:border-neutral-600',
          className
        )}
        title="Toggle Meme Trends & Viral Newsfeed"
      >
        <Flame className="w-3.5 h-3.5 text-warn-400" />
        <span>Trends</span>
        {unreadCount > 0 && !isOpen && (
          <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-warn-500 text-neutral-950 text-3xs font-black">
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
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border select-none',
          isOpen
            ? 'bg-warn-500/20 text-warn-300 border-warn-500/50 shadow-glow-amber'
            : 'bg-neutral-900/80 text-neutral-300 border-neutral-800 hover:text-white hover:border-neutral-700 hover:bg-neutral-850',
          className
        )}
        title="Toggle Meme Trends & Viral Newsfeed"
      >
        <Flame className="w-3.5 h-3.5 text-warn-400" />
        <span className="font-mono text-2xs font-bold uppercase tracking-wider">Trends</span>
        {unreadCount > 0 && !isOpen && (
          <span className="w-2 h-2 rounded-full bg-warn-400 animate-pulse" />
        )}
      </button>
    );
  }

  // Footer status bar style
  return (
    <button
      onClick={toggleOpen}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all border text-2xs font-mono font-bold select-none',
        isOpen
          ? 'bg-warn-500/20 text-warn-300 border-warn-500/50 shadow-glow-amber'
          : 'bg-neutral-900/90 text-neutral-300 border-neutral-800 hover:text-white hover:border-neutral-700 hover:bg-neutral-850',
        className
      )}
      title="Open Viral Meme Trends & Newsfeed"
    >
      <Flame className="w-3 h-3 text-warn-400" />
      <span>Trends</span>
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          isOpen ? 'bg-warn-400 animate-pulse' : 'bg-buy-400'
        )}
      />
      {unreadCount > 0 && !isOpen && (
        <span className="px-1.5 py-0.2 rounded-full bg-warn-500 text-neutral-950 text-3xs font-black">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
