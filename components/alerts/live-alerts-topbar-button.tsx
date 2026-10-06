'use client';

import React from 'react';
import { Radio, Volume2, VolumeX, Sparkles, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveAlerts } from '@/lib/hooks/use-live-alerts';

interface LiveAlertsTopbarButtonProps {
  variant?: 'ticker' | 'button';
  className?: string;
}

export function LiveAlertsTopbarButton({ variant = 'ticker', className }: LiveAlertsTopbarButtonProps) {
  const {
    activeAlert,
    setHistoryDrawerOpen,
    unreadCount,
    soundEnabled,
    toggleSound,
    isPaused,
  } = useLiveAlerts();

  if (variant === 'button') {
    return (
      <button
        onClick={() => setHistoryDrawerOpen(true)}
        className={clsx(
          'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition select-none',
          unreadCount > 0
            ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
            : 'bg-sentinel-900 border-sentinel-750 text-slate-300 hover:text-white hover:border-slate-500',
          className
        )}
        title="Open Live Alerts Feed (Trojan/BullX style)"
      >
        <Radio className={clsx('w-3.5 h-3.5', !isPaused && 'animate-pulse text-emerald-400')} />
        <span className="hidden sm:inline">Alerts</span>
        {unreadCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-bold text-3xs">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Upper ticker ribbon format
  return (
    <div className={clsx('flex items-center gap-1.5 shrink-0', className)}>
      <button
        onClick={() => setHistoryDrawerOpen(true)}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/[0.08] bg-sentinel-900/80 hover:bg-sentinel-800 text-slate-300 hover:text-white transition font-mono text-2xs group"
        title="Open Live Alerts Stream"
      >
        <span className="relative flex h-2 w-2">
          <span className={clsx('absolute inline-flex h-full w-full rounded-full opacity-75', isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping')} />
          <span className={clsx('relative inline-flex rounded-full h-2 w-2', isPaused ? 'bg-amber-400' : 'bg-emerald-500')} />
        </span>
        <span className="font-bold text-slate-400 group-hover:text-slate-200">Alerts:</span>
        {activeAlert ? (
          <span className="text-white truncate max-w-[140px] sm:max-w-[200px] font-semibold text-3xs">
            {activeAlert.type === 'CALL' && '📞 '}
            {activeAlert.type === 'WHALE_TRADE' && '🐋 '}
            {activeAlert.type === 'SMART_MONEY' && '🧠 '}
            {activeAlert.type === 'INSIDER_ACTIVITY' && '⚠️ '}
            {activeAlert.type === 'DEV_ACTIVITY' && '🛠️ '}
            {activeAlert.type === 'LAUNCHPAD_MILESTONE' && '👑 '}
            ${activeAlert.token.symbol}
          </span>
        ) : (
          <span className="text-emerald-400 font-bold">LIVE</span>
        )}
        {unreadCount > 0 && (
          <span className="px-1 py-0.1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-3xs font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      <button
        onClick={toggleSound}
        className={clsx(
          'p-0.5 rounded hover:bg-white/10 transition',
          soundEnabled ? 'text-sky-400' : 'text-slate-600'
        )}
        title={soundEnabled ? 'Live alert audio ON (Click to mute)' : 'Live alert audio MUTED (Click to unmute)'}
      >
        {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
      </button>
    </div>
  );
}
