'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  LiveTradeAlert,
  LiveAlertCategory,
  LiveAlertFilterConfig,
  LiveAlertStats,
} from '@/lib/alerts/live-alert-types';

const SOUND_STORAGE_KEY = 'sentinel_live_alerts_sound';
const MIN_SOL_STORAGE_KEY = 'sentinel_live_alerts_min_sol';

// Web Audio API chime synthesizer for zero-dependency, ultra-low-latency sound
export function playAlertChime(urgency: 'high' | 'medium' | 'normal' = 'normal') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (urgency === 'high') {
      // High urgency (e.g. verified KOL call or huge whale buy): Bright dual chord
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.08); // C6
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Standard pleasant ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.09); // A5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    }
  } catch {
    // AudioContext blocked by browser policy before first user interaction
  }
}

interface LiveAlertsState {
  activeAlert: LiveTradeAlert | null;
  alertQueue: LiveTradeAlert[];
  alertHistory: LiveTradeAlert[];
  soundEnabled: boolean;
  isPaused: boolean;
  filter: LiveAlertFilterConfig;
  isHistoryDrawerOpen: boolean;
  unreadCount: number;
  stats: LiveAlertStats;
}

interface LiveAlertsActions {
  pushAlert: (alert: LiveTradeAlert) => void;
  dismissActiveAlert: () => void;
  clearActive: () => void;
  clearHistory: () => void;
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  setCategoryFilter: (category: LiveAlertCategory) => void;
  setMinSolFilter: (minSol: number) => void;
  setSearchQuery: (query: string) => void;
  setHistoryDrawerOpen: (open: boolean) => void;
  markAllRead: () => void;
}

const LiveAlertsStateContext = createContext<LiveAlertsState | undefined>(undefined);
const LiveAlertsActionsContext = createContext<LiveAlertsActions | undefined>(undefined);

export function LiveAlertsProvider({ children }: { children: React.ReactNode }) {
  const [activeAlert, setActiveAlert] = useState<LiveTradeAlert | null>(null);
  const [alertQueue, setAlertQueue] = useState<LiveTradeAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<LiveTradeAlert[]>([]);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [filter, setFilter] = useState<LiveAlertFilterConfig>({
    category: 'all',
    minSol: 0,
    searchQuery: '',
    verifiedOnly: false,
  });

  const [stats, setStats] = useState<LiveAlertStats>({
    callsCount: 0,
    whaleBuysCount: 0,
    smartMoneyCount: 0,
    milestonesCount: 0,
    risksCount: 0,
    totalAlertsToday: 0,
  });

  const seenIdsRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Hydrate preferences from localStorage
  useEffect(() => {
    try {
      const savedSound = window.localStorage.getItem(SOUND_STORAGE_KEY);
      if (savedSound !== null) {
        setSoundEnabledState(savedSound === 'true');
      }
      const savedMinSol = window.localStorage.getItem(MIN_SOL_STORAGE_KEY);
      if (savedMinSol !== null) {
        setFilter((prev) => ({ ...prev, minSol: Number(savedMinSol) || 0 }));
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabledState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      } catch {
        // Non-fatal
      }
      return next;
    });
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
    } catch {
      // Non-fatal
    }
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    setIsPaused(paused);
  }, []);

  const setCategoryFilter = useCallback((category: LiveAlertCategory) => {
    setFilter((prev) => ({ ...prev, category }));
  }, []);

  const setMinSolFilter = useCallback((minSol: number) => {
    setFilter((prev) => ({ ...prev, minSol }));
    try {
      window.localStorage.setItem(MIN_SOL_STORAGE_KEY, String(minSol));
    } catch {
      // Non-fatal
    }
  }, []);

  const setSearchQuery = useCallback((searchQuery: string) => {
    setFilter((prev) => ({ ...prev, searchQuery }));
  }, []);

  // Dismiss currently showing active alert
  const dismissActiveAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  const clearActive = useCallback(() => {
    setActiveAlert(null);
    setAlertQueue([]);
  }, []);

  const clearHistory = useCallback(() => {
    setAlertHistory([]);
    setUnreadCount(0);
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Add incoming alert
  const pushAlert = useCallback((alert: LiveTradeAlert) => {
    if (seenIdsRef.current.has(alert.id)) return;
    seenIdsRef.current.add(alert.id);

    // Keep seen set under 1000 items
    if (seenIdsRef.current.size > 1000) {
      const iter = seenIdsRef.current.values();
      for (let i = 0; i < 200; i++) {
        const val = iter.next().value;
        if (val) seenIdsRef.current.delete(val);
      }
    }

    // Update statistics
    setStats((prev) => {
      let callsCount = prev.callsCount;
      let whaleBuysCount = prev.whaleBuysCount;
      let smartMoneyCount = prev.smartMoneyCount;
      let milestonesCount = prev.milestonesCount;
      let risksCount = prev.risksCount;

      if (alert.type === 'CALL') callsCount++;
      if (alert.type === 'WHALE_TRADE') whaleBuysCount++;
      if (alert.type === 'SMART_MONEY') smartMoneyCount++;
      if (alert.type === 'LAUNCHPAD_MILESTONE') milestonesCount++;
      if (alert.type === 'RISK_ALERT') risksCount++;

      return {
        callsCount,
        whaleBuysCount,
        smartMoneyCount,
        milestonesCount,
        risksCount,
        totalAlertsToday: prev.totalAlertsToday + 1,
      };
    });

    // Add to history (capped at 150 items)
    setAlertHistory((prev) => [alert, ...prev].slice(0, 150));
    setUnreadCount((prev) => prev + 1);

    // Check filter criteria before promoting to top toast
    if (filter.minSol > 0 && alert.trade && alert.trade.amountSol < filter.minSol) {
      return;
    }
    if (filter.category === 'calls' && alert.type !== 'CALL') return;
    if (filter.category === 'trades' && alert.type !== 'WHALE_TRADE') return;
    if (filter.category === 'smart_money' && alert.type !== 'SMART_MONEY') return;
    if (filter.category === 'launchpad' && alert.type !== 'LAUNCHPAD_MILESTONE') return;
    if (filter.category === 'risks' && alert.type !== 'RISK_ALERT') return;

    // Play chime if sound enabled
    if (soundEnabledRef.current && (alert.urgency === 'high' || alert.type === 'CALL' || alert.type === 'WHALE_TRADE')) {
      playAlertChime(alert.urgency);
    }

    if (!isPaused) {
      setActiveAlert(alert);
    } else {
      setAlertQueue((prev) => [...prev, alert].slice(-10));
    }
  }, [filter, isPaused]);

  return (
    <LiveAlertsStateContext.Provider
      value={{
        activeAlert,
        alertQueue,
        alertHistory,
        soundEnabled,
        isPaused,
        filter,
        isHistoryDrawerOpen,
        unreadCount,
        stats,
      }}
    >
      <LiveAlertsActionsContext.Provider
        value={{
          pushAlert,
          dismissActiveAlert,
          clearActive,
          clearHistory,
          toggleSound,
          setSoundEnabled,
          setPaused,
          setCategoryFilter,
          setMinSolFilter,
          setSearchQuery,
          setHistoryDrawerOpen: setIsHistoryDrawerOpen,
          markAllRead,
        }}
      >
        {children}
      </LiveAlertsActionsContext.Provider>
    </LiveAlertsStateContext.Provider>
  );
}

export function useLiveAlertsState() {
  const context = useContext(LiveAlertsStateContext);
  if (!context) {
    throw new Error('useLiveAlertsState must be used within LiveAlertsProvider');
  }
  return context;
}

export function useLiveAlertsActions() {
  const context = useContext(LiveAlertsActionsContext);
  if (!context) {
    throw new Error('useLiveAlertsActions must be used within LiveAlertsProvider');
  }
  return context;
}
