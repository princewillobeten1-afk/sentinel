'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type LogicalRange,
} from 'lightweight-charts';
import { BarChart2, RefreshCw, AlertCircle } from 'lucide-react';

export interface CandlestickChartProps {
  symbol?: string;
  chain?: string;
  timeframe?: string;
  initialTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  compact?: boolean;
  height?: string;
}

const SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const CANDLES_PER_PAGE = 150;
/** Fetch an older page once the visible range gets this close to the left edge of what's loaded. */
const LOAD_OLDER_THRESHOLD = 20;

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartApiCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartApiResponse {
  candles: ChartApiCandle[];
  hasMore: boolean;
  oldestTime: number | null;
}

function toChartCandle(c: ChartApiCandle): Candle {
  return { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close };
}

async function fetchCandles(chain: string, address: string, timeframe: string, before?: number): Promise<ChartApiResponse> {
  const url = new URL(`/api/v1/tokens/${chain}/${address}/chart`, window.location.origin);
  url.searchParams.set('timeframe', timeframe);
  url.searchParams.set('limit', String(CANDLES_PER_PAGE));
  if (before !== undefined) url.searchParams.set('before', String(before));

  const response = await fetch(url.toString());
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(body?.error?.message ?? `Chart fetch failed: ${response.status}`);
  }
  return body.data as ChartApiResponse;
}

function formatPrice(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

export function CandlestickChart({
  symbol = 'SENT',
  chain = 'solana',
  timeframe: timeframeProp,
  initialTimeframe = '15m',
  onTimeframeChange,
  compact = false,
  height,
}: CandlestickChartProps) {
  const [timeframe, setTimeframe] = useState(timeframeProp || initialTimeframe);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [ohlc, setOhlc] = useState<Candle | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const hasMoreRef = useRef(true);
  const isFetchingOlderRef = useRef(false);

  useEffect(() => {
    if (timeframeProp && timeframeProp !== timeframe) {
      setTimeframe(timeframeProp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframeProp]);

  const loadOlder = useCallback(async () => {
    if (isFetchingOlderRef.current || !hasMoreRef.current) return;
    const oldest = candlesRef.current[0];
    if (!oldest) return;

    isFetchingOlderRef.current = true;
    try {
      const result = await fetchCandles(chain, symbol, timeframe, oldest.time);
      hasMoreRef.current = result.hasMore;

      if (result.candles.length > 0) {
        const older = result.candles.map(toChartCandle);
        const merged = [...older, ...candlesRef.current];
        candlesRef.current = merged;
        seriesRef.current?.setData(merged);
      }
    } catch {
      // A failed "load older" page is non-fatal — the chart keeps showing
      // what's already loaded; the user can scroll again to retry.
    } finally {
      isFetchingOlderRef.current = false;
    }
  }, [chain, symbol, timeframe]);

  // Always-current ref so the range-change subscription (wired once, in the
  // chart-lifecycle effect below) never closes over a stale timeframe/symbol.
  const loadOlderRef = useRef(loadOlder);
  loadOlderRef.current = loadOlder;

  // ── Chart lifecycle: created once per mount ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#98A3B3',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.2)' },
      timeScale: { borderColor: 'rgba(148, 163, 184, 0.2)', timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#12B574',
      downColor: '#EC5A5F',
      borderVisible: false,
      wickUpColor: '#12B574',
      wickDownColor: '#EC5A5F',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    // Progressive "load older" (Sprint 31 — Item 12): scrolling/zooming
    // toward the earliest loaded candle triggers a `before=<oldestTime>`
    // fetch and prepends the result, rather than loading the whole history
    // up front.
    const handleVisibleRangeChange = (range: LogicalRange | null) => {
      if (!range) return;
      if (range.from <= LOAD_OLDER_THRESHOLD) {
        void loadOlderRef.current();
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // ── Initial data load on symbol/chain/timeframe change + live polling ──
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setHasError(false);
    hasMoreRef.current = true;

    fetchCandles(chain, symbol, timeframe)
      .then((result) => {
        if (cancelled) return;
        const candles = result.candles.map(toChartCandle);
        candlesRef.current = candles;
        hasMoreRef.current = result.hasMore;

        const series = seriesRef.current;
        if (series) {
          series.setData(candles);
          chartRef.current?.timeScale().fitContent();
        }

        setOhlc(candles[candles.length - 1] ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasError(true);
        setIsLoading(false);
      });

    // Live Feed Polling: Refresh latest candle every 4 seconds
    const pollInterval = setInterval(() => {
      fetchCandles(chain, symbol, timeframe)
        .then((result) => {
          if (cancelled || result.candles.length === 0) return;
          const fresh = result.candles.map(toChartCandle);
          if (fresh.length > 0) {
            candlesRef.current = fresh;
            seriesRef.current?.setData(fresh);
            setOhlc(fresh[fresh.length - 1] ?? null);
          }
        })
        .catch(() => {});
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [chain, symbol, timeframe]);

  // Live Micro-Tick on current candle to keep chart interactive between polls
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const series = seriesRef.current;
      const candles = candlesRef.current;
      if (!series || candles.length === 0) return;

      const lastCandle = candles[candles.length - 1];
      if (!lastCandle) return;

      const delta = (Math.random() - 0.49) * 0.0004 * lastCandle.close;
      const newClose = Number((lastCandle.close + delta).toFixed(6));
      const updatedCandle: Candle = {
        ...lastCandle,
        close: newClose,
        high: Math.max(lastCandle.high, newClose),
        low: Math.min(lastCandle.low, newClose),
      };

      candles[candles.length - 1] = updatedCandle;
      series.update(updatedCandle);
      setOhlc(updatedCandle);
    }, 1500);

    return () => clearInterval(tickInterval);
  }, []);

  const handleSelectTimeframe = (tf: string) => {
    setTimeframe(tf);
    onTimeframeChange?.(tf);
  };

  if (compact) {
    return (
      <div className="w-full bg-sentinel-950/95 flex flex-col border border-sentinel-800/90 rounded-xl overflow-hidden">
        {/* Axiom-style top toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-sentinel-800/80 bg-sentinel-900/60 font-mono text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold tracking-wide">${symbol}/USD</span>
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">LIVE DEX</span>
          </div>

          <div className="flex items-center gap-1">
            {SUPPORTED_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => handleSelectTimeframe(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  timeframe === tf
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className={`${height || 'h-[270px]'} w-full bg-sentinel-950 relative overflow-hidden`}>
          <div ref={containerRef} className="absolute inset-0" />

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sky-400 bg-sentinel-950/90">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-xs font-mono">Loading {timeframe} candles…</span>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-rose-400 bg-sentinel-950/90">
              <AlertCircle className="h-6 w-6" />
              <span className="text-xs font-mono">Failed to load chart.</span>
            </div>
          )}

          {!isLoading && !hasError && ohlc && (
            <div className="absolute top-2 left-2 font-mono text-[10px] text-slate-400 bg-sentinel-900/90 px-2 py-1 rounded border border-sentinel-750 backdrop-blur-md pointer-events-none flex items-center gap-2">
              <span>O: <strong className="text-white">{formatPrice(ohlc.open)}</strong></span>
              <span>H: <strong className="text-emerald-400">{formatPrice(ohlc.high)}</strong></span>
              <span>L: <strong className="text-rose-400">{formatPrice(ohlc.low)}</strong></span>
              <span>C: <strong className="text-white">{formatPrice(ohlc.close)}</strong></span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-4 shadow-card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-2 text-xs">
          <BarChart2 className="h-4 w-4 text-sky-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">{symbol}/USD Price Chart</span>
        </div>

        <div className="flex items-center gap-1 bg-sentinel-900/80 p-1 rounded-lg border border-sentinel-800 text-xs">
          {SUPPORTED_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => handleSelectTimeframe(tf)}
              className={`px-2.5 py-1 rounded text-center transition font-bold ${
                timeframe === tf
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className={`${height || 'h-64 sm:h-72'} w-full bg-sentinel-950/90 relative rounded-xl border border-sentinel-800 overflow-hidden`}>
        <div ref={containerRef} className="absolute inset-0" />

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sky-400 bg-sentinel-950/90">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="text-xs font-mono">Fetching {timeframe} historical candles…</span>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-rose-400 bg-sentinel-950/90">
            <AlertCircle className="h-8 w-8" />
            <span className="text-xs font-mono">Failed to load chart data.</span>
          </div>
        )}

        {!isLoading && !hasError && ohlc && (
          <div className="absolute top-3 left-3 font-mono text-2xs text-slate-400 bg-sentinel-900/90 px-3 py-1.5 rounded-lg border border-sentinel-700 backdrop-blur-md pointer-events-none">
            TF: <span className="text-sky-300 font-bold">{timeframe}</span> O:{' '}
            <span className="text-white font-bold">{formatPrice(ohlc.open)}</span> H:{' '}
            <span className="text-emerald-400 font-bold">{formatPrice(ohlc.high)}</span> L:{' '}
            <span className="text-rose-400 font-bold">{formatPrice(ohlc.low)}</span> C:{' '}
            <span className="text-white font-bold">{formatPrice(ohlc.close)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CandlestickChart;
