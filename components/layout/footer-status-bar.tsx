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

export interface FooterStatusBarProps {
  layout?: 'page' | 'workspace';
  className?: string;
}

export function FooterStatusBar({ layout = 'page', className }: FooterStatusBarProps) {
  const pathname = usePathname();
  const { isConsoleOpen, activeChain } = useAppState();
  const { setHotkeysOpen, setConsoleOpen, setActiveView } = useAppActions();

  return (
    <footer
      className={clsx(
        'terminal-footer z-30 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#1E222D] bg-[#06070B]/95 backdrop-blur-md px-3 sm:px-4 py-1 text-[11px] font-numeric text-[#828598] select-none shadow-[0_-6px_24px_rgba(0,0,0,0.7)] transition-all',
        layout === 'page' ? 'fixed bottom-0 inset-x-0' : 'shrink-0',
        className
      )}
    >
      {/* Left: Live Connection & Execution Telemetry */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5 rounded-[4px] bg-[#12AF80]/12 border border-[#12AF80]/25 px-2 py-0.5 font-mono text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2FE3AC] animate-pulse shadow-[0_0_6px_rgba(47,227,172,0.8)]" />
          <span className="font-semibold text-[#2FE3AC] tracking-tight">
            {activeChain === 'robinhood' ? 'GLOBAL · ROBINHOOD L2' : 'GLOBAL · SOLANA'}
          </span>
          <span className="text-[#2FE3AC]/50 hidden sm:inline">·</span>
          <span className="text-[#2FE3AC] font-semibold hidden sm:inline">18ms</span>
        </div>
        <span className="inline-flex items-center rounded-[4px] bg-[#526FFF]/15 border border-[#526FFF]/30 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#8EA2FF] tracking-wide">
          PRESET 1
        </span>
        <span className="text-[#525866] font-mono text-[10.5px] hidden md:inline">PHIVEX V2.4</span>
      </div>

      {/* Right: Navigation Links & Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Axiom-Style X Social Tracker Action */}
        <XTrackerButton variant="footer" />

        {/* Real-time Meme Trends & Viral Newsfeed Action */}
        <TrendRadarButton variant="footer" />

        {/* Live Pop-up Alerts On/Off Toggle */}
        <AlertsToggle variant="footer" />

        <span className="hidden sm:inline-block h-3 w-px bg-[#1E222D] mx-0.5" aria-hidden="true" />

        {/* Help Link */}
        <Link
          href="/help"
          prefetch={true}
          onClick={() => setActiveView('help')}
          className={clsx(
            'flex items-center gap-1.5 h-[22px] px-2 rounded-[4px] transition border text-[11px] font-mono',
            pathname === '/help'
              ? 'bg-[#526FFF]/15 text-[#8EA2FF] border-[#526FFF]/35'
              : 'bg-[#11141B] text-[#828598] border-[#1E222D] hover:text-[#F7F8F9] hover:border-[#32374A]'
          )}
          title="Help & documentation"
        >
          <HelpCircle className="h-2.5 w-2.5 text-[#526FFF]" />
          <span>Help</span>
        </Link>

        {/* Docs Link */}
        <Link
          href="/docs"
          prefetch={true}
          onClick={() => setActiveView('developers')}
          className={clsx(
            'flex items-center gap-1.5 h-[22px] px-2 rounded-[4px] transition border text-[11px] font-mono',
            pathname === '/docs' || pathname === '/developers'
              ? 'bg-[#526FFF]/15 text-[#8EA2FF] border-[#526FFF]/35'
              : 'bg-[#11141B] text-[#828598] border-[#1E222D] hover:text-[#F7F8F9] hover:border-[#32374A]'
          )}
          title="Developer platform and API documentation"
        >
          <BookOpen className="h-2.5 w-2.5 text-[#526FFF]" />
          <span>Docs</span>
        </Link>

        {/* Settings Link */}
        <Link
          href="/settings"
          prefetch={true}
          onClick={() => setActiveView('settings')}
          className={clsx(
            'flex items-center gap-1.5 h-[22px] px-2 rounded-[4px] transition border text-[11px] font-mono',
            pathname === '/settings' || pathname?.startsWith('/settings/')
              ? 'bg-[#526FFF]/15 text-[#8EA2FF] border-[#526FFF]/35'
              : 'bg-[#11141B] text-[#828598] border-[#1E222D] hover:text-[#F7F8F9] hover:border-[#32374A]'
          )}
          title="Terminal settings & preferences"
        >
          <Settings className="h-2.5 w-2.5 text-[#526FFF]" />
          <span>Settings</span>
        </Link>

        <span className="hidden sm:inline-block h-3 w-px bg-[#1E222D] mx-0.5" aria-hidden="true" />

        {/* Console Action */}
        <button
          onClick={() => setConsoleOpen(!isConsoleOpen)}
          className={`flex items-center gap-1.5 h-[22px] px-2 rounded-[4px] transition border text-[11px] font-mono font-semibold ${
            isConsoleOpen
              ? 'bg-[#526FFF]/15 text-[#8EA2FF] border-[#526FFF]/35'
              : 'bg-[#11141B] text-[#828598] border-[#1E222D] hover:text-[#F7F8F9] hover:border-[#32374A]'
          }`}
        >
          <Terminal className="h-2.5 w-2.5 text-[#526FFF]" />
          <span>Console</span>
        </button>

        {/* Hotkeys Action */}
        <button
          onClick={() => setHotkeysOpen(true)}
          className="flex items-center gap-1.5 h-[22px] px-2 rounded-[4px] bg-[#11141B] text-[#828598] border border-[#1E222D] hover:text-[#F7F8F9] hover:border-[#32374A] transition text-[11px] font-mono"
        >
          <Command className="h-2.5 w-2.5 text-[#828598]" />
          <span>Hotkeys</span>
        </button>
      </div>
    </footer>
  );
}

export default FooterStatusBar;
