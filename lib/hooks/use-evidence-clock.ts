'use client';

import { useEffect, useState } from 'react';
import type { MetricEvidence } from '@/lib/discovery/types';

/** Re-render at expiry even if the feed stops sending frames. No per-card interval. */
export function useEvidenceClock(...evidence: Array<MetricEvidence | null | undefined>): number {
  const [now, setNow] = useState(Date.now);
  const nextExpiry = Math.min(...evidence
    .filter(group => group?.status === 'measured' && group.expiresAt)
    .map(group => Date.parse(group!.expiresAt!))
    .filter(time => Number.isFinite(time) && time > now));
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(2_147_483_647, nextExpiry - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [nextExpiry]);
  return Math.max(now, Date.now());
}
