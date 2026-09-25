'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSentinelWS, type SentinelWSEventHandler } from './use-sentinel-ws';
import { isSolanaMint, mergeChartCandles, parseChartFrame, parseChartSnapshot,
  type ChartCandle, type ChartSnapshot, type ChartTimeframe } from '@/lib/market/chart-model';

// The server already polls visible candles every 30 seconds and broadcasts
// them. Browser REST is reconciliation, not a second high-frequency feed.
const REST_RECONCILE_MS: Record<ChartTimeframe, number> = {
  '1m': 30_000, '5m': 45_000, '15m': 45_000,
  '1h': 60_000, '4h': 60_000, '1d': 60_000,
};

/** Mounted with a token/timeframe key: requests and subscriptions belong to one chart only. */
export function useChartData(address: string, chain: string, timeframe: ChartTimeframe) {
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [market, setMarket] = useState<ChartSnapshot['market']>('token-aggregate');
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [source, setSource] = useState<ChartSnapshot['source'] | null>(null);
  const [observedAt, setObservedAt] = useState(0);
  const [streamAt, setStreamAt] = useState(0);
  const [liveSource, setLiveSource] = useState<'quicknode' | 'birdeye' | null>(null);
  const [now, setNow] = useState(Date.now());
  const valid = chain === 'solana' && isSolanaMint(address);
  const receive = useRef<SentinelWSEventHandler>(() => {});
  const refresh = useRef<() => void>(() => {});
  const older = useRef<() => void>(() => {});
  const { isConnected } = useSentinelWS(valid ? `token.ohlcv:${address}:${timeframe}` : [],
    (data, message) => receive.current(data, message));
  const sequence = useRef(0);
  useEffect(() => { sequence.current = 0; if (isConnected) refresh.current(); }, [isConnected]);

  useEffect(() => {
    if (!valid) { setLoading(false); setError('A valid Solana token mint is required for this chart.'); return; }
    let active = true;
    let rows: ChartCandle[] = [];
    const revisions = new Map<number, number>();
    let more = false;
    let latestBusy = false;
    let olderBusy = false;
    let lastStream = 0;
    let lastBirdeyeStream = 0;
    let streamBucket = 0;
    let lastPush = 0;
    let lastAttempt = 0;
    let seriesIdentity: string | null = null;
    const controllers = new Set<AbortController>();

    receive.current = (value, message) => {
      const frame = parseChartFrame(value);
      if (!active || !frame || frame.address !== address || frame.timeframe !== timeframe
        || frame.observedAt > Date.now() + 5_000 || frame.candle.time > Date.now() / 1000 + 5
        || (message.sequence !== undefined && message.sequence <= sequence.current)) return;
      const frameIdentity = frame.market === 'pool' ? `pool:${frame.poolAddress}` : 'token-aggregate';
      // Keep a healthy aggregate Birdeye/Bitquery series primary. A QuickNode
      // pool trade belongs only on a pool-specific fallback series.
      if (seriesIdentity && seriesIdentity !== frameIdentity) {
        if (frame.source !== 'birdeye-price-ws' || !seriesIdentity.startsWith('pool:')) return;
        rows = []; revisions.clear(); more = false; lastPush = 0; lastStream = 0; streamBucket = 0;
        seriesIdentity = 'token-aggregate';
        setHasMore(false); setStreamAt(0); setLiveSource(null); setObservedAt(0); setSource(null);
        queueMicrotask(() => { if (active) refresh.current(); });
      }
      seriesIdentity ??= frameIdentity;
      if (frame.market === 'pool') { setMarket('pool'); setPoolAddress(frame.poolAddress ?? null); }
      if (frame.source === 'bitquery-ohlcv-rest') setSource('bitquery-token-ohlcv');
      else if (frame.source === 'bitquery-dex-ohlcv-rest') setSource('bitquery-dex-ohlcv');
      else if (frame.source === 'birdeye-price-ws' || frame.source === 'birdeye-ohlcv-rest') setSource('birdeye-ohlcv-v3');
      else if (frame.source === 'geckoterminal-pool-rest') setSource('geckoterminal-pool-ohlcv');
      if (message.sequence !== undefined) sequence.current = message.sequence;
      if (frame.observedAt < (revisions.get(frame.candle.time) ?? 0)) return;
      revisions.set(frame.candle.time, frame.observedAt);
      const existing = rows.find(c => c.time === frame.candle.time);
      const candle = frame.source === 'quicknode-pool-ws' && existing
        ? { ...frame.candle, open: existing.open, high: Math.max(existing.high, frame.candle.high),
          low: Math.min(existing.low, frame.candle.low) }
        : frame.candle;
      rows = mergeChartCandles(rows, [candle]);
      lastPush = frame.observedAt;
      if (frame.source === 'birdeye-price-ws' || frame.source === 'quicknode-pool-ws') {
        lastStream = frame.observedAt;
        if (frame.source === 'birdeye-price-ws') lastBirdeyeStream = frame.observedAt;
        streamBucket = frame.candle.time;
        setLiveSource(frame.source === 'quicknode-pool-ws' ? 'quicknode' : 'birdeye');
      }
      setCandles(rows); setObservedAt(current => Math.max(current, frame.observedAt)); setStreamAt(lastStream);
      setError(null); setLoading(false);
    };

    async function request(before?: number) {
      if (!active || (before === undefined ? latestBusy : olderBusy)) return;
      if (before === undefined) { latestBusy = true; lastAttempt = Date.now(); setRefreshing(true); }
      else { olderBusy = true; setLoadingOlder(true); setOlderError(null); }
      const controller = new AbortController();
      controllers.add(controller);
      // Cold pool discovery plus an aggregate fallback can take two provider
      // requests. Let the server finish before declaring the chart unavailable.
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        // A one-bar fallback is not a seeded chart. Keep requesting full
        // history until the viewport has enough measured candles; this also
        // backfills a newly discovered live pool after a temporary 429.
        const params = new URLSearchParams({ timeframe, limit: before === undefined && rows.length >= 60 ? '2' : '150' });
        if (before !== undefined) params.set('before', String(before));
        const response = await fetch(`/api/v1/tokens/${chain}/${address}/chart?${params}`, {
          signal: controller.signal, cache: 'no-store',
        });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body?.error?.message || 'Chart history is unavailable.');
        const snapshot = parseChartSnapshot(body.data, address, timeframe);
        if (!snapshot) throw new Error('Chart provider returned an invalid candle snapshot.');
        if (!active) return;
        // A stale aggregate cache must not displace a fresh pool stream, but a
        // measured Birdeye/Bitquery response takes precedence immediately.
        if (snapshot.market === 'token-aggregate' && seriesIdentity?.startsWith('pool:')
          && snapshot.status !== 'measured' && Date.now() - lastStream < 5 * 60_000) return;
        if (snapshot.market === 'pool' && seriesIdentity === 'token-aggregate'
          && Date.now() - lastBirdeyeStream < 60_000) return;
        const nextIdentity = snapshot.market === 'pool' ? `pool:${snapshot.poolAddress}` : 'token-aggregate';
        if (seriesIdentity && seriesIdentity !== nextIdentity) {
          rows = []; revisions.clear(); more = false; lastPush = 0; lastStream = 0; streamBucket = 0;
          setHasMore(false); setStreamAt(0); setLiveSource(null); setObservedAt(0);
        }
        seriesIdentity = nextIdentity;
        setMarket(snapshot.market); setPoolAddress(snapshot.poolAddress ?? null);
        setSource(snapshot.source);
        const accepted = snapshot.candles.filter(c => (before === undefined || c.time < before)
          && !(snapshot.market === 'pool' && c.time === streamBucket && Date.now() - lastStream < 20_000)
          && snapshot.observedAt >= (revisions.get(c.time) ?? 0));
        for (const c of accepted) revisions.set(c.time, snapshot.observedAt);
        rows = mergeChartCandles(rows, accepted);
        setCandles(rows);
        // Only the oldest loaded page determines whether there is earlier history.
        if (before !== undefined || rows[0]?.time === snapshot.candles[0]?.time || !rows.length) {
          more = snapshot.hasMore; setHasMore(more);
        }
        if (before === undefined) {
          setObservedAt(current => Math.max(current, snapshot.observedAt));
          if (snapshot.observedAt >= lastPush) {
            setError(snapshot.status === 'stale' ? snapshot.reason || 'Provider data is delayed.' : null);
          }
        } else if (snapshot.status === 'stale') setOlderError(snapshot.reason || 'Older history is delayed.');
      } catch (cause) {
        if (!active) return;
        const reason = controller.signal.aborted ? 'Chart request timed out. Please retry.'
          : cause instanceof Error ? cause.message : 'Chart data is unavailable.';
        if (before === undefined) { if (lastPush < lastAttempt) setError(reason); }
        else setOlderError(reason);
      } finally {
        clearTimeout(timeout); controllers.delete(controller);
        if (before === undefined) latestBusy = false; else olderBusy = false;
        if (active) { if (before === undefined) { setLoading(false); setRefreshing(false); } else setLoadingOlder(false); }
      }
    }
    refresh.current = () => { void request(); };
    older.current = () => { if (more && rows.length) void request(rows[0].time); };
    void request();
    const timer = setInterval(() => {
      setNow(Date.now());
      const interval = Date.now() - lastPush < 30_000
        ? Math.max(30_000, REST_RECONCILE_MS[timeframe]) : REST_RECONCILE_MS[timeframe];
      if (!document.hidden && Date.now() - lastAttempt >= interval) void request();
    }, 1_000);
    const resume = () => { if (!document.hidden) void request(); };
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false; clearInterval(timer); controllers.forEach(c => c.abort());
      document.removeEventListener('visibilitychange', resume);
      receive.current = () => {}; refresh.current = () => {}; older.current = () => {};
    };
  }, [address, chain, timeframe, valid]);

  const status = isConnected && streamAt > 0 && now - streamAt < 30_000 ? 'Live'
    : loading ? 'Loading' : error && candles.length === 0 ? 'Unavailable'
      : error || (observedAt > 0 && now - observedAt > 45_000) ? 'Delayed' : 'Polling';
  return { candles, loading, refreshing, error, olderError, loadingOlder, hasMore, market, poolAddress, source, observedAt, streamAt, liveSource, status,
    refresh: useCallback(() => refresh.current(), []), loadOlder: useCallback(() => older.current(), []) };
}
