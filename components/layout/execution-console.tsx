'use client';

import React from 'react';
import { Terminal, X, Trash2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useAppState, useAppActions } from '@/lib/store';

export function ExecutionConsole() {
  const { isConsoleOpen, executionLogs } = useAppState();
  const { setConsoleOpen } = useAppActions();

  if (!isConsoleOpen) return null;

  return (
    <div className="fixed bottom-8 left-0 right-0 z-40 bg-sentinel-950/95 border-t border-sentinel-700 shadow-2xl backdrop-blur-md max-h-56 flex flex-col font-mono text-xs animate-in slide-in-from-bottom duration-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-sentinel-800 px-4 py-2 bg-sentinel-900/90 text-slate-300">
        <div className="flex items-center gap-2 font-bold text-sky-400">
          <Terminal className="h-4 w-4" /> Live Engine Logs & WebSockets
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xs text-emerald-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-status-pulse" /> RPC Online
          </span>
          <button
            onClick={() => setConsoleOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-100 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Log Feed Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 bg-black/60 font-numeric">
        {executionLogs.map((log) => (
          <div key={log.id} className="flex items-start gap-2 text-2xs leading-snug">
            <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
            {log.level === 'info' && <Info className="h-3 w-3 text-sky-400 shrink-0 mt-0.5" />}
            {log.level === 'warn' && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />}
            {log.level === 'error' && <X className="h-3 w-3 text-rose-400 shrink-0 mt-0.5" />}
            {log.level === 'success' && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />}
            <span
              className={
                log.level === 'warn'
                  ? 'text-amber-300'
                  : log.level === 'error'
                  ? 'text-rose-300'
                  : log.level === 'success'
                  ? 'text-emerald-300'
                  : 'text-slate-300'
              }
            >
              {log.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
