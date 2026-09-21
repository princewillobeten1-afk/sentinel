'use client';

import { useEffect, useState } from 'react';
import { readApiData } from '@/lib/api/response';
import type { MarketSummary } from '@/lib/market/types';

const REFRESH_MS = 3_500;
let cached: MarketSummary | null = null;
let completedAt = 0;
let inFlight: Promise<MarketSummary> | null = null;

/** Read-only market telemetry must not occupy Next's Server Action queue. */
function readSummary(): Promise<MarketSummary> {
  if (cached && Date.now() - completedAt < REFRESH_MS) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch('/api/v1/market/live/summary', { signal: controller.signal, cache: 'no-store' });
      const data = await readApiData<{ summary: MarketSummary }>(response, 'Market summary unavailable');
      if (!data?.summary || typeof data.summary.updatedAt !== 'string') throw new Error('Market summary unavailable');
      cached = data.summary;
      completedAt = Date.now();
      return cached;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function useMarketSummary() {
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const summary = await readSummary();
        if (active) setMarketSummary(summary);
      } catch {
        if (active) setMarketSummary(null);
      }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return { marketSummary };
}
