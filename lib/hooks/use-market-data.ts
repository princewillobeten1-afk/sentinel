'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLiveMarketSummary, fetchLiveTrendingTokens } from '@/lib/actions/market';
import type { TokenCardData } from '@/components/ui/token-card';
import { mockMarketSummary } from '@/lib/mocks/market';
import { mockTokenCards } from '@/lib/mocks/tokens';
import type { MarketSummary } from '@/lib/market/types';

const LIVE_POLL_INTERVAL_MS = 3500;

/**
 * Mock data is only ever a *demo* aid, never a failure fallback.
 *
 * This hook used to substitute `mockMarketSummary` whenever the upstream call
 * threw, then overwrite `freshness` with `'fresh'` and `updatedAt` with the
 * current time — so the green "Market Freshness: fresh" chip was guaranteed
 * even when every request had failed. `isLoading` was declared and never set;
 * `error` was only ever assigned `null`. The Overview page reported a healthy
 * live market that did not exist.
 */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function useMarketData() {
  const [data, setData] = useState<MarketSummary | null>(DEMO_MODE ? mockMarketSummary : null);
  const [tokens, setTokens] = useState<TokenCardData[]>(DEMO_MODE ? mockTokenCards : []);
  const [isLoading, setIsLoading] = useState(!DEMO_MODE);
  const [error, setError] = useState<string | null>(null);
  const [lastTick, setLastTick] = useState<number>(Date.now());
  const socketRef = useRef<WebSocket | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      // Settled, not caught-and-substituted: a failing summary must not be
      // replaced by mock data, and a failing token list must not hide the
      // summary that did succeed.
      const [summaryResult, tokensResult] = await Promise.allSettled([
        fetchLiveMarketSummary(),
        fetchLiveTrendingTokens(),
      ]);

      if (summaryResult.status === 'fulfilled' && summaryResult.value) {
        // `freshness` and `updatedAt` come from the source. Overwriting them
        // here is what made a stale or failed read look live.
        setData(summaryResult.value);
        setError(null);
      } else if (summaryResult.status === 'rejected') {
        setError(
          summaryResult.reason instanceof Error
            ? summaryResult.reason.message
            : 'Market data provider is unavailable.',
        );
        if (!DEMO_MODE) setData(null);
      }

      const liveTokens = tokensResult.status === 'fulfilled' ? tokensResult.value : [];

      if (liveTokens && liveTokens.length > 0) {
        setTokens(
          liveTokens.map((t, idx) => ({
            name: t.name,
            symbol: t.symbol,
            mint: t.mint,
            price: `$${t.priceUsd < 0.01 ? t.priceUsd.toFixed(6) : t.priceUsd.toFixed(4)}`,
            priceChange24h: t.priceChange24h,
            mcap: `$${(t.marketCapUsd / 1_000_000).toFixed(1)}M`,
            liquidity: `$${(t.liquidityUsd / 1000).toFixed(0)}K`,
            volume24h: `$${(t.volume24hUsd / 1_000_000).toFixed(1)}M`,
            // Was `80 + ((idx * 7) % 18)` — an intelligence score invented from
            // the token's position in the array, rendered beside real metrics as
            // if it were measured. Until the ranking engine supplies one, there
            // is no score.
            intelligenceScore: (t as { intelligenceScore?: number }).intelligenceScore ?? 0,
            badges: [],
            // Sparklines need price history, not five points extrapolated from a
            // single 24h change figure.
            sparklineData: undefined,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 1. WebSocket Live Stream Connection to /ws
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        socketRef.current = ws;

        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              type: 'subscribe',
              topics: ['token.price:So11111111111111111111111111111111111111112', 'token.trade:*'],
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'event' || msg.topic) {
              setLastTick(Date.now());
              refetch();
            }
          } catch {
            // Ignore malformed WS frame
          }
        };

        ws.onclose = () => {
          socketRef.current = null;
          reconnectTimeout = setTimeout(connectWs, 5000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        // WS failure fallback to polling
      }
    };

    connectWs();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [refetch]);

  // 2. Periodic Live Polling Loop
  useEffect(() => {
    refetch();
    const interval = setInterval(() => {
      refetch();
    }, LIVE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refetch]);

  /*
   * Removed: a 1.8s interval that added `(Math.random() - 0.48) * 0.04` to the
   * SOL price and re-stamped `freshness: 'fresh'` with a current timestamp.
   *
   * The number on screen visibly ticked, so the page looked live — but the
   * movement was noise, unrelated to the market, and it overwrote the real
   * freshness state on every tick. Prices now move only when a real update
   * arrives, from the WebSocket above or the poll.
   */

  return {
    marketSummary: data,
    tokens,
    isLoading,
    error,
    lastTick,
    refetch,
  };
}
