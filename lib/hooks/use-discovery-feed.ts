'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiscoveryFilter, DiscoverySection, TimeWindow } from '@/lib/discovery/types';
import { filterDiscoveryTokens } from '@/lib/discovery/service';
import {
  subscribeToDiscovery,
  getSection,
  getDiscoverySnapshot,
  setDiscoveryQuery,
  refreshDiscovery,
  pauseDiscovery,
  resumeDiscovery,
  getDiscoveryHealth,
} from '@/lib/discovery/discovery-store';

/**
 * One column's slice of the shared discovery feed.
 *
 * ## What changed
 *
 * This wrapped `useRealtimeTokenFeed`, which held a **per-instance** timer,
 * WebSocket and `/api/v1/events` catch-up. Discover mounts one per column, so
 * five columns meant five of everything. Measured over 32 seconds: 61 feed
 * requests and **25 WebSocket opens**, with `discovery/new` fetched 24 times
 * against 8 for the other sections.
 *
 * Every column now reads from `discovery-store`, which runs a single cycle for
 * all five sections. Beyond the request saving, it means the columns agree on
 * an instant — previously each held data from whenever its own timer last
 * fired.
 *
 * The returned shape is unchanged so `terminal-column.tsx` needed no edit, with
 * two additions: `state` and `lastUpdatedAt`, which let a column show that its
 * rows are stale rather than presenting them as current.
 */
export function useDiscoveryFeed(
  // Defaults to a section the store actually polls. It defaulted to 'trending',
  // which `DISCOVERY_SECTIONS` does not include, so any caller relying on the
  // default sat at `state: 'loading'` forever with no request ever made and
  // nothing to explain why.
  section: DiscoverySection = 'new',
  timeWindow: TimeWindow = '24h',
  filter: Partial<DiscoveryFilter> = {},
  chain = 'solana',
) {
  // Re-render on store change. The snapshot itself is read below, so this only
  // needs to be a changing value.
  const [version, setVersion] = useState(0);

  useEffect(() => subscribeToDiscovery(() => setVersion((v) => v + 1), section), [section]);

  useEffect(() => {
    setDiscoveryQuery({ chain, timeWindow });
  }, [chain, timeWindow]);

  const slice = getSection(section);
  const snapshot = getDiscoverySnapshot();

  // Filters stay client-side and per column: two columns can hold different
  // filters over the same shared fetch.
  const filterKey = JSON.stringify(filter ?? {});
  const tokens = useMemo(
    () => filterDiscoveryTokens(slice.tokens, { ...filter, section, chain, timeWindow } as DiscoveryFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slice.tokens, filterKey, section, chain, timeWindow, version],
  );

  const refresh = useCallback(() => refreshDiscovery(), []);

  return {
    tokens,
    updatedAt: slice.at ? new Date(slice.at).toISOString() : null,
    // "Loading" only before the first cycle completes. After that an empty
    // column means empty, not pending.
    isLoading: !snapshot.hasLoaded && slice.tokens.length === 0,
    error: slice.error ?? null,
    refresh,
    /** True while the last cycle for this section succeeded. */
    liveConnected: slice.state === 'live',
    /** 'live' | 'stale' | 'loading' — drives the column's staleness treatment. */
    state: slice.state,
    health: getDiscoveryHealth(section),
    paused: snapshot.paused,
    pendingRefresh: snapshot.pendingRefresh,
    /** Epoch ms of the last successful fetch, 0 if never. */
    lastUpdatedAt: slice.at,
    /** Measured round-trip of the last cycle, or null before one completed. */
    rttMs: snapshot.rttMs,
    pause: pauseDiscovery,
    resume: resumeDiscovery,
  };
}
