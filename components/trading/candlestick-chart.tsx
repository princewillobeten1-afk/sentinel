'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Chart, Crosshair, DataLoaderGetBarsParams, DeepPartial, KLineData, Period, Styles } from 'klinecharts';
import { BarChart3, ChevronDown, RefreshCw, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
const formatPrice = (value: number) => '$' + value.toLocaleString('en-US', { maximumSignificantDigits: 8 });
const formatVolume = (value: number) => '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
type ChartIndicator = 'VOL' | 'EMA' | 'BOLL' | 'RSI';
const INDICATORS: { name: ChartIndicator; label: string; minBars: number; description: string }[] = [
  { name: 'VOL', label: 'Volume', minBars: 1, description: 'Measured volume beneath price' },
  { name: 'EMA', label: 'EMA 6 / 12 / 20', minBars: 20, description: 'Moving averages on price' },
  { name: 'BOLL', label: 'Bollinger 20 / 2', minBars: 20, description: 'Volatility bands on price' },
  { name: 'RSI', label: 'RSI 14', minBars: 14, description: 'Momentum in a separate pane' },
];
const INDICATOR_STORAGE_KEY = 'sentinel.chart.indicators.v1';
function syncIndicators(api: Chart, selected: ChartIndicator[], bars: number,
  ids: Partial<Record<ChartIndicator, string>>): void {
  for (const item of INDICATORS) {
    const wanted = selected.includes(item.name) && bars >= item.minBars;
    const existing = ids[item.name];
    if (!wanted && existing) {
      api.removeIndicator({ id: existing });
      delete ids[item.name];
      continue;
    }
    if (!wanted || existing) continue;
    const onPrice = item.name === 'EMA' || item.name === 'BOLL';
    const id = api.createIndicator({ name: item.name,
      ...(item.name === 'EMA' ? { calcParams: [6, 12, 20] }
        : item.name === 'BOLL' ? { calcParams: [20, 2] }
          : item.name === 'RSI' ? { calcParams: [14] }
            : { calcParams: [5, 10, 20] }),
      ...(onPrice ? { paneId: 'candle_pane' } : {}) }, onPrice);
    if (!id) continue;
    ids[item.name] = id;
    if (!onPrice) {
      // createIndicator returns an indicator id, not a pane id.
      const paneId = api.getIndicators({ id })[0]?.paneId;
      if (paneId) api.setPaneOptions({ id: paneId, height: item.name === 'VOL' ? 104 : 116, minHeight: 72 });
    }
  }
}
const displaySymbol = (value: string) => value.length > 12 ? value.slice(0, 4) + '…' + value.slice(-4) : value || 'Token';
const periodFor = (timeframe: ChartTimeframe): Period => timeframe === '1d' ? { type: 'day', span: 1 }
  : timeframe.endsWith('h') ? { type: 'hour', span: Number(timeframe.slice(0, -1)) }
    : { type: 'minute', span: Number(timeframe.slice(0, -1)) };

// Keep Sentinel's chart styles separate from its provider-backed v10 data loader.
const chartStyles: DeepPartial<Styles> = {
  grid: {
    show: true,
    horizontal: { show: true, style: 'dashed', dashedValue: [3, 4], size: 1, color: '#223044' },
    vertical: { show: true, style: 'dashed', dashedValue: [3, 4], size: 1, color: '#1c2838' },
  },
  candle: {
    type: 'candle_solid',
    bar: {
      compareRule: 'current_open',
      upColor: '#22cfa3', downColor: '#f06178', noChangeColor: '#64748b',
      upBorderColor: '#22cfa3', downBorderColor: '#f06178', noChangeBorderColor: '#64748b',
      upWickColor: '#22cfa3', downWickColor: '#f06178', noChangeWickColor: '#64748b',
    },
    priceMark: {
      show: true,
      high: { show: true, color: '#94a3b8', textSize: 10, textFamily: 'ui-monospace, monospace' },
      low: { show: true, color: '#94a3b8', textSize: 10, textFamily: 'ui-monospace, monospace' },
      last: {
        show: true, compareRule: 'current_open',
        upColor: '#22cfa3', downColor: '#f06178', noChangeColor: '#64748b',
        line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1 },
        text: { show: true, style: 'fill', color: '#ffffff', size: 11, family: 'ui-monospace, monospace',
          borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 3, paddingBottom: 3 },
      },
    },
    tooltip: {
      showRule: 'follow_cross', showType: 'standard',
      title: { show: false, template: '{ticker} · {period}', color: '#f1f5f9', size: 11,
        family: 'ui-monospace, monospace', weight: 600 },
      legend: { color: '#94a3b8', size: 10, family: 'ui-monospace, monospace',
        template: [
          { title: 'Time', value: '{time}' }, { title: 'O', value: '{open}' },
          { title: 'H', value: '{high}' }, { title: 'L', value: '{low}' },
          { title: 'C', value: '{close}' }, { title: 'Vol', value: '{volume}' },
        ] },
    },
  },
  indicator: {
    tooltip: {
      showRule: 'follow_cross', showType: 'standard',
      title: { show: true, showName: true, showParams: true, color: '#e2e8f0', size: 10,
        family: 'ui-monospace, monospace' },
      legend: { color: '#94a3b8', size: 10, family: 'ui-monospace, monospace' },
    },
    ohlc: { compareRule: 'current_open', upColor: '#22cfa3', downColor: '#f06178', noChangeColor: '#64748b' },
    bars: [{ upColor: 'rgba(34,207,163,0.72)', downColor: 'rgba(240,97,120,0.72)', noChangeColor: '#64748b' }],
    lines: [
      { color: '#f59e0b', size: 1 }, { color: '#8b5cf6', size: 1 },
      { color: '#0ea5e9', size: 1 }, { color: '#ec4899', size: 1 },
      { color: '#14b8a6', size: 1 },
    ],
    lastValueMark: { show: true, text: { show: true, color: '#ffffff', size: 10,
      family: 'ui-monospace, monospace', paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 } },
  },
  xAxis: {
    show: true,
    axisLine: { show: true, color: '#263449', size: 1 },
    tickLine: { show: true, color: '#263449', size: 1, length: 3 },
    tickText: { show: true, color: '#94a3b8', size: 11, family: 'ui-monospace, monospace' },
  },
  yAxis: {
    show: true,
    axisLine: { show: true, color: '#263449', size: 1 },
    tickLine: { show: true, color: '#263449', size: 1, length: 3 },
    tickText: { show: true, color: '#94a3b8', size: 11, family: 'ui-monospace, monospace' },
  },
  separator: { color: '#1e293b', size: 1, fill: true, activeBackgroundColor: 'rgba(14,165,233,0.1)' },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#475569' },
      text: { show: true, style: 'fill', color: '#f8fafc', size: 10, family: 'ui-monospace, monospace',
        borderColor: '#334155', borderSize: 1, backgroundColor: '#0f172a', borderRadius: 3 },
    },
    vertical: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#475569' },
      text: { show: true, style: 'fill', color: '#f8fafc', size: 10, family: 'ui-monospace, monospace',
        borderColor: '#334155', borderSize: 1, backgroundColor: '#0f172a', borderRadius: 3 },
    },
  },
  overlay: {
    point: { color: '#0ea5e9', borderColor: 'rgba(14,165,233,0.35)', activeColor: '#0284c7', activeBorderColor: 'rgba(14,165,233,0.5)' },
    line: { color: '#0ea5e9' },
  },
} satisfies DeepPartial<Styles>;

export function CandlestickChart(props: CandlestickChartProps) {
  const [selected, setSelected] = useState(props.initialTimeframe || '1m');
  const requested = props.timeframe ?? selected;
  const timeframe = isChartTimeframe(requested) ? requested : '1m';
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
  const seriesIdentity = useRef('token-aggregate');
  const indicatorIds = useRef<Partial<Record<ChartIndicator, string>>>({});
  const sizedTier = useRef<'sparse' | 'short' | 'full' | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [indicators, setIndicators] = useState<ChartIndicator[]>(['VOL']);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(INDICATOR_STORAGE_KEY) || 'null');
      if (Array.isArray(saved)) setIndicators(INDICATORS.map(item => item.name).filter(name => saved.includes(name)));
    } catch { /* Keep the default volume pane when storage is unavailable. */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(indicators)); } catch { /* Session-only settings. */ }
  }, [indicators]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let disposeChart: (() => void) | undefined;
    // KLineChart requires a mounted DOM container. Keep the rendering package out of server evaluation.
    void import('klinecharts').then(({ init, dispose }) => {
      if (disposed) return;
      const api = init(element, {
        layout: {
          barSpaceLimit: { min: 2, max: 45 },
          pane: { dragEnabled: true, minHeight: 64 },
          yAxis: {
            position: 'right',
            scrollZoomEnabled: true,
            inside: false,
            gap: { top: 0.12, bottom: 0.08 },
          },
        },
        locale: 'en-US',
        timezone: 'Etc/UTC',
        styles: chartStyles,
        // KLineChart's string-based defaults preserve every configured price digit.
        // Number(...).toLocaleString() rounds micro-priced tokens to "0".
        thousandsSeparator: { sign: ',' },
        decimalFold: { threshold: 3 },
        zoomAnchor: { main: 'last_bar', xAxis: 'last_bar' },
        hotkey: {
          enabled: true,
        },
        formatter: {
          formatBigNumber: (value: string | number) => {
            const num = Number(value);
            if (!Number.isFinite(num)) return String(value);
            if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
            if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
            if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
            return String(value);
          },
          // The built-in date formatter honors the timezone configured above.
        },
      });
      if (!api) { setChartError('The chart could not initialize.'); return; }
      chart.current = api;
      const syncChartSize = () => api.resize();
      const observer = new ResizeObserver(syncChartSize);
      observer.observe(element);
      syncChartSize();
      disposeChart = () => { observer.disconnect(); dispose(api); };
      api.setBarSpace(12);
      api.subscribeAction('onCrosshairChange', value => {
        const crosshair = value as Crosshair | undefined;
        setHoverTime(typeof crosshair?.timestamp === 'number' ? crosshair.timestamp / 1000 : null);
      });
      const existing = feedRef.current.candles;
      const precision = existing.length ? chartPrecision(Math.min(...existing.map(c => c.low))).precision : 12;
      api.setSymbol({ ticker: tokenSymbol || displaySymbol(symbol), pricePrecision: precision, volumePrecision: 4 });
      api.setPeriod(periodFor(timeframe));
      api.setDataLoader({
        getBars: ({ type, callback }) => {
          const current = feedRef.current;
          // The hook owns bounded pagination. KLineChart otherwise auto-fetches repeatedly when a short series fits on screen.
          if (type === 'forward' || type === 'backward') { queueMicrotask(() => callback([], false)); return; }
          if (current.loading) { pendingInit.current = callback; return; }
          queueMicrotask(() => {
            if (disposed) return;
            callback(toKLineDataList(feedRef.current.candles, feedRef.current.market === 'pool' ? 'usd' : 'token'), false);
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
            for (const bar of barsAfterLoaded(api.getDataList(),
              toKLineDataList(feedRef.current.candles, feedRef.current.market === 'pool' ? 'usd' : 'token'))) callback(bar);
          });
        },
        unsubscribeBar: () => { onBar.current = null; },
      });
      setChartReady(true);
    }).catch(() => { if (!disposed) setChartError('The chart library could not load.'); });
    return () => {
      disposed = true;
      // A pending init must complete even if this chart is unmounted mid-request.
      pendingInit.current?.([], false);
      pendingInit.current = null; restoreTimestamp.current = null; onBar.current = null;
      disposeChart?.(); chart.current = null;
    };
  }, [symbol, tokenSymbol, timeframe]);

  useEffect(() => {
    if (!chartReady || !chart.current) return;
    syncIndicators(chart.current, indicators, feed.candles.length, indicatorIds.current);
  }, [chartReady, indicators, feed.candles.length]);

  useEffect(() => {
    if (!chartReady || !chart.current || !feed.candles.length) return;
    const tier = feed.candles.length < 5 ? 'sparse' : feed.candles.length < 30 ? 'short' : 'full';
    if (sizedTier.current === tier) return;
    sizedTier.current = tier;
    chart.current.setBarSpace(tier === 'sparse' ? 28 : tier === 'short' ? 18 : 12);
    chart.current.scrollToRealTime(0);
  }, [chartReady, feed.candles.length]);

  useEffect(() => {
    const next = feed.market === 'pool' ? `pool:${feed.poolAddress}` : 'token-aggregate';
    if (seriesIdentity.current === next) return;
    seriesIdentity.current = next;
    chart.current?.resetData();
  }, [feed.market, feed.poolAddress]);

  useEffect(() => {
    const api = chart.current;
    if (!api) return;
    if (pendingInit.current && !feed.loading) {
      const precision = feed.candles.length ? chartPrecision(Math.min(...feed.candles.map(c => c.low))).precision : 12;
      const callback = pendingInit.current;
      pendingInit.current = null;
      if (api.getSymbol()?.pricePrecision !== precision) {
        // setSymbol starts a fresh init. Complete the old loader request first,
        // otherwise KLineChart may retain an unresolved pending callback.
        callback([], false);
        api.setSymbol({ ticker: tokenSymbol || displaySymbol(symbol), pricePrecision: precision, volumePrecision: 4 });
        return;
      }
      queueMicrotask(() => { if (chart.current === api) callback(toKLineDataList(feedRef.current.candles,
        feedRef.current.market === 'pool' ? 'usd' : 'token'), false); });
      return;
    }
    const current = api.getDataList();
    const next = toKLineDataList(feed.candles, feed.market === 'pool' ? 'usd' : 'token');
    if (!next.length) return;
    if (!current.length) { api.resetData(); return; }
    const first = current[0].timestamp;
    const last = current[current.length - 1].timestamp;
    // v10 accepts only the latest/new bar in subscribeBar. Reconcile older corrections through its loader.
    const known = new Map(current.map(row => [row.timestamp, row]));
    const historicalCorrection = next.some(row => row.timestamp >= first && row.timestamp < last
      && (!known.has(row.timestamp) || !sameKLineData(row, known.get(row.timestamp)!)));
    if (historicalCorrection || next[0].timestamp < first) {
      // A sparse first response filling in is a new viewport, not manual
      // pagination. Show the latest candles; preserve position only when the
      // user was already browsing a reasonably populated series.
      if (next[0].timestamp < first) restoreTimestamp.current = current.length >= 30 ? first : null;
      api.resetData();
      return;
    }
    if (!onBar.current) return;
    for (const row of barsAfterLoaded(current, next)) onBar.current(row);
  }, [feed.candles, feed.market, feed.loading, feed.loadingOlder, feed.hasMore, feed.olderError, symbol, tokenSymbol]);

  const hoveredIndex = feed.candles.findIndex(c => c.time === hoverTime);
  const activeIndex = hoveredIndex >= 0 ? hoveredIndex : feed.candles.length - 1;
  const active = feed.candles[activeIndex];
  const previous = feed.candles[activeIndex - 1];
  const change = active && previous?.close ? (active.close / previous.close - 1) * 100 : null;
  const empty = !feed.candles.length;
  const updated = Math.max(feed.observedAt, feed.streamAt);
  const sourceName = feed.source === 'geckoterminal-pool-ohlcv' ? 'GeckoTerminal'
    : feed.source === 'bitquery-token-ohlcv' ? 'Bitquery'
      : feed.source === 'bitquery-dex-ohlcv' ? 'Bitquery DEX'
      : feed.source === 'birdeye-ohlcv-v3' ? 'Birdeye'
        : feed.liveSource === 'quicknode' ? 'QuickNode live' : 'Provider pending';
  const sourceLabel = feed.market === 'pool'
    ? `${sourceName} · pool ${displaySymbol(feed.poolAddress || '')} · USD`
    : `${sourceName} · token aggregate · USD`;
  const visualStatus = chartError ? 'Unavailable' : feed.status;
  return (
    <section aria-label="Token price chart" data-chart-status={chartError ? 'Unavailable' : feed.status} data-candle-count={feed.candles.length}
      className="w-full min-w-0 overflow-hidden rounded-md border border-sentinel-800 bg-[#0b1017]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sentinel-800 bg-[#101721] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <BarChart3 className="h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />
          <span className="truncate text-xs font-semibold tracking-wide text-slate-100">{displaySymbol(tokenSymbol || symbol)} / USD</span>
          <span role="status" title={updated ? `${sourceLabel} · observed ${new Date(updated).toLocaleTimeString()}` : 'Waiting for market data'}
            className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${visualStatus === 'Live'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : visualStatus === 'Delayed' || visualStatus === 'Unavailable'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-sky-500/20 bg-sky-500/10 text-sky-300'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${visualStatus === 'Live' ? 'bg-emerald-400' : visualStatus === 'Delayed' || visualStatus === 'Unavailable' ? 'bg-amber-400' : 'bg-sky-400'}`} />
            {visualStatus}
          </span>
        </div>
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-sentinel-800 bg-sentinel-950 p-0.5" aria-label="Chart timeframe">
          {CHART_TIMEFRAMES.map(tf => (
            <button
              key={tf}
              type="button"
              aria-pressed={tf === timeframe}
              onClick={() => selectTimeframe(tf)}
              className={`min-h-9 min-w-9 shrink-0 rounded px-2 font-mono text-[11px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${tf === timeframe
                ? 'bg-sky-500/20 text-sky-200 shadow-inner'
                : 'text-slate-400 hover:bg-sentinel-800 hover:text-slate-100'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-sentinel-800/80 px-4 py-3">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{hoveredIndex >= 0 ? 'Selected close' : 'Last close'}</div>
            <div className="font-numeric text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">{active ? formatPrice(active.close) : '—'}</div>
          </div>
          {change !== null && <span className={`mb-1 rounded px-1.5 py-0.5 font-numeric text-xs font-semibold ${change >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}
            title={`Change from the previous ${timeframe} candle`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>}
        </div>
        <div data-testid="chart-ohlcv" className="flex min-w-0 max-w-full flex-nowrap items-center gap-x-3 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-slate-500 sm:flex-wrap sm:gap-y-1 sm:overflow-visible sm:whitespace-normal">
          {active ? <>
            <span className="text-slate-400">{new Date(active.time * 1000).toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC</span>
            {(['open', 'high', 'low', 'close'] as const).map(field => <span key={field}>{field[0].toUpperCase()} <b className="font-medium text-slate-200">{formatPrice(active[field])}</b></span>)}
            <span>Vol <b className="font-medium text-slate-200">{active.volumeUsd !== null ? formatVolume(active.volumeUsd) : '—'}</b></span>
          </> : <span>OHLCV awaits market data</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-sentinel-800/80 px-3 py-1 text-[11px] text-slate-400">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate" title={feed.market === 'pool' ? 'Pool-specific candles. Live swap bars are provisional until REST reconciliation.' : undefined}>{sourceLabel}</span>
          <span className="hidden shrink-0 border-l border-sentinel-700 pl-2 font-mono text-slate-500 sm:inline">{feed.candles.length} bars</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="relative">
            <button type="button" aria-label="Chart indicators" aria-expanded={indicatorsOpen} onClick={() => setIndicatorsOpen(open => !open)}
              className="flex min-h-[44px] items-center gap-1 rounded-md px-2 text-[11px] text-slate-300 hover:bg-sentinel-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 sm:min-h-8">
              Indicators <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
            {indicatorsOpen && <div role="group" aria-label="Indicator settings" className="absolute right-0 top-full z-20 w-56 rounded-md border border-sentinel-700 bg-[#151e2a] p-1.5 shadow-xl">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Chart studies</p>
              {INDICATORS.map(item => <button key={item.name} type="button" aria-pressed={indicators.includes(item.name)}
                disabled={feed.candles.length < item.minBars}
                title={feed.candles.length < item.minBars ? `Requires ${item.minBars} measured candles` : item.description}
                onClick={() => setIndicators(current => current.includes(item.name) ? current.filter(name => name !== item.name) : [...current, item.name])}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded px-2 text-left text-[11px] text-slate-200 hover:bg-sentinel-800 disabled:cursor-not-allowed disabled:text-slate-500">
                <span>{item.label}</span><span className="font-mono text-[10px] text-slate-500">{feed.candles.length < item.minBars ? `${item.minBars} bars` : indicators.includes(item.name) ? 'ON' : 'OFF'}</span>
              </button>)}
            </div>}
          </div>
          <button type="button" aria-label="Zoom in" title="Zoom in (+)" className={control + ' text-slate-400 hover:text-white hover:bg-sentinel-800'} onClick={() => chart.current?.zoomAtCoordinate(1)}><ZoomIn className="mx-auto h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Zoom out" title="Zoom out (-)" className={control + ' text-slate-400 hover:text-white hover:bg-sentinel-800'} onClick={() => chart.current?.zoomAtCoordinate(-1)}><ZoomOut className="mx-auto h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Reset chart view" title="Reset view" className={control + ' text-slate-400 hover:text-white hover:bg-sentinel-800'} onClick={() => { chart.current?.setBarSpace(12); chart.current?.scrollToRealTime(0); }}><RotateCcw className="mx-auto h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Refresh chart" title="Refresh chart data" aria-busy={feed.refreshing} disabled={feed.refreshing} className={control + ' text-slate-400 hover:text-sky-300 hover:bg-sentinel-800'} onClick={feed.refresh}><RefreshCw className={'mx-auto h-3.5 w-3.5 ' + (feed.refreshing ? 'motion-safe:animate-spin' : '')} /></button>
        </div>
      </div>
      <div className={(height || (compact ? 'h-[370px]' : 'h-[410px] sm:h-[500px]')) + ' relative w-full bg-[#0b1017]'}>
        <div ref={container} className="absolute inset-0 z-0 bg-[#0b1017]" />
        {(empty || chartError) && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-sentinel-950/95 px-5 text-center text-xs text-slate-400">
          <p role={feed.error || chartError ? 'alert' : 'status'}>{chartError || (feed.loading ? 'Loading real ' + timeframe + ' candles…' : feed.error || 'No indexed candles yet. Waiting for trades.')}</p>
          {!feed.loading && !chartError && <button type="button" className={control + ' border border-sentinel-700 text-sky-300'} disabled={feed.refreshing} aria-busy={feed.refreshing} onClick={feed.refresh}>Retry chart</button>}
        </div>}
      </div>
      {!empty && feed.error && <p role="alert" className="px-3 py-2 text-[11px] text-amber-400">{feed.error} Existing candles are retained.</p>}
      {!empty && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sentinel-800 px-3 py-1 text-[11px] text-slate-500">
        <span>{feed.candles.length < 20 ? `Limited history · ${feed.candles.length} measured ${feed.candles.length === 1 ? 'candle' : 'candles'}. Retrying full history.`
          : `${feed.market === 'pool' ? 'Pool' : 'Token-wide'} candles · UTC · no synthetic gaps`}</span>
        {feed.hasMore && <button type="button" className={control + ' text-sky-300'} disabled={feed.loadingOlder} aria-busy={feed.loadingOlder}
          onClick={feed.loadOlder}>Load older candles</button>}
        {feed.olderError && <span role="alert" className="text-amber-400">{feed.olderError}</span>}
      </div>}
    </section>
  );
}
export default CandlestickChart;
