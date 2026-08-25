'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Command, CheckCircle2, Wifi, ShieldCheck, Activity, Clock } from 'lucide-react';
import { useAppState, useAppActions } from '@/lib/store';

export function FooterStatusBar() {
  const { isConsoleOpen } = useAppState();
  const { setHotkeysOpen, setConsoleOpen } = useAppActions();
  /**
   * Every figure here is measured. None of them used to be.
   *
   * `wsState` was initialised to 'LIVE' and `latencyMs` to 12, and neither
   * setter was ever called — so the footer read "WS: LIVE (12MS)" permanently,
   * including while all five discovery endpoints were returning 503. The
   * freshness counter was a sawtooth that incremented 0.2 every 400ms and reset
   * at 2.5, and the block height was the literal 289,104,912.
   *
   * A trader sizing a position off a feed they believe is live at 12ms, which
   * is actually stale behind a failing backend, is the worst failure this
   * product can have. These now come from the stream's own health endpoint.
   */
  const [status, setStatus] = useState<{
    wsState: 'LIVE' | 'DELAYED' | 'RECONNECTING' | 'OFFLINE';
    latencyMs: number | null;
    lastMessageAgeSec: number | null;
    slot: number | null;
    engineOk: boolean;
  }>({ wsState: 'OFFLINE', latencyMs: null, lastMessageAgeSec: null, slot: null, engineOk: false });

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const startedAt = performance.now();
      try {
        const res = await fetch('/api/v1/market/live/status', { credentials: 'include' });
        // Round-trip to our own API. Labelled as API latency, because that is
        // what it measures — the WebSocket does not expose one.
        const latencyMs = Math.round(performance.now() - startedAt);
        if (!res.ok) throw new Error(String(res.status));

        const body = await res.json();
        const health = body?.data ?? body;
        const helius = health?.helius ?? {};

        const lastAt = helius.lastMessageAt ? Date.parse(helius.lastMessageAt) : NaN;
        const ageSec = Number.isFinite(lastAt) ? Math.max(0, (Date.now() - lastAt) / 1000) : null;

        const state: 'LIVE' | 'DELAYED' | 'RECONNECTING' | 'OFFLINE' =
          helius.state === 'open'
            ? ageSec !== null && ageSec > 30
              ? 'DELAYED'
              : 'LIVE'
            : helius.state === 'connecting'
              ? 'RECONNECTING'
              : 'OFFLINE';

        if (cancelled) return;
        setStatus({
          wsState: state,
          latencyMs,
          lastMessageAgeSec: ageSec,
          slot: typeof health?.slot === 'number' ? health.slot : null,
          engineOk: true,
        });
      } catch {
        // A failed status check means the engine is not reachable. Saying so is
        // the entire point of this bar.
        if (cancelled) return;
        setStatus((prev) => ({ ...prev, wsState: 'OFFLINE', latencyMs: null, engineOk: false }));
      }
    };

    void poll();
    const interval = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const { wsState, latencyMs, lastMessageAgeSec, slot, engineOk } = status;
  const isHealthy = engineOk && wsState === 'LIVE';
  const stateColour =
    wsState === 'LIVE'
      ? 'text-emerald-300'
      : wsState === 'DELAYED' || wsState === 'RECONNECTING'
        ? 'text-amber-300'
        : 'text-rose-300';

  return (
    <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-white/[0.08] bg-sentinel-950/90 backdrop-blur-2xl px-3 sm:px-4 py-1 text-[11px] font-numeric text-slate-400 select-none">
      {/* Left: Operational Metrics */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Subsystem Health Indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              isHealthy
                ? 'bg-emerald-400 animate-status-pulse shadow-[0_0_8px_rgba(0,229,153,0.8)]'
                : engineOk
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-300 font-bold">
            Engine: {engineOk ? (isHealthy ? 'Operational' : 'Degraded') : 'Unreachable'}
          </span>
        </div>

        {/* Network & WS Live State */}
        <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
          <Wifi className={`h-3 w-3 ${isHealthy ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span>
            Stream:{' '}
            <strong className={`${stateColour} font-bold uppercase`}>
              {wsState}
              {latencyMs === null ? '' : ` (api ${latencyMs}ms)`}
            </strong>
          </span>
        </div>

        {/* Data Freshness Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-slate-400">
          <Clock className="h-3 w-3 text-sky-400" />
          <span>
            Last event:{' '}
            <strong className="text-slate-200">
              {lastMessageAgeSec === null ? '—' : `${lastMessageAgeSec.toFixed(1)}s ago`}
            </strong>
          </span>
        </div>

        {/* Block Height */}
        <div className="hidden md:flex items-center gap-1.5 text-slate-400">
          <ShieldCheck className="h-3 w-3 text-sky-400" />
          <span>
            Slot:{' '}
            <strong className="text-slate-200 font-mono">
              {slot === null ? '—' : slot.toLocaleString()}
            </strong>
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConsoleOpen(!isConsoleOpen)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition border text-2xs font-mono font-bold ${
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
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sentinel-900/90 text-slate-400 border border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700 transition text-2xs font-mono"
        >
          <Command className="h-2.5 w-2.5 text-slate-400" />
          <span>Hotkeys (?)</span>
        </button>
      </div>
    </footer>
  );
}
