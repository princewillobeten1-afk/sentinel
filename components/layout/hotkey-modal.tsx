'use client';

import React from 'react';
import { Command } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { useAppState, useAppActions } from '@/lib/store';

export function HotkeyModal() {
  const { isHotkeysOpen } = useAppState();
  const { setHotkeysOpen } = useAppActions();

  const hotkeyGroups = [
    {
      group: 'Global Terminal Shortcuts',
      keys: [
        { key: '⌘ + K / Ctrl + K', description: 'Open Global Command Palette & Search' },
        { key: 'Shift + B', description: 'Open Quick Trade Execution Drawer' },
        { key: '?', description: 'Toggle Keyboard Hotkey Legend' },
        { key: 'ESC', description: 'Close any active modal, drawer, or search overlay' },
      ],
    },
    {
      group: 'Section Navigation (Press G then Key)',
      keys: [
        { key: 'G then H', description: 'Navigate to Overview Dashboard' },
        { key: 'G then D', description: 'Navigate to Token Discovery Screener' },
        { key: 'G then T', description: 'Navigate to Trade Terminal' },
        { key: 'G then L', description: 'Navigate to Launchpad' },
        { key: 'G then P', description: 'Navigate to Portfolio & Wallet P&L' },
        { key: 'G then A', description: 'Navigate to Risk Intelligence Alerts' },
        { key: 'G then S', description: 'Navigate to Terminal Settings' },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isHotkeysOpen}
      onClose={() => setHotkeysOpen(false)}
      title={
        <span className="flex items-center gap-2">
          <Command className="h-5 w-5 text-sky-400" /> Keyboard Hotkeys Cheatsheet
        </span>
      }
      subtitle="High-speed terminal control shortcuts"
      size="md"
    >
      <div className="space-y-6">
        {hotkeyGroups.map((grp) => (
          <div key={grp.group} className="space-y-2">
            <h4 className="text-xs uppercase font-bold tracking-wider text-sky-400 font-mono">
              {grp.group}
            </h4>
            <div className="rounded-xl border border-sentinel-700/80 bg-sentinel-950 divide-y divide-sentinel-800">
              {grp.keys.map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 text-xs">
                  <span className="text-slate-300 font-medium">{item.description}</span>
                  <kbd className="rounded bg-sentinel-800 px-2.5 py-1 text-slate-100 font-mono border border-sentinel-600 font-bold">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
