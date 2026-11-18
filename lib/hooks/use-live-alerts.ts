'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useLiveAlertsState, useLiveAlertsActions } from '@/lib/store/live-alerts-store';
import type { LiveTradeAlert } from '@/lib/alerts/live-alert-types';

const ALERTS_MIN_INTERVAL_MS = 3_500;
let inFlightAlerts: Promise<void> | null = null;
let lastAlertsFetchAt = 0;
let lastAlertsKey = '';

export function useLiveAlerts() {
  const state = useLiveAlertsState();
  const actions = useLiveAlertsActions();
  const { pushAlert } = actions;
  const isMountedRef = useRef(false);

  const fetchLiveStream = useCallback(async () => {
    const params = new URLSearchParams();
    if (state.filter.category && state.filter.category !== 'all') {
      params.set('category', state.filter.category);
    }
    if (state.filter.minSol > 0) {
      params.set('minSol', String(state.filter.minSol));
    }
    const queryKey = params.toString();

    if (inFlightAlerts && queryKey === lastAlertsKey) {
      return inFlightAlerts;
    }
    if (queryKey === lastAlertsKey && Date.now() - lastAlertsFetchAt < ALERTS_MIN_INTERVAL_MS) {
      return;
    }

    lastAlertsKey = queryKey;
    let task!: Promise<void>;
    task = (async () => {
      try {
        const res = await fetch(`/api/v1/live-alerts?${queryKey}`);
        lastAlertsFetchAt = Date.now();
        if (!res.ok) return;

        const body = await res.json();
        if (!body.success || !Array.isArray(body.data)) return;

        const incoming: LiveTradeAlert[] = body.data;
        for (const item of incoming) {
          pushAlert(item);
        }
      } catch {
        lastAlertsFetchAt = Date.now();
        // Non-fatal network glitch
      } finally {
        if (inFlightAlerts === task) {
          inFlightAlerts = null;
        }
      }
    })();

    inFlightAlerts = task;
    return task;
  }, [state.filter.category, state.filter.minSol, pushAlert]);

  useEffect(() => {
    isMountedRef.current = true;
    void fetchLiveStream();

    // Live stream interval: polls every 4 seconds for fresh calls and trades
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        void fetchLiveStream();
      }
    }, 4000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchLiveStream]);

  return {
    ...state,
    ...actions,
    refetch: fetchLiveStream,
  };
}
