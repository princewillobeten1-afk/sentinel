'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTrendRadarStore } from '@/lib/store/trend-radar-store';
import type { TrendItem, TrendStats } from '@/lib/trends/types';

export function useTrendRadar() {
  const { activeSource, activeCategory, searchQuery } = useTrendRadarStore();
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [stats, setStats] = useState<TrendStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (activeSource && activeSource !== 'all') params.set('source', activeSource);
      if (activeCategory && activeCategory !== 'all') params.set('category', activeCategory);
      if (searchQuery && searchQuery.trim().length > 0) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/v1/trends?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTrends(json.data);
        if (json.stats) setStats(json.stats);
      } else {
        throw new Error(json.error || 'Failed to parse trend response');
      }
    } catch (err: any) {
      console.error('[USE_TREND_RADAR_ERROR]', err);
      setError(err?.message || 'Failed to load trend feed');
    } finally {
      setIsLoading(false);
    }
  }, [activeSource, activeCategory, searchQuery]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return {
    trends,
    stats,
    isLoading,
    error,
    refetch: fetchTrends,
  };
}
