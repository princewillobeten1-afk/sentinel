'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Radio, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveAlerts } from '@/lib/hooks/use-live-alerts';
import { playAlertChime } from '@/lib/store/live-alerts-store';
import { useNotificationsActions } from '@/lib/store/notifications-store';

export const ALERTS_TOGGLE_STORAGE_KEY = 'sentinel_live_alerts_paused';

export interface AlertsToggleProps {
  variant?: 'footer' | 'compact';
  className?: string;
}

export function AlertsToggle({ variant = 'footer', className }: AlertsToggleProps) {
  const { isPaused, setPaused, soundEnabled, setSoundEnabled, dismissActiveAlert } = useLiveAlerts();
  const { addExecutionLog } = useNotificationsActions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const alertsActive = !isPaused;

  const handleToggle = useCallback(() => {
    const nextActive = isPaused; // if currently paused, toggling turns it ON
    const nextPaused = !nextActive;

    // 1. Control popup banner and sound
    setPaused(nextPaused);
    if (nextPaused) {
      dismissActiveAlert();
      setSoundEnabled(false);
    } else {
      setSoundEnabled(true);
      playAlertChime('normal');
    }

    // 2. Persist state to localStorage
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ALERTS_TOGGLE_STORAGE_KEY, String(nextPaused));
        window.localStorage.setItem('sentinel_live_alerts_sound', String(!nextPaused));
      }
    } catch {
      // Non-fatal
    }

    // 3. Log event into execution console
    try {
      addExecutionLog({
        text: nextActive
          ? 'Live pop-up alerts & signals ENABLED'
          : 'Live pop-up alerts & signals MUTED / DISABLED',
        level: nextActive ? 'info' : 'warn',
      });
    } catch {
      // Non-fatal
    }
  }, [isPaused, setPaused, dismissActiveAlert, setSoundEnabled, addExecutionLog]);

  if (!mounted) {
    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-2xs font-mono select-none opacity-60 bg-sentinel-900/60 text-slate-400 border-sentinel-800',
          className
        )}
      >
        <Radio className="h-2.5 w-2.5 text-slate-400" />
        <span>Alerts: ON</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
      </div>
    );
  }

  const tooltipTitle = alertsActive
    ? 'Pop-up trade & risk alerts are ON (Click to turn OFF)'
    : 'Pop-up trade & risk alerts are OFF (Click to turn ON)';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={alertsActive}
      aria-label={alertsActive ? 'Turn off live alerts' : 'Turn on live alerts'}
      onClick={handleToggle}
      title={tooltipTitle}
      className={clsx(
        'flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all duration-150 border text-2xs font-mono select-none cursor-pointer',
        alertsActive
          ? 'bg-sentinel-900/90 text-slate-200 border-sentinel-800 hover:border-emerald-500/50 hover:text-white'
          : 'bg-sentinel-900/50 text-slate-400 border-sentinel-800/80 hover:border-sentinel-700 hover:text-slate-300',
        className
      )}
    >
      <Radio
        className={clsx(
          'h-2.5 w-2.5 shrink-0 transition-colors',
          alertsActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
        )}
      />
      <span>
        Alerts:{' '}
        <strong className={alertsActive ? 'text-emerald-400 font-bold' : 'text-slate-500 font-normal'}>
          {alertsActive ? 'ON' : 'OFF'}
        </strong>
      </span>
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full transition-colors',
          alertsActive
            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(18,181,116,0.8)]'
            : 'bg-slate-600'
        )}
      />
    </button>
  );
}

// Backward-compatible alias
export const NotificationToggle = AlertsToggle;
export default AlertsToggle;
