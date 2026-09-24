'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Chart, Crosshair, DataLoaderGetBarsParams, DeepPartial, KLineData, Period, Styles } from 'klinecharts';
import { RefreshCw, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useChartData } from '@/lib/hooks/use-chart-data';
import { CHART_TIMEFRAMES, isChartTimeframe, chartPrecision, type ChartTimeframe } from '@/lib/market/chart-model';
import { barsAfterLoaded, sameKLineData, toKLineDataList } from '@/lib/market/kline-adapter';

export interface CandlestickChartProps {
  /** Token mint, retained under the original prop name for compatibility. */
  symbol?: string;
  tokenSymbol?: string;
  chain?: string;
  timeframe?: string;
  initialTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  compact?: boolean;
  height?: string;
}

const control = 'min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 rounded-md px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-50';
const formatPrice = (value: number) => '$' + value.toLocaleString('en-US', { maximumSignificantDigits: 6 });
const displaySymbol = (value: string) => value.length > 12 ? value.slice(0, 4) + '…' + value.slice(-4) : value || 'Token';
const periodFor = (timeframe: ChartTimeframe): Period => timeframe === '1d' ? { type: 'day', span: 1 }
  : timeframe.endsWith('h') ? { type: 'hour', span: Number(timeframe.slice(0, -1)) }
    : { type: 'minute', span: Number(timeframe.slice(0, -1)) };

// KLineChart's full style example adapted to Sentinel's graphite, buy/sell, and azure tokens.
const chartStyles = {
  grid: {
    show: true,
    horizontal: { show: true, style: 'dashed', dashedValue: [2, 2], size: 1, color: 'rgba(148,163,184,0.1)' },
    vertical: { show: true, style: 'dashed', dashedValue: [2, 2], size: 1, color: 'rgba(148,163,184,0.1)' },
  },
  candle: {
    type: 'candle_solid',
    bar: {
      compareRule: 'current_open',
      upColor: '#12B574', downColor: '#EC5A5F', noChangeColor: '#98A3B3',
      upBorderColor: '#12B574', downBorderColor: '#EC5A5F', noChangeBorderColor: '#98A3B3',
      upWickColor: '#12B574', downWickColor: '#EC5A5F', noChangeWickColor: '#98A3B3',
    },
    priceMark: {
      show: true,
      high: { show: true, color: '#98A3B3', textSize: 10, textFamily: 'ui-monospace, monospace' },
      low: { show: true, color: '#98A3B3', textSize: 10, textFamily: 'ui-monospace, monospace' },
      last: {
        show: true, compareRule: 'current_open',
        upColor: '#12B574', downColor: '#EC5A5F', noChangeColor: '#98A3B3',
        line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1 },
        text: { show: true, style: 'fill', color: '#F2F5F9', size: 11, family: 'ui-monospace, monospace',
          borderRadius: 2, paddingLeft: 4, paddingRight: 4, paddingTop: 3, paddingBottom: 3 },
      },
    },
    // The external OHLCV strip stays visible; a second on-canvas legend would obscure compact charts.
    tooltip: { showRule: 'none' },
  },
  indicator: {
    tooltip: { showRule: 'none' },
    ohlc: { compareRule: 'current_open', upColor: 'rgba(18,181,116,0.55)', downColor: 'rgba(236,90,95,0.55)' },
    bars: [{ upColor: 'rgba(18,181,116,0.4)', downColor: 'rgba(236,90,95,0.4)', noChangeColor: 'rgba(152,163,179,0.35)' }],
  },
  xAxis: {
    axisLine: { show: true, color: '#33404F', size: 1 },
    tickLine: { show: true, color: '#33404F', size: 1 },
    tickText: { show: true, color: '#98A3B3', size: 11, family: 'ui-monospace, monospace' },
  },
  yAxis: {
    axisLine: { show: true, color: '#33404F', size: 1 },
    tickLine: { show: true, color: '#33404F', size: 1 },
    tickText: { show: true, color: '#98A3B3', size: 11, family: 'ui-monospace, monospace' },
  },
  separator: { color: '#33404F', size: 1, activeBackgroundColor: 'rgba(59,143,240,0.08)' },
  crosshair: {
    horizontal: {
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#6E7A8A' },
      text: { show: true, style: 'fill', color: '#F2F5F9', size: 11, family: 'ui-monospace, monospace',
        borderColor: '#33404F', borderSize: 1, backgroundColor: '#1C2531', borderRadius: 2 },
    },
    vertical: {
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#6E7A8A' },
      text: { show: true, style: 'fill', color: '#F2F5F9', size: 11, family: 'ui-monospace, monospace',
        borderColor: '#33404F', borderSize: 1, backgroundColor: '#1C2531', borderRadius: 2 },
    },
  },
  overlay: {
    point: { color: '#3B8FF0', borderColor: 'rgba(59,143,240,0.35)', activeColor: '#7FB2F6', activeBorderColor: 'rgba(59,143,240,0.5)' },
    line: { color: '#3B8FF0' },
  },
} satisfies DeepPartial<Styles>;

export function CandlestickChart(props: CandlestickChartProps) {
  const [selected, setSelected] = useState(props.initialTimeframe || '15m');
  const requested = props.timeframe ?? selected;
  const timeframe = isChartTimeframe(requested) ? requested : '15m';
  // A new instrument/interval owns a fresh canvas, request lifecycle, and stream revision map.
  return <ChartWorkspace key={`${props.chain || 'solana'}:${props.symbol}:${timeframe}`} {...props}
    selectedTimeframe={timeframe} selectTimeframe={tf => { setSelected(tf); props.onTimeframeChange?.(tf); }} />;
}

function ChartWorkspace({ symbol = '', tokenSymbol, chain = 'solana', compact = false, height,
  selectedTimeframe: timeframe, selectTimeframe }: CandlestickChartProps & {
    selectedTimeframe: ChartTimeframe; selectTimeframe: (tf: ChartTimeframe) => void;
  }) {
  const feed = useChartData(symbol, chain, timeframe);
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<Chart | null>(null);
  const feedRef = useRef(feed);
  feedRef.current = feed;
  const pendingInit = useRef<DataLoaderGetBarsParams['callback'] | null>(null);
  const restoreTimestamp = useRef<number | null>(null);
  const onBar = useRef<((bar: KLineData) => void) | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let disposeChart: (() => void) | undefined;
    // KLineChart requires a mounted DOM container. Keep the rendering package out of server evaluation.
    void import('klinecharts').then(({ init, dispose }) => {
      if (disposed) return;
      const api = init(element, {
        timezone: 'Etc/UTC',
        styles: chartStyles,
      });
      if (!api) { setChartError('The chart could not initialize.'); return; }
      chart.current = api;
      const observer = new ResizeObserver(() => api.resize());
      observer.observe(element);
      disposeChart = () => { observer.disconnect(); dispose(api); };
      api.setBarSpace(7);
      const volumePane = api.createIndicator('VOL', false);
      if (volumePane) api.setPaneOptions({ id: volumePane, height: 68, minHeight: 48 });
      api.subscribeAction('onCrosshairChange', value => {
        const crosshair = value as Crosshair | undefined;
        setHoverTime(typeof crosshair?.timestamp === 'number' ? crosshair.timestamp / 1000 : null);
      });
      const existing = feedRef.current.candles;
      const precision = existing.length ? chartPrecision(Math.min(...existing.map(c => c.low))).precision : 12;
      api.setSymbol({ ticker: symbol, pricePrecision: precision, volumePrecision: 4 });
      api.setPeriod(periodFor(timeframe));
      api.setDataLoader({
        getBars: ({ type, callback }) => {
          const current = feedRef.current;
          // The hook owns bounded pagination. KLineChart otherwise auto-fetches repeatedly when a short series fits on screen.
          if (type === 'forward' || type === 'backward') { queueMicrotask(() => callback([], false)); return; }
          if (current.loading) { pendingInit.current = callback; return; }
          queueMicrotask(() => {
            if (disposed) return;
            callback(toKLineDataList(feedRef.current.candles), false);
            const restore = restoreTimestamp.current;
            restoreTimestamp.current = null;
            if (restore !== null) requestAnimationFrame(() => { if (!disposed) api.scrollToTimestamp(restore, 0); });
          });
        },
        subscribeBar: ({ callback }) => {
          onBar.current = callback;
          // A frame can arrive between the initial history callback and this subscription.
          queueMicrotask(() => {
            if (disposed || onBar.current !== callback) return;
            for (const bar of barsAfterLoaded(api.getDataList(), toKLineDataList(feedRef.current.candles))) callback(bar);
          });
        },
        unsubscribeBar: () => { onBar.current = null; },
      });
    }).catch(() => { if (!disposed) setChartError('The chart library could not load.'); });
    return () => {
      disposed = true;
      pendingInit.current = null; restoreTimestamp.current = null; onBar.current = null;
      disposeChart?.(); chart.current = null;
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    const api = chart.current;
    if (!api) return;
    if (pendingInit.current && !feed.loading) {
      const precision = feed.candles.length ? chartPrecision(Math.min(...feed.candles.map(c => c.low))).precision : 12;
      if (api.getSymbol()?.pricePrecision !== precision) {
        pendingInit.current = null;
        api.setSymbol({ ticker: symbol, pricePrecision: precision, volumePrecision: 4 });
        return;
      }
      const callback = pendingInit.current;
      pendingInit.current = null;
      queueMicrotask(() => { if (chart.current === api) callback(toKLineDataList(feedRef.current.candles), false); });
      return;
    }
    const current = api.getDataList();
    const next = toKLineDataList(feed.candles);
    if (!next.length) return;
    if (!current.length) { api.resetData(); return; }
    const first = current[0].timestamp;
    const last = current[current.length - 1].timestamp;
    // v10 accepts only the latest/new bar in subscribeBar. Reconcile older corrections through its loader.
    const known = new Map(current.map(row => [row.timestamp, row]));
    const historicalCorrection = next.some(row => row.timestamp >= first && row.timestamp < last
      && (!known.has(row.timestamp) || !sameKLineData(row, known.get(row.timestamp)!)));
    if (historicalCorrection || next[0].timestamp < first) {
      if (next[0].timestamp < first) restoreTimestamp.current = first;
      api.resetData();
      return;
    }
    if (!onBar.current) return;
    for (const row of barsAfterLoaded(current, next)) onBar.current(row);
  }, [feed.candles, feed.loading, feed.loadingOlder, feed.hasMore, feed.olderError, symbol]);

  const active = feed.candles.find(c => c.time === hoverTime) ?? feed.candles[feed.candles.length - 1];
  const empty = !feed.candles.length;
  const updated = Math.max(feed.observedAt, feed.streamAt);
  return (
    <section aria-label="Token price chart" data-chart-status={chartError ? 'Unavailable' : feed.status} data-candle-count={feed.candles.length}
      className="w-full min-w-0 overflow-hidden rounded-md border border-sentinel-800 bg-sentinel-950 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-sentinel-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="truncate font-semibold text-slate-200">{displaySymbol(tokenSymbol || symbol)}/USD</span>
          <span role="status" title={updated ? 'Birdeye · observed ' + new Date(updated).toLocaleTimeString() : 'Waiting for provider data'}
            className={feed.status === 'Live' ? 'text-emerald-400' : feed.status === 'Delayed' ? 'text-amber-400' : 'text-slate-400'}>{chartError ? 'Unavailable' : feed.status}</span>
        </div>
        <div className="flex flex-wrap items-center gap-0.5" aria-label="Chart timeframe">
          {CHART_TIMEFRAMES.map(tf => <button key={tf} type="button" aria-pressed={tf === timeframe}
            onClick={() => selectTimeframe(tf)} className={control + (tf === timeframe ? ' bg-sky-500/15 text-sky-300' : ' text-slate-400 hover:bg-sentinel-800')}>{tf}</button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-sentinel-800 px-3 text-[11px] text-slate-400">
        <span>Birdeye · Token aggregate · USD</span>
        <div className="flex gap-0.5">
          <button type="button" aria-label="Zoom in" className={control} onClick={() => chart.current?.zoomAtCoordinate(1)}><ZoomIn className="mx-auto h-4 w-4" /></button>
          <button type="button" aria-label="Zoom out" className={control} onClick={() => chart.current?.zoomAtCoordinate(-1)}><ZoomOut className="mx-auto h-4 w-4" /></button>
          <button type="button" aria-label="Reset chart view" className={control} onClick={() => { chart.current?.setBarSpace(7); chart.current?.scrollToRealTime(0); }}><RotateCcw className="mx-auto h-4 w-4" /></button>
          <button type="button" aria-label="Refresh chart" aria-busy={feed.refreshing} disabled={feed.refreshing} className={control} onClick={feed.refresh}><RefreshCw className={'mx-auto h-4 w-4 ' + (feed.refreshing ? 'motion-safe:animate-spin' : '')} /></button>
        </div>
      </div>
      <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 text-[11px] text-slate-400" data-testid="chart-ohlcv">
        {active ? <>{(['open', 'high', 'low', 'close'] as const).map(field => <span key={field}>{field[0].toUpperCase()}: <span className="text-slate-200">{formatPrice(active[field])}</span></span>)}
          <span title="Base-token volume; not USD volume">Vol: {active.volume === null ? 'Unavailable' : active.volume.toLocaleString('en-US', { maximumSignificantDigits: 5 })}</span></> : <span>OHLCV awaits provider data</span>}
      </div>
      <div className={(height || (compact ? 'h-[270px]' : 'h-64 sm:h-80')) + ' relative w-full'}>
        <div ref={container} className="absolute inset-0 z-0 bg-[#080d14]" />
        {(empty || chartError) && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-sentinel-950/95 px-5 text-center text-xs text-slate-400">
          <p role={feed.error || chartError ? 'alert' : 'status'}>{chartError || (feed.loading ? 'Loading real ' + timeframe + ' candles…' : feed.error || 'No indexed candles yet. Waiting for trades.')}</p>
          {!feed.loading && !chartError && <button type="button" className={control + ' border border-sentinel-700 text-sky-300'} disabled={feed.refreshing} aria-busy={feed.refreshing} onClick={feed.refresh}>Retry chart</button>}
        </div>}
      </div>
      {!empty && feed.error && <p role="alert" className="px-3 py-2 text-[11px] text-amber-400">{feed.error} Existing candles are retained.</p>}
      {!empty && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sentinel-800 px-3 py-1 text-[11px] text-slate-400">
        <span>Volume in token units · Gaps are not fabricated</span>
        {feed.hasMore && <button type="button" className={control + ' text-sky-300'} disabled={feed.loadingOlder} aria-busy={feed.loadingOlder}
          onClick={feed.loadOlder}>Load older candles</button>}
        {feed.olderError && <span role="alert" className="text-amber-400">{feed.olderError}</span>}
      </div>}
    </section>
  );
}
export default CandlestickChart;
