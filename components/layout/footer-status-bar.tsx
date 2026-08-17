'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Command, CheckCircle2, Wifi, ShieldCheck, Activity, Clock } from 'lucide-react';
import { useAppState, useAppActions } from '@/lib/store';

export function FooterStatusBar() {
  const { isConsoleOpen } = useAppState();
  const { setHotkeysOpen, setConsoleOpen } = useAppActions();
  const [freshnessSec, setFreshnessSec] = useState<number>(0.4);
  const [wsState, setWsState] = useState<'LIVE' | 'DELAYED' | 'RECONNECTING' | 'OFFLINE'>('LIVE');
  const [latencyMs, setLatencyMs] = useState<number>(12);

  useEffect(() => {
    const interval = setInterval(() => {
      setFreshnessSec((prev) => {
        const next = Math.round((prev + 0.2) * 10) / 10;
        return next > 2.5 ? 0.3 : next;
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-white/[0.08] bg-sentinel-950/90 backdrop-blur-2xl px-3 sm:px-4 py-1 text-[11px] font-numeric text-slate-400 select-none">
      {/* Left: Operational Metrics */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Subsystem Health Indicator */}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-status-pulse shadow-[0_0_8px_rgba(0,229,153,0.8)]" />
          <span className="text-slate-300 font-bold">Engine: Operational</span>
        </div>

        {/* Network & WS Live State */}
        <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
          <Wifi className="h-3 w-3 text-emerald-400" />
          <span>
            WS:{' '}
            <strong className="text-emerald-300 font-bold uppercase">
              {wsState} ({latencyMs}ms)
            </strong>
          </span>
        </div>

        {/* Data Freshness Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-slate-400">
          <Clock className="h-3 w-3 text-sky-400" />
          <span>
            Freshness: <strong className="text-slate-200">{freshnessSec}s ago</strong>
          </span>
        </div>

        {/* Block Height */}
        <div className="hidden md:flex items-center gap-1.5 text-slate-400">
          <ShieldCheck className="h-3 w-3 text-sky-400" />
          <span>
            Block: <strong className="text-slate-200 font-mono">289,104,912</strong>
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConsoleOpen(!isConsoleOpen)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition border text-[10px] font-mono font-bold ${
            isConsoleOpen
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
              : 'bg-sentinel-900/90 text-slate-400 border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700'
          }`}
        >
          <Terminal className="h-2.5 w-2.5 text-sky-400" />
          <span>Live Console</span>
        </button>

        <button
          onClick={() => setHotkeysOpen(true)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sentinel-900/90 text-slate-400 border border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700 transition text-[10px] font-mono"
        >
          <Command className="h-2.5 w-2.5 text-slate-400" />
          <span>Hotkeys (?)</span>
        </button>
      </div>
    </footer>
  );
}
