'use client';

import React from 'react';
import { useXTrackerStore } from '@/lib/store/x-tracker-store';
import { clsx } from 'clsx';

interface XTrackerButtonProps {
  variant?: 'footer' | 'header' | 'toolbar';
  className?: string;
}

export function XTrackerButton({ variant = 'footer', className }: XTrackerButtonProps) {
  const { isOpen, toggleOpen, unreadCount } = useXTrackerStore();

  if (variant === 'toolbar') {
    return (
      <button
        onClick={toggleOpen}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-mono font-bold transition border select-none',
          isOpen
            ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
            : 'bg-sentinel-900/90 text-slate-300 border-sentinel-700 hover:text-white hover:border-slate-500',
          className
        )}
        title="Toggle X Social Tracker (Axiom style)"
      >
        <span className="font-bold text-xs">𝕏</span>
        <span>Tracker</span>
        {unreadCount > 0 && !isOpen && (
          <span className="ml-0.5 px-1 py-0.2 rounded-full bg-emerald-500 text-black text-[9px] font-bold">
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
            ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
            : 'bg-sentinel-900/80 text-slate-300 border-sentinel-800 hover:text-white hover:border-sentinel-700 hover:bg-sentinel-800/60',
          className
        )}
        title="Toggle X Tracker Feed"
      >
        <div className="w-4 h-4 rounded bg-white/[0.08] flex items-center justify-center font-bold text-white text-[10px]">
          𝕏
        </div>
        <span className="font-mono text-2xs font-bold uppercase tracking-wider">Social</span>
        {unreadCount > 0 && !isOpen && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>
    );
  }

  // Footer status bar style (matching Axiom bottom navigation)
  return (
    <button
      onClick={toggleOpen}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-0.5 rounded-md transition border text-2xs font-mono font-bold select-none',
        isOpen
          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
          : 'bg-sentinel-900/90 text-slate-300 border-sentinel-800 hover:text-white hover:border-sentinel-700 hover:bg-white/[0.03]',
        className
      )}
      title="Open Axiom-style X Tracker feed"
    >
      <span className="font-bold text-xs text-white">𝕏</span>
      <span>Social</span>
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          isOpen ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400'
        )}
      />
      {unreadCount > 0 && !isOpen && (
        <span className="px-1 py-0.2 rounded-full bg-emerald-500 text-black text-[9px] font-bold">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
