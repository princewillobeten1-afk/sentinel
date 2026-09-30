'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useLiveAlertsState, useLiveAlertsActions } from '@/lib/store/live-alerts-store';
import type { LiveTradeAlert } from '@/lib/alerts/live-alert-types';

export function useLiveAlerts() {
  const state = useLiveAlertsState();
  const actions = useLiveAlertsActions();
  const { pushAlert } = actions;
  const isMountedRef = useRef(false);

  const fetchLiveStream = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (state.filter.category && state.filter.category !== 'all') {
        params.set('category', state.filter.category);
      }
      if (state.filter.minSol > 0) {
        params.set('minSol', String(state.filter.minSol));
      }

      const res = await fetch(`/api/v1/live-alerts?${params.toString()}`);
      if (!res.ok) return;

      const body = await res.json();
      if (!body.success || !Array.isArray(body.data)) return;

      const incoming: LiveTradeAlert[] = body.data;

      // If initial load and history is empty, populate history without sounding bells for all
      if (state.alertHistory.length === 0) {
        // Pick the top one for the banner and push the rest into history
        incoming.forEach((item) => pushAlert(item));
      } else {
        // Sequentially push new alerts
        for (const item of incoming) {
          pushAlert(item);
        }
      }
    } catch {
      // Non-fatal network glitch
    }
  }, [state.filter.category, state.filter.minSol, state.alertHistory.length, pushAlert]);

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
