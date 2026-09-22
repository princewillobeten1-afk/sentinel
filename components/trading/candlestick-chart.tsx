'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, ColorType, CrosshairMode,
  type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { RefreshCw, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useChartData } from '@/lib/hooks/use-chart-data';
import { CHART_TIMEFRAMES, isChartTimeframe, chartPrecision, type ChartCandle, type ChartTimeframe } from '@/lib/market/chart-model';

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
  const chart = useRef<IChartApi | null>(null);
  const prices = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumes = useRef<ISeriesApi<'Histogram'> | null>(null);
  const previous = useRef<ChartCandle[]>([]);
  const rendering = useRef(false);
  const loadOlder = useRef(feed.loadOlder);
  loadOlder.current = feed.loadOlder;
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const api = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#080d14' }, textColor: '#98A3B3',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(148,163,184,0.07)' }, horzLines: { color: 'rgba(148,163,184,0.07)' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.2)', scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: 'rgba(148,163,184,0.2)', timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    const priceSeries = api.addSeries(CandlestickSeries, {
      upColor: '#12B574', downColor: '#EC5A5F', borderVisible: false, wickUpColor: '#12B574', wickDownColor: '#EC5A5F',
    });
    const volumeSeries = api.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    chart.current = api; prices.current = priceSeries; volumes.current = volumeSeries;
    api.subscribeCrosshairMove(event => setHoverTime(typeof event.time === 'number' ? event.time : null));
    let dragging = false;
    api.timeScale().subscribeVisibleLogicalRangeChange(range => {
      // Resizes/data insertion must not silently download the whole market.
      if (dragging && !rendering.current && range && range.from < -20) loadOlder.current();
    });
    const element = container.current;
    const wheel = (event: WheelEvent) => api.applyOptions({ handleScale: { mouseWheel: event.ctrlKey || event.metaKey } });
    const startDrag = () => { dragging = true; };
    const endDrag = () => { dragging = false; };
    element.addEventListener('wheel', wheel, { passive: true });
    element.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      element.removeEventListener('wheel', wheel); element.removeEventListener('pointerdown', startDrag);
      window.removeEventListener('pointerup', endDrag); window.removeEventListener('pointercancel', endDrag);
      api.remove(); chart.current = null; prices.current = null; volumes.current = null;
    };
  }, []);

  useEffect(() => {
    if (!prices.current || !volumes.current || !chart.current) return;
    const rows = feed.candles;
    const prior = previous.current;
    const range = chart.current.timeScale().getVisibleLogicalRange();
    const prepended = prior.length ? rows.filter(c => c.time < prior[0].time).length : 0;
    rendering.current = true;
    if (rows.length) prices.current.applyOptions({ priceFormat: { type: 'price', ...chartPrecision(Math.min(...rows.map(c => c.low))) } });
    prices.current.setData(rows.map(c => ({ ...c, time: c.time as UTCTimestamp })));
    volumes.current.setData(rows.filter(c => c.volume !== null).map(c => ({
      time: c.time as UTCTimestamp, value: c.volume!, color: c.close >= c.open ? 'rgba(18,181,116,0.35)' : 'rgba(236,90,95,0.35)',
    })));
    if (!prior.length && rows.length) chart.current.timeScale().fitContent();
    else if (range && prepended) chart.current.timeScale().setVisibleLogicalRange({ from: range.from + prepended, to: range.to + prepended });
    previous.current = rows;
    rendering.current = false;
  }, [feed.candles]);

  const zoom = (factor: number) => {
    const scale = chart.current?.timeScale();
    const range = scale?.getVisibleLogicalRange();
    if (!scale || !range) return;
    const center = (range.from + range.to) / 2;
    const span = Math.max(10, (range.to - range.from) * factor);
    scale.setVisibleLogicalRange({ from: center - span / 2, to: center + span / 2 });
  };
  const active = feed.candles.find(c => c.time === hoverTime) ?? feed.candles[feed.candles.length - 1];
  const empty = !feed.candles.length;
  const updated = Math.max(feed.observedAt, feed.streamAt);
  return (
    <section aria-label="Token price chart" data-chart-status={feed.status} data-candle-count={feed.candles.length}
      className="w-full min-w-0 overflow-hidden rounded-md border border-sentinel-800 bg-sentinel-950 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-sentinel-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="truncate font-semibold text-slate-200">{displaySymbol(tokenSymbol || symbol)}/USD</span>
          <span role="status" title={updated ? 'Birdeye · observed ' + new Date(updated).toLocaleTimeString() : 'Waiting for provider data'}
            className={feed.status === 'Live' ? 'text-emerald-400' : feed.status === 'Delayed' ? 'text-amber-400' : 'text-slate-400'}>{feed.status}</span>
        </div>
        <div className="flex flex-wrap items-center gap-0.5" aria-label="Chart timeframe">
          {CHART_TIMEFRAMES.map(tf => <button key={tf} type="button" aria-pressed={tf === timeframe}
            onClick={() => selectTimeframe(tf)} className={control + (tf === timeframe ? ' bg-sky-500/15 text-sky-300' : ' text-slate-400 hover:bg-sentinel-800')}>{tf}</button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-sentinel-800 px-3 text-[11px] text-slate-400">
        <span>Birdeye · Token aggregate · USD</span>
        <div className="flex gap-0.5">
          <button type="button" aria-label="Zoom in" className={control} onClick={() => zoom(0.7)}><ZoomIn className="mx-auto h-4 w-4" /></button>
          <button type="button" aria-label="Zoom out" className={control} onClick={() => zoom(1.4)}><ZoomOut className="mx-auto h-4 w-4" /></button>
          <button type="button" aria-label="Reset chart view" className={control} onClick={() => chart.current?.timeScale().fitContent()}><RotateCcw className="mx-auto h-4 w-4" /></button>
          <button type="button" aria-label="Refresh chart" aria-busy={feed.refreshing} disabled={feed.refreshing} className={control} onClick={feed.refresh}><RefreshCw className={'mx-auto h-4 w-4 ' + (feed.refreshing ? 'motion-safe:animate-spin' : '')} /></button>
        </div>
      </div>
      <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 text-[11px] text-slate-400" data-testid="chart-ohlcv">
        {active ? <>{(['open', 'high', 'low', 'close'] as const).map(field => <span key={field}>{field[0].toUpperCase()}: <span className="text-slate-200">{formatPrice(active[field])}</span></span>)}
          <span title="Base-token volume; not USD volume">Vol: {active.volume === null ? 'Unavailable' : active.volume.toLocaleString('en-US', { maximumSignificantDigits: 5 })}</span></> : <span>OHLCV awaits provider data</span>}
      </div>
      <div className={(height || (compact ? 'h-[270px]' : 'h-64 sm:h-80')) + ' relative w-full'}>
        <div ref={container} className="absolute inset-0" />
        {empty && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sentinel-950/95 px-5 text-center text-xs text-slate-400">
          <p role={feed.error ? 'alert' : 'status'}>{feed.loading ? 'Loading real ' + timeframe + ' candles…' : feed.error || 'No indexed candles yet. Waiting for trades.'}</p>
          {!feed.loading && <button type="button" className={control + ' border border-sentinel-700 text-sky-300'} disabled={feed.refreshing} aria-busy={feed.refreshing} onClick={feed.refresh}>Retry chart</button>}
        </div>}
      </div>
      {!empty && feed.error && <p role="alert" className="px-3 py-2 text-[11px] text-amber-400">{feed.error} Existing candles are retained.</p>}
      {!empty && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sentinel-800 px-3 py-1 text-[11px] text-slate-400">
        <span>Volume in token units · Gaps are not fabricated</span>
        {feed.hasMore && <button type="button" className={control + ' text-sky-300'} disabled={feed.loadingOlder} aria-busy={feed.loadingOlder} onClick={feed.loadOlder}>Load older candles</button>}
        {feed.olderError && <span role="alert" className="text-amber-400">{feed.olderError}</span>}
      </div>}
    </section>
  );
}
export default CandlestickChart;
