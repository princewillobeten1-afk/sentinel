'use client';

import type { DiscoveryFilter, DiscoverySection, TimeWindow } from '@/lib/discovery/types';
import { useRealtimeTokenFeed } from './use-realtime-token-feed';

/**
 * Real-time discovery feed hook.
 *
 * Sourced directly from WebSocket streams and initial API loads without continuous HTTP polling.
 */
export function useDiscoveryFeed(
  section: DiscoverySection = 'trending',
  timeWindow: TimeWindow = '24h',
  filter: Partial<DiscoveryFilter> = {},
  chain = 'solana'
) {
  const realtime = useRealtimeTokenFeed(section, timeWindow, filter, chain);

  return {
    tokens: realtime.tokens,
    updatedAt: realtime.updatedAt,
    isLoading: realtime.isLoading,
    error: realtime.error,
    refresh: realtime.refresh,
    liveConnected: realtime.connected,
  };
}
