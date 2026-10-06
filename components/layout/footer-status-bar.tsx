'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Terminal,
  Command,
  HelpCircle,
  BookOpen,
  Settings,
} from 'lucide-react';
import { useAppState, useAppActions } from '@/lib/store';
import { XTrackerButton } from '@/components/x-tracker/x-tracker-button';
import { TrendRadarButton } from '@/components/trends/trend-radar-button';
import { AlertsToggle } from '@/components/layout/notification-toggle';

export function FooterStatusBar() {
  const pathname = usePathname();
  const { isConsoleOpen } = useAppState();
  const { setHotkeysOpen, setConsoleOpen, setActiveView } = useAppActions();

  return (
    <footer className="terminal-footer shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-sentinel-700 bg-sentinel-950 px-3 sm:px-4 py-2 text-2xs font-numeric text-slate-400 select-none">
      {/* Left */}
      <div className="flex items-center gap-2" />

      {/* Right: Navigation Links & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {/* Axiom-Style X Social Tracker Action */}
        <XTrackerButton variant="footer" />

        {/* Real-time Meme Trends & Viral Newsfeed Action */}
        <TrendRadarButton variant="footer" />

        {/* Live Pop-up Alerts On/Off Toggle */}
        <AlertsToggle variant="footer" />

        <span className="hidden sm:inline-block h-3 w-px bg-sentinel-800 mx-0.5" aria-hidden="true" />

        {/* Help Link */}
        <Link
          href="/help"
          prefetch={true}
          onClick={() => setActiveView('help')}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-md transition border text-2xs font-mono',
            pathname === '/help'
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
              : 'bg-sentinel-900/90 text-slate-400 border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700'
          )}
          title="Help & documentation"
        >
          <HelpCircle className="h-2.5 w-2.5 text-sky-400" />
          <span>Help</span>
        </Link>

        {/* Docs Link */}
        <Link
          href="/docs"
          prefetch={true}
          onClick={() => setActiveView('developers')}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-md transition border text-2xs font-mono',
            pathname === '/docs' || pathname === '/developers'
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
              : 'bg-sentinel-900/90 text-slate-400 border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700'
          )}
          title="Developer platform and API documentation"
        >
          <BookOpen className="h-2.5 w-2.5 text-sky-400" />
          <span>Docs</span>
        </Link>

        {/* Settings Link */}
        <Link
          href="/settings"
          prefetch={true}
          onClick={() => setActiveView('settings')}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-md transition border text-2xs font-mono',
            pathname === '/settings' || pathname?.startsWith('/settings/')
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
              : 'bg-sentinel-900/90 text-slate-400 border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700'
          )}
          title="Terminal settings & preferences"
        >
          <Settings className="h-2.5 w-2.5 text-sky-400" />
          <span>Settings</span>
        </Link>

        <span className="hidden sm:inline-block h-3 w-px bg-sentinel-800 mx-0.5" aria-hidden="true" />

        {/* Console Action */}
        <button
          onClick={() => setConsoleOpen(!isConsoleOpen)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition border text-2xs font-mono font-bold ${
            isConsoleOpen
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
              : 'bg-sentinel-900/90 text-slate-400 border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700'
          }`}
        >
          <Terminal className="h-2.5 w-2.5 text-sky-400" />
          <span>Console</span>
        </button>

        {/* Hotkeys Action */}
        <button
          onClick={() => setHotkeysOpen(true)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sentinel-900/90 text-slate-400 border border-sentinel-800 hover:text-slate-200 hover:border-sentinel-700 transition text-2xs font-mono"
        >
          <Command className="h-2.5 w-2.5 text-slate-400" />
          <span>Hotkeys</span>
        </button>
      </div>
    </footer>
  );
}

export default FooterStatusBar;
