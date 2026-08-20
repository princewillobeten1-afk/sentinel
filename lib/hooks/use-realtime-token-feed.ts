'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscoveryToken, DiscoverySection, DiscoveryFilter, TimeWindow } from '@/lib/discovery/types';
import { filterToQueryParams } from '@/lib/discovery/query-model';

/**
 * Deadline for the initial discovery fetch.
 *
 * Warm, these endpoints answer in ~40ms; cold-compiling one in dev has been
 * seen to exceed 8s. 10s is comfortably past a legitimate cold start and well
 * short of the user concluding the app is broken.
 */
const FETCH_TIMEOUT_MS = 10_000;

export interface RealtimeTokenFeedState {
  tokens: DiscoveryToken[];
  updatedAt: string;
  connected: boolean;
  latestSequence: number;
}

export function useRealtimeTokenFeed(
  sectionOrOptions: DiscoverySection | { section?: DiscoverySection; timeWindow?: TimeWindow; filter?: Partial<DiscoveryFilter>; chain?: string } = 'trending',
  timeWindowArg: TimeWindow = '24h',
  filterArg: Partial<DiscoveryFilter> = {},
  chainArg = 'solana'
) {
  const isObject = typeof sectionOrOptions === 'object';
  const section: DiscoverySection = isObject ? sectionOrOptions.section || 'trending' : sectionOrOptions;
  const timeWindow: TimeWindow = isObject ? sectionOrOptions.timeWindow || '24h' : timeWindowArg;
  const filter: Partial<DiscoveryFilter> = isObject ? sectionOrOptions.filter || {} : filterArg;
  const chain: string = isObject ? sectionOrOptions.chain || 'solana' : chainArg;

  const [tokens, setTokens] = useState<DiscoveryToken[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const lastSequenceRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryDelayRef = useRef<number>(1000);
  const isMountedRef = useRef<boolean>(true);
  /** In-flight discovery request, so a superseded one can be aborted. */
  const abortRef = useRef<AbortController | null>(null);

  // 1. Initial HTTP Data Load (Section 13)
  const filterKey = JSON.stringify(filter);

  const fetchInitialTokens = useCallback(async () => {
    // A request that never settles is the difference between "loading" and
    // "hung". Without a deadline the `finally` below never runs, `isLoading`
    // stays true forever, and the Discover columns pulse skeletons
    // indefinitely — indistinguishable from a feed that is genuinely empty.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Superseded in-flight requests are dropped, so a fast filter change cannot
    // have an older response overwrite a newer one.
    abortRef.current?.abort();
    abortRef.current = controller;

    // Set here rather than only in the mount effect, so the Refresh button's
    // spinner actually spins — `refresh` is this function.
    if (isMountedRef.current) setIsLoading(true);

    try {
      const url = new URL(`/api/v1/discovery/${section}`, window.location.origin);
      const queryParams = filterToQueryParams({ ...filter, chain, timeWindow });
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      url.searchParams.set('limit', '50');

      const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal });
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error?.message || payload?.error || 'Failed to fetch tokens');
      }

      const rawTokens = payload.data?.tokens ?? payload.tokens ?? payload.data?.items ?? payload.items ?? [];
      const nextTokens: DiscoveryToken[] = Array.isArray(rawTokens) ? rawTokens : [];
      const nextUpdatedAt: string = payload.data?.updatedAt ?? payload.updatedAt ?? new Date().toISOString();

      if (isMountedRef.current) {
        setTokens(nextTokens);
        setUpdatedAt(nextUpdatedAt);
        setError(null);
      }
    } catch (err) {
      // A supersede-abort is not a failure — a newer request is already in
      // flight and will set the state. Surfacing it would flash an error
      // every time the user changes a filter.
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      const supersededByNewer = aborted && abortRef.current !== controller;
      if (supersededByNewer) return;

      if (isMountedRef.current) {
        setError(
          aborted
            ? `Feed timed out after ${Math.round(FETCH_TIMEOUT_MS / 1000)}s.`
            : err instanceof Error
              ? err.message
              : 'Discovery feed failed',
        );
      }
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [section, chain, timeWindow, filterKey]);

  // 2. Incremental Real-time Event Handler (Section 12 & Section 17)
  const handleRealtimeEvent = useCallback((event: any) => {
    if (!event || !event.type) return;

    if (event.sequence && event.sequence > lastSequenceRef.current) {
      lastSequenceRef.current = event.sequence;
    }

    setTokens((prev) => {
      switch (event.type) {
        case 'TOKEN_CREATED': {
          const newMint = event.mint;
          if (!newMint || prev.some((t) => t.mint === newMint)) return prev;

          const newToken: DiscoveryToken = {
            id: newMint,
            mint: newMint,
            name: event.name || `Token ${newMint.slice(0, 4)}`,
            symbol: event.symbol || newMint.slice(0, 4).toUpperCase(),
            chain: 'solana',
            source: (event.dex === 'raydium' ? 'Raydium' : event.dex === 'meteora' ? 'Meteora' : 'Pump.fun') as any,
            ageMinutes: 0.1,
            ageFormatted: 'Just now',
            priceUsd: String(event.priceUsd ?? event.price ?? 0.0001),
            priceChange1m: 0,
            priceChange5m: 0,
            priceChange15m: 0,
            priceChange1h: 0,
            priceChange24h: 0,
            volume5mUsd: String(event.amount ?? 100),
            volume1hUsd: String(event.amount ?? 500),
            volume24hUsd: String(event.amount ?? 1200),
            volumeChange15mPct: 0,
            liquidityUsd: String(event.liquidityUsd ?? 5000),
            liquidityChange1hPct: 0,
            marketCapUsd: String(event.marketCapUsd ?? 20000),
            buysCount: 1,
            sellsCount: 0,
            txCount15m: 1,
            txCount1h: 1,
            buySellImbalancePct: 100,
            buyPressureRatio: 1,
            txAccelerationPct: 10,
            isNewToken: true,
            holdersCount: 1,
            holderGrowth1hPct: 0,
            discoveryScore: {
              totalScore: 92,
              confidence: 0.88,
              grade: 'HIGH_SIGNAL',
              factors: {
                volumeAcceleration: 85,
                transactionAcceleration: 90,
                liquidityChange: 80,
                buySellImbalance: 95,
                holderGrowth: 75,
                recency: 99,
                priceVelocity: 88,
              },
              rawInputs: {
                ageMinutes: 0.1,
                priceChangeWindow: 0,
                volumeWindowUsd: 100,
                volumeAccelerationPct: 0,
                liquidityChangePct: 0,
                buysCount: 1,
                sellsCount: 0,
                holdersCount: 1,
                holderGrowthPct: 0,
                buySellImbalancePct: 100,
                buyPressureRatio: 1,
                txAccelerationPct: 10,
                isNewToken: true,
              },
              signals: [],
              explanations: ['Newly detected real-time token creation'],
              calculatedAt: new Date().toISOString(),
            },
          };

          // Prepend immediately to feed without page refresh (Section 17)
          return [newToken, ...prev.slice(0, 49)];
        }

        case 'TOKEN_UPDATE': {
          const targetMint = event.mint;
          if (!targetMint) return prev;

          return prev.map((t) => {
            if (t.mint !== targetMint) return t;
            return {
              ...t,
              priceUsd: event.priceUsd !== undefined ? String(event.priceUsd) : t.priceUsd,
              liquidityUsd: event.liquidityUsd !== undefined ? String(event.liquidityUsd) : t.liquidityUsd,
              marketCapUsd: event.marketCapUsd !== undefined ? String(event.marketCapUsd) : t.marketCapUsd,
              volume24hUsd: event.volume24hUsd !== undefined ? String(event.volume24hUsd) : t.volume24hUsd,
            };
          });
        }

        case 'BUY':
        case 'SELL': {
          const targetMint = event.mint;
          if (!targetMint) return prev;

          return prev.map((t) => {
            if (t.mint !== targetMint) return t;
            const isBuy = event.type === 'BUY';
            const price = event.priceUsd ?? event.price ? String(event.priceUsd ?? event.price) : t.priceUsd;
            const volumeInc = event.amount ?? (event.amountSol ? event.amountSol * 180 : 50);
            const currentVol = Number(t.volume24hUsd) || 0;

            return {
              ...t,
              priceUsd: price,
              volume24hUsd: String(currentVol + volumeInc),
              txCount1h: t.txCount1h + 1,
              buysCount: isBuy ? t.buysCount + 1 : t.buysCount,
              sellsCount: isBuy ? t.sellsCount : t.sellsCount + 1,
            };
          });
        }

        case 'LIQUIDITY_ADDED':
        case 'POOL_CREATED': {
          const targetMint = event.mint;
          if (!targetMint) return prev;

          return prev.map((t) => {
            if (t.mint !== targetMint) return t;
            const currentLiq = Number(t.liquidityUsd) || 0;
            const inc = event.liquidityUsd ? Number(event.liquidityUsd) : currentLiq * 0.05;
            return {
              ...t,
              liquidityUsd: String(currentLiq + inc),
              source: (event.dex === 'raydium' ? 'Raydium' : t.source) as any,
            };
          });
        }

        default:
          return prev;
      }
    });

    setUpdatedAt(new Date().toISOString());
  }, []);

  // 3. Reconcile Missed Events on Reconnection (Section 19)
  const catchUpMissedEvents = useCallback(async () => {
    if (lastSequenceRef.current === 0) return;

    try {
      const res = await fetch(`/api/v1/events?after=${lastSequenceRef.current}`);
      if (!res.ok) return;

      const json = await res.json();
      const events = json.data?.events || [];
      for (const evt of events) {
        handleRealtimeEvent(evt);
      }
    } catch {
      // Reconnection catch-up error handled gracefully
    }
  }, [handleRealtimeEvent]);

  // 4. WebSocket Client with Exponential Backoff (Section 11 & Section 18)
  const connectWebSocket = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isMountedRef.current) return;
        setConnected(true);
        retryDelayRef.current = 1000;
        void catchUpMissedEvents();
      };

      socket.onmessage = (message) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(message.data);
          // Standard server message wrapping event
          if (data.type === 'event' && data.data) {
            handleRealtimeEvent(data.data);
          } else {
            handleRealtimeEvent(data);
          }
        } catch {
          // Ignore non-JSON control messages
        }
      };

      socket.onclose = () => {
        if (!isMountedRef.current) return;
        setConnected(false);
        socketRef.current = null;

        // Exponential backoff capped at 30s
        const nextDelay = retryDelayRef.current;
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connectWebSocket();
          }
        }, nextDelay);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      // Connection initialization error handled by retry
    }
  }, [catchUpMissedEvents, handleRealtimeEvent]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    void fetchInitialTokens();
    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [fetchInitialTokens, connectWebSocket]);

  return {
    tokens,
    updatedAt,
    isLoading,
    connected,
    isConnected: connected,
    error,
    refresh: fetchInitialTokens,
  };
}
