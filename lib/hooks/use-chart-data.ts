'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSentinelWS, type SentinelWSEventHandler } from './use-sentinel-ws';
import { isSolanaMint, mergeChartCandles, parseChartFrame, parseChartSnapshot,
  type ChartCandle, type ChartTimeframe } from '@/lib/market/chart-model';

/** Mounted with a token/timeframe key: requests and subscriptions belong to one chart only. */
export function useChartData(address: string, chain: string, timeframe: ChartTimeframe) {
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [observedAt, setObservedAt] = useState(0);
  const [streamAt, setStreamAt] = useState(0);
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
    let lastAttempt = 0;
    const controllers = new Set<AbortController>();

    receive.current = (value, message) => {
      const frame = parseChartFrame(value);
      if (!active || !frame || frame.address !== address || frame.timeframe !== timeframe
        || frame.observedAt > Date.now() + 5_000 || frame.candle.time > Date.now() / 1000 + 5
        || (message.sequence !== undefined && message.sequence <= sequence.current)) return;
      if (message.sequence !== undefined) sequence.current = message.sequence;
      if (frame.observedAt < (revisions.get(frame.candle.time) ?? 0)) return;
      revisions.set(frame.candle.time, frame.observedAt);
      rows = mergeChartCandles(rows, [frame.candle]);
      lastStream = frame.observedAt;
      setCandles(rows); setStreamAt(lastStream); setLoading(false);
    };

    async function request(before?: number) {
      if (!active || (before === undefined ? latestBusy : olderBusy)) return;
      if (before === undefined) { latestBusy = true; lastAttempt = Date.now(); setRefreshing(true); }
      else { olderBusy = true; setLoadingOlder(true); setOlderError(null); }
      const controller = new AbortController();
      controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const params = new URLSearchParams({ timeframe, limit: '150' });
        if (before !== undefined) params.set('before', String(before));
        const response = await fetch(`/api/v1/tokens/${chain}/${address}/chart?${params}`, {
          signal: controller.signal, cache: 'no-store',
        });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body?.error?.message || 'Chart history is unavailable.');
        const snapshot = parseChartSnapshot(body.data, address, timeframe);
        if (!snapshot) throw new Error('Chart provider returned an invalid candle snapshot.');
        if (!active) return;
        const accepted = snapshot.candles.filter(c => (before === undefined || c.time < before)
          && snapshot.observedAt >= (revisions.get(c.time) ?? 0));
        for (const c of accepted) revisions.set(c.time, snapshot.observedAt);
        rows = mergeChartCandles(rows, accepted);
        setCandles(rows);
        // Only the oldest loaded page determines whether there is earlier history.
        if (before !== undefined || rows[0]?.time === snapshot.candles[0]?.time || !rows.length) {
          more = snapshot.hasMore; setHasMore(more);
        }
        if (before === undefined) {
          setObservedAt(snapshot.observedAt);
          setError(snapshot.status === 'stale' ? snapshot.reason || 'Provider data is delayed.' : null);
        } else if (snapshot.status === 'stale') setOlderError(snapshot.reason || 'Older history is delayed.');
      } catch (cause) {
        if (!active) return;
        const reason = controller.signal.aborted ? 'Chart request timed out. Please retry.'
          : cause instanceof Error ? cause.message : 'Chart data is unavailable.';
        if (before === undefined) setError(reason); else setOlderError(reason);
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
      const interval = Date.now() - lastStream < 30_000 ? 30_000 : 10_000;
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
    : loading ? 'Loading' : error || (observedAt > 0 && now - observedAt > 45_000) ? 'Delayed' : 'Polling';
  return { candles, loading, refreshing, error, olderError, loadingOlder, hasMore, observedAt, streamAt, status,
    refresh: useCallback(() => refresh.current(), []), loadOlder: useCallback(() => older.current(), []) };
}
