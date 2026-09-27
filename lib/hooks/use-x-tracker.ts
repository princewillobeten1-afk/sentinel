'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useXTrackerStore } from '@/lib/store/x-tracker-store';
import type { XTrackerCall, XTrackerStats } from '@/lib/x-tracker/types';

// Web audio subtle notification chime
function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // AudioContext blocked or not supported
  }
}

export function useXTracker() {
  const { activeCategory, searchQuery, soundEnabled, setUnreadCount, isOpen } = useXTrackerStore();
  const [calls, setCalls] = useState<XTrackerCall[]>([]);
  const [stats, setStats] = useState<XTrackerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seenCallIdsRef = useRef<Set<string>>(new Set());

  const fetchFeed = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.set('category', activeCategory);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/v1/x-tracker/feed?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = await res.json();
      if (!body.success) throw new Error(body.error || 'Failed to fetch X tracker');

      const incomingCalls: XTrackerCall[] = body.data || [];

      // Check for new calls to notify
      let newCount = 0;
      let hasHighAlphaCall = false;

      for (const call of incomingCalls) {
        if (!seenCallIdsRef.current.has(call.id)) {
          seenCallIdsRef.current.add(call.id);
          newCount++;
          if (call.metrics.multiplier >= 1.5 || call.isKOL) {
            hasHighAlphaCall = true;
          }
        }
      }

      if (newCount > 0 && !isOpen) {
        setUnreadCount(newCount);
      }

      if (hasHighAlphaCall && soundEnabled) {
        playNotificationChime();
      }

      setCalls(incomingCalls);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Error loading social feed');
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, searchQuery, soundEnabled, isOpen, setUnreadCount]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/x-tracker/stats');
      if (res.ok) {
        const body = await res.json();
        if (body.success) setStats(body.data);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void fetchFeed();
    void fetchStats();

    // Live polling every 4 seconds
    const interval = setInterval(() => {
      void fetchFeed();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchFeed, fetchStats]);

  return {
    calls,
    stats,
    isLoading,
    error,
    refetch: fetchFeed,
  };
}
