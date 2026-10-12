'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldAlert,
  Flame,
  ArrowRight,
  RefreshCw,
  Zap,
  Activity,
  Filter,
  Eye,
  Sliders,
  Network,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  washVolume: number;
  clusterEvent?: string;
  isUp: boolean;
}

interface TapeItem {
  id: string;
  time: string;
  type: 'buy' | 'sell';
  amountSol: number;
  amountUsd: number;
  wallet: string;
  tag: 'ORGANIC' | 'WASH_BOT' | 'CLUSTER_BUY' | 'WHALE' | 'SNIPER';
}

const INITIAL_CANDLES: Candle[] = [
  { time: '14:20', open: 148.2, high: 149.8, low: 147.9, close: 149.4, volume: 142000, washVolume: 22000, isUp: true },
  { time: '14:21', open: 149.4, high: 151.2, low: 149.1, close: 150.8, volume: 285000, washVolume: 45000, isUp: true },
  { time: '14:22', open: 150.8, high: 151.5, low: 149.9, close: 150.2, volume: 198000, washVolume: 88000, clusterEvent: 'Wash Trading Surge (44% Loop)', isUp: false },
  { time: '14:23', open: 150.2, high: 152.8, low: 150.1, close: 152.4, volume: 412000, washVolume: 61000, isUp: true },
  { time: '14:24', open: 152.4, high: 154.5, low: 152.0, close: 153.9, volume: 520000, washVolume: 92000, clusterEvent: 'Whale Inflow ($420K)', isUp: true },
  { time: '14:25', open: 153.9, high: 154.2, low: 151.8, close: 152.1, volume: 380000, washVolume: 145000, isUp: false },
  { time: '14:26', open: 152.1, high: 153.0, low: 150.5, close: 151.2, volume: 290000, washVolume: 120000, clusterEvent: 'Insider Split Dump', isUp: false },
  { time: '14:27', open: 151.2, high: 153.4, low: 151.0, close: 152.9, volume: 340000, washVolume: 35000, isUp: true },
  { time: '14:28', open: 152.9, high: 155.6, low: 152.6, close: 155.2, volume: 680000, washVolume: 51000, isUp: true },
  { time: '14:29', open: 155.2, high: 157.0, low: 154.8, close: 156.4, volume: 740000, washVolume: 68000, isUp: true },
  { time: '14:30', open: 156.4, high: 158.2, low: 155.9, close: 157.8, volume: 890000, washVolume: 82000, clusterEvent: 'Coordinated Cluster Buy (14 Wallets)', isUp: true },
  { time: '14:31', open: 157.8, high: 158.5, low: 156.9, close: 157.2, volume: 460000, washVolume: 79000, isUp: false },
  { time: '14:32', open: 157.2, high: 159.4, low: 157.0, close: 158.9, volume: 610000, washVolume: 55000, isUp: true },
  { time: '14:33', open: 158.9, high: 161.2, low: 158.5, close: 160.7, volume: 920000, washVolume: 94000, isUp: true },
  { time: '14:34', open: 160.7, high: 162.0, low: 159.8, close: 161.4, volume: 780000, washVolume: 71000, isUp: true },
];

const INITIAL_TAPE: TapeItem[] = [
  { id: '1', time: '14:34:42', type: 'buy', amountSol: 145.8, amountUsd: 23532, wallet: '7xKy...9vMa', tag: 'WHALE' },
  { id: '2', time: '14:34:39', type: 'buy', amountSol: 18.2, amountUsd: 2937, wallet: '3pQr...8bNz', tag: 'ORGANIC' },
  { id: '3', time: '14:34:35', type: 'buy', amountSol: 42.0, amountUsd: 6778, wallet: '9aKL...22vX', tag: 'CLUSTER_BUY' },
  { id: '4', time: '14:34:31', type: 'sell', amountSol: 12.5, amountUsd: 2017, wallet: '4cMt...5yHj', tag: 'WASH_BOT' },
  { id: '5', time: '14:34:28', type: 'buy', amountSol: 85.0, amountUsd: 13719, wallet: '8wJp...11kQ', tag: 'SNIPER' },
  { id: '6', time: '14:34:22', type: 'buy', amountSol: 34.6, amountUsd: 5584, wallet: '2zPx...4mLo', tag: 'ORGANIC' },
  { id: '7', time: '14:34:18', type: 'sell', amountSol: 60.0, amountUsd: 9684, wallet: '6tVb...7rWs', tag: 'CLUSTER_BUY' },
];

const CLUSTER_NODES = [
  { id: 'dev', label: 'Cabal Root', supplyPct: 0, x: 260, y: 35 },
  { id: 'w1', label: 'Sybil #1', supplyPct: 4.2, x: 75, y: 110 },
  { id: 'w2', label: 'Sybil #2', supplyPct: 3.8, x: 165, y: 110 },
  { id: 'w3', label: 'Sybil #3', supplyPct: 4.6, x: 260, y: 110 },
  { id: 'w4', label: 'Sybil #4', supplyPct: 3.9, x: 355, y: 110 },
  { id: 'w5', label: 'Sybil #5', supplyPct: 4.1, x: 445, y: 110 },
  { id: 'w6', label: 'Sybil #6', supplyPct: 3.5, x: 120, y: 185 },
  { id: 'w7', label: 'Sybil #7', supplyPct: 4.4, x: 215, y: 185 },
  { id: 'w8', label: 'Sybil #8', supplyPct: 3.7, x: 310, y: 185 },
  { id: 'w9', label: 'Sybil #9', supplyPct: 3.9, x: 405, y: 185 },
];

type FlowViewMode = 'chart' | 'cluster' | 'depth';

export function TerminalChartFlow() {
  const [candles, setCandles] = useState<Candle[]>(INITIAL_CANDLES);
  const [tape, setTape] = useState<TapeItem[]>(INITIAL_TAPE);
  const [activeTf, setActiveTf] = useState<'1S' | '15S' | '1M' | '5M'>('1M');
  const [viewMode, setViewMode] = useState<FlowViewMode>('chart');
  const [showClusters, setShowClusters] = useState(true);
  const [showWashFilter, setShowWashFilter] = useState(true);
  const [selectedCandle, setSelectedCandle] = useState<Candle | null>(INITIAL_CANDLES[10]);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [sellSlider, setSellSlider] = useState<number>(30000);

  // Dynamic live price
  const currentPrice = candles[candles.length - 1]?.close || 161.4;
  const prevPrice = candles[0]?.open || 148.2;
  const pctChange = (((currentPrice - prevPrice) / prevPrice) * 100).toFixed(2);
  const isPositive = Number(pctChange) >= 0;

  // Real-time ticking effect
  useEffect(() => {
    if (!isLiveActive) return;

    const interval = setInterval(() => {
      setCandles((prev) => {
        const last = prev[prev.length - 1];
        const delta = (Math.random() - 0.48) * 0.45;
        const newClose = Number(Math.max(145, last.close + delta).toFixed(2));
        const newHigh = Math.max(last.high, newClose);
        const newLow = Math.min(last.low, newClose);
        const isUp = newClose >= last.open;
        const addedVol = Math.floor(Math.random() * 25000);
        const addedWash = Math.floor(addedVol * (0.15 + Math.random() * 0.25));

        const updatedLast: Candle = {
          ...last,
          high: newHigh,
          low: newLow,
          close: newClose,
          volume: last.volume + addedVol,
          washVolume: last.washVolume + addedWash,
          isUp,
        };

        return [...prev.slice(0, -1), updatedLast];
      });

      if (Math.random() > 0.4) {
        const isBuy = Math.random() > 0.35;
        const solAmt = Number((Math.random() * 45 + 2).toFixed(1));
        const tags: TapeItem['tag'][] = ['ORGANIC', 'WASH_BOT', 'CLUSTER_BUY', 'WHALE', 'SNIPER'];
        const chosenTag = tags[Math.floor(Math.random() * tags.length)];

        const newTapeItem: TapeItem = {
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: isBuy ? 'buy' : 'sell',
          amountSol: solAmt,
          amountUsd: Math.round(solAmt * currentPrice),
          wallet: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
          tag: chosenTag,
        };

        setTape((t) => [newTapeItem, ...t.slice(0, 6)]);
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [isLiveActive, currentPrice]);

  // Scaled coordinates for SVG Chart
  const minPrice = useMemo(() => Math.min(...candles.map((c) => c.low)) - 1.5, [candles]);
  const maxPrice = useMemo(() => Math.max(...candles.map((c) => c.high)) + 1.5, [candles]);
  const maxVol = useMemo(() => Math.max(...candles.map((c) => c.volume)), [candles]);

  const chartHeight = 280;
  const chartWidth = 620;
  const candleSlotWidth = chartWidth / candles.length;
  const candleBodyWidth = candleSlotWidth * 0.65;

  const getY = (val: number) => chartHeight - ((val - minPrice) / (maxPrice - minPrice)) * (chartHeight - 40) - 20;
  const getVolHeight = (vol: number) => (vol / maxVol) * 65;

  // Slippage calculations for depth mode
  const simulatedSlippage = (Math.pow(sellSlider / 60000, 1.8) * 3.8 + 0.4).toFixed(1);

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/95 shadow-2xl backdrop-blur-xl overflow-hidden font-mono">
      {/* Top Terminal Bar: Asset Telemetry & View Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 bg-neutral-950/80 px-4 py-3 gap-3">
        {/* Token Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400 border border-accent-500/30">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white">$SENTINEL</span>
                <span className="text-2xs text-neutral-400">/ SOL</span>
                <span className="px-1.5 py-0.2 rounded bg-buy-500/10 text-buy-400 text-3xs font-semibold border border-buy-500/20">
                  RAYDIUM CLMM
                </span>
              </div>
            </div>
          </div>

          {/* Live Price Tag */}
          <div className="flex items-baseline gap-2 pl-3 border-l border-neutral-800">
            <span className="text-base font-bold text-white tracking-tight">${currentPrice.toFixed(2)}</span>
            <span className={`text-xs font-semibold flex items-center ${isPositive ? 'text-buy-400' : 'text-sell-400'}`}>
              {isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {isPositive ? `+${pctChange}%` : `${pctChange}%`}
            </span>
          </div>
        </div>

        {/* Multi-Flow View Mode Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-900 border border-neutral-800">
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-2xs font-bold transition-all ${
              viewMode === 'chart'
                ? 'bg-accent-500 text-white shadow-glow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Activity className="h-3 w-3" />
            Live Price & Vol
          </button>
          <button
            onClick={() => setViewMode('cluster')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-2xs font-bold transition-all ${
              viewMode === 'cluster'
                ? 'bg-sell-500/20 text-sell-300 border border-sell-500/40 shadow-glow-sell'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Network className="h-3 w-3" />
            Cabal Cluster Radar
          </button>
          <button
            onClick={() => setViewMode('depth')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-2xs font-bold transition-all ${
              viewMode === 'depth'
                ? 'bg-warn-500/20 text-warn-300 border border-warn-500/40 shadow-glow-amber'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sliders className="h-3 w-3" />
            Exit Depth Stress
          </button>
        </div>

        {/* Timeframe & Ticking Controls */}
        <div className="flex items-center gap-1.5">
          {(['1S', '15S', '1M', '5M'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTf(tf)}
              className={`px-2 py-1 rounded text-3xs font-bold transition-colors ${
                activeTf === tf
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
          <button
            onClick={() => setIsLiveActive(!isLiveActive)}
            title={isLiveActive ? 'Pause real-time tick' : 'Resume real-time tick'}
            className={`p-1.5 rounded transition-colors ml-1 ${
              isLiveActive ? 'text-buy-400 bg-buy-500/10 hover:bg-buy-500/20' : 'text-neutral-500 bg-neutral-800'
            }`}
          >
            <RefreshCw className={`h-3 w-3 ${isLiveActive ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
          </button>
        </div>
      </div>

      {/* Main Terminal Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800">
        
        {/* Left Viewport Display (8 Columns) */}
        <div className="lg:col-span-8 p-4 relative flex flex-col justify-between overflow-hidden">
          
          <AnimatePresence mode="wait">
            {/* VIEW MODE 1: CANDLESTICK & VOLUME FLOW */}
            {viewMode === 'chart' && (
              <motion.div
                key="chart-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {/* Sub-header Layer Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-3xs">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <Layers className="h-3 w-3 text-accent-400" /> LAYERS:
                    </span>
                    <button
                      onClick={() => setShowClusters(!showClusters)}
                      className={`px-2 py-0.5 rounded-full border transition-all ${
                        showClusters ? 'bg-sell-500/20 text-sell-300 border-sell-500/40' : 'bg-neutral-850 text-neutral-500 border-neutral-800'
                      }`}
                    >
                      ● Cluster Alerts
                    </button>
                    <button
                      onClick={() => setShowWashFilter(!showWashFilter)}
                      className={`px-2 py-0.5 rounded-full border transition-all ${
                        showWashFilter ? 'bg-warn-500/20 text-warn-300 border-warn-500/40' : 'bg-neutral-850 text-neutral-500 border-neutral-800'
                      }`}
                    >
                      ● Wash Vol Decomposition
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-neutral-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-buy-400 animate-ping" />
                    <span>Slot: 284,910,219</span>
                  </div>
                </div>

                {/* SVG Candlestick Canvas */}
                <div className="relative w-full h-[280px] bg-neutral-950/70 rounded-xl border border-neutral-800 p-2 overflow-hidden select-none">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 grid grid-rows-5 grid-cols-6 pointer-events-none opacity-20">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div key={i} className="border-b border-r border-neutral-700/40" />
                    ))}
                  </div>

                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    {candles.map((c, i) => {
                      const x = i * candleSlotWidth + candleSlotWidth / 2;
                      const candleX = x - candleBodyWidth / 2;
                      const openY = getY(c.open);
                      const closeY = getY(c.close);
                      const highY = getY(c.high);
                      const lowY = getY(c.low);
                      const bodyY = Math.min(openY, closeY);
                      const bodyH = Math.max(2, Math.abs(closeY - openY));

                      const color = c.isUp ? '#12B574' : '#EC5A5F';
                      const totalVolH = getVolHeight(c.volume);
                      const washVolH = getVolHeight(c.washVolume);
                      const realVolH = Math.max(0, totalVolH - washVolH);

                      const isSelected = selectedCandle?.time === c.time;

                      return (
                        <g
                          key={c.time + i}
                          onClick={() => setSelectedCandle(c)}
                          className="cursor-pointer group"
                        >
                          <rect
                            x={x - candleSlotWidth / 2}
                            y={0}
                            width={candleSlotWidth}
                            height={chartHeight}
                            fill={isSelected ? 'rgba(59, 143, 240, 0.12)' : 'transparent'}
                            className="group-hover:fill-accent-500/10 transition-colors"
                          />

                          {/* Real Volume Bar */}
                          <rect
                            x={candleX}
                            y={chartHeight - realVolH}
                            width={candleBodyWidth}
                            height={realVolH}
                            fill={showWashFilter ? (c.isUp ? '#12B574' : '#EC5A5F') : '#383838'}
                            opacity={0.4}
                          />

                          {/* Wash Bot Volume (Amber) */}
                          {showWashFilter && c.washVolume > 0 && (
                            <rect
                              x={candleX}
                              y={chartHeight - totalVolH}
                              width={candleBodyWidth}
                              height={washVolH}
                              fill="#FFB800"
                              opacity={0.7}
                            />
                          )}

                          {/* Wick */}
                          <line
                            x1={x}
                            y1={highY}
                            x2={x}
                            y2={lowY}
                            stroke={color}
                            strokeWidth={1.5}
                          />

                          {/* Body */}
                          <rect
                            x={candleX}
                            y={bodyY}
                            width={candleBodyWidth}
                            height={bodyH}
                            fill={color}
                            rx={1}
                          />

                          {/* Cluster Marker */}
                          {showClusters && c.clusterEvent && (
                            <g transform={`translate(${x - 6}, ${highY - 16})`}>
                              <circle cx={6} cy={6} r={5} fill="#EC5A5F" />
                              <text x={6} y={9} fontSize={7} fill="#FFFFFF" textAnchor="middle" fontWeight="bold">
                                !
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    <line
                      x1={0}
                      y1={getY(currentPrice)}
                      x2={chartWidth}
                      y2={getY(currentPrice)}
                      stroke="#5A9FF3"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      opacity={0.8}
                    />
                  </svg>

                  <div
                    className="absolute right-1 px-1.5 py-0.5 rounded bg-accent-500 text-white text-3xs font-bold shadow-glow"
                    style={{ top: `${Math.max(10, Math.min(240, getY(currentPrice) - 8))}px` }}
                  >
                    ${currentPrice.toFixed(2)}
                  </div>
                </div>

                {/* Selected Bar Telemetry */}
                <div className="p-2.5 rounded-lg bg-neutral-850/80 border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-2xs">
                  {selectedCandle ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white flex items-center gap-1">
                          <Activity className="h-3 w-3 text-accent-400" />
                          {selectedCandle.time}:
                        </span>
                        <span className="text-neutral-400">O: <strong className="text-neutral-200">${selectedCandle.open}</strong></span>
                        <span className="text-neutral-400">H: <strong className="text-neutral-200">${selectedCandle.high}</strong></span>
                        <span className="text-neutral-400">L: <strong className="text-neutral-200">${selectedCandle.low}</strong></span>
                        <span className="text-neutral-400">C: <strong className={selectedCandle.isUp ? 'text-buy-400' : 'text-sell-400'}>${selectedCandle.close}</strong></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-400">Total: <strong className="text-neutral-200">${(selectedCandle.volume / 1000).toFixed(0)}K</strong></span>
                        <span className="text-warn-400">Wash: <strong className="text-warn-300">${(selectedCandle.washVolume / 1000).toFixed(0)}K</strong></span>
                        {selectedCandle.clusterEvent && (
                          <span className="px-1.5 py-0.2 rounded bg-sell-500/20 text-sell-300 font-bold border border-sell-500/30 text-3xs">
                            ⚠ {selectedCandle.clusterEvent}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-neutral-500 text-3xs">Click any candle to inspect forensic telemetry</span>
                  )}
                </div>
              </motion.div>
            )}

            {/* VIEW MODE 2: CABAL CLUSTER RADAR */}
            {viewMode === 'cluster' && (
              <motion.div
                key="cluster-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-sell-400 font-bold flex items-center gap-1.5">
                    <AlertOctagon className="h-3.5 w-3.5" />
                    CO-FUNDED SYBIL CLUSTER DETECTED (36.7% SUPPLY)
                  </span>
                  <span className="text-neutral-500 text-3xs">Common Progenitor: Kraken Hot #4</span>
                </div>

                <div className="relative h-[280px] w-full bg-neutral-950/70 rounded-xl border border-neutral-800 p-2 overflow-hidden">
                  <svg viewBox="0 0 520 250" className="w-full h-full">
                    {CLUSTER_NODES.slice(1).map((node) => (
                      <line
                        key={node.id}
                        x1={CLUSTER_NODES[0].x}
                        y1={CLUSTER_NODES[0].y}
                        x2={node.x}
                        y2={node.y}
                        stroke="#EC5A5F"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        opacity={0.65}
                      />
                    ))}

                    <g transform={`translate(${CLUSTER_NODES[0].x}, ${CLUSTER_NODES[0].y})`}>
                      <circle cx={0} cy={0} r={16} fill="#EC5A5F" opacity={0.25} />
                      <circle cx={0} cy={0} r={10} fill="#EC5A5F" />
                      <text x={0} y={3} fontSize={8} fill="#FFFFFF" textAnchor="middle" fontWeight="bold">
                        ROOT
                      </text>
                      <text x={0} y={-14} fontSize={8} fill="#F87171" textAnchor="middle">
                        Kraken Deposit (42m ago)
                      </text>
                    </g>

                    {CLUSTER_NODES.slice(1).map((node) => (
                      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                        <circle cx={0} cy={0} r={11} fill="#7F1D1D" stroke="#EC5A5F" strokeWidth={1} />
                        <text x={0} y={3} fontSize={7} fill="#FFFFFF" textAnchor="middle" fontWeight="bold">
                          {node.supplyPct}%
                        </text>
                        <text x={0} y={16} fontSize={7} fill="#A3A3A3" textAnchor="middle">
                          {node.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="p-2.5 rounded-lg bg-sell-500/10 border border-sell-500/30 text-2xs text-sell-300 flex items-center justify-between">
                  <span>9 wallets funded in the same 22-minute block window control 36.7% circulating tokens.</span>
                  <span className="font-bold text-white px-2 py-0.5 rounded bg-sell-500/40">RISK: CRITICAL</span>
                </div>
              </motion.div>
            )}

            {/* VIEW MODE 3: EXIT DEPTH STRESS TEST */}
            {viewMode === 'depth' && (
              <motion.div
                key="depth-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-warn-400 font-bold flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5" />
                    SIMULATE MARKET SELL ORDER SIZE
                  </span>
                  <span className="text-white font-bold text-sm bg-neutral-850 px-2.5 py-0.5 rounded border border-neutral-750">
                    ${sellSlider.toLocaleString()} USD
                  </span>
                </div>

                <input
                  type="range"
                  min={1000}
                  max={100000}
                  step={1000}
                  value={sellSlider}
                  onChange={(e) => setSellSlider(Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-neutral-750 appearance-none cursor-pointer accent-accent-500"
                />

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                    <span className="text-3xs text-neutral-400 uppercase">Naive AMM Slippage</span>
                    <p className="text-lg font-bold text-sell-400">-{simulatedSlippage}%</p>
                    <p className="text-3xs text-neutral-500">Single route price collapse</p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-950/80 border border-buy-500/30 space-y-1 shadow-glow-buy">
                    <span className="text-3xs text-buy-400 uppercase font-bold">Sentinel Multi-Pool Route</span>
                    <p className="text-lg font-bold text-buy-400">-{(Number(simulatedSlippage) * 0.35).toFixed(1)}%</p>
                    <p className="text-3xs text-buy-300">Fragmented Raydium + Meteora</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-850 border border-neutral-800 text-2xs text-neutral-300 flex items-center justify-between">
                  <span>Net Capital Preserved via Sentinel Route Fragmentation:</span>
                  <span className="font-bold text-buy-400">+${Math.round(sellSlider * (Number(simulatedSlippage) * 0.0065)).toLocaleString()} USD</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Order Tape & Live Stream (4 Columns) */}
        <div className="lg:col-span-4 p-4 flex flex-col justify-between bg-neutral-950/50">
          <div>
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-neutral-800">
              <div className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-warn-400 animate-pulse" />
                <span className="text-xs font-bold text-white tracking-wide">LIVE SOLANA BLOCK TAPE</span>
              </div>
              <span className="text-3xs px-1.5 py-0.2 rounded bg-buy-500/10 text-buy-400 border border-buy-500/20">
                18ms FEED
              </span>
            </div>

            <div className="space-y-1.5 overflow-hidden">
              <AnimatePresence initial={false}>
                {tape.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-neutral-850/80 border border-neutral-800 text-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${t.type === 'buy' ? 'bg-buy-500' : 'bg-sell-500'}`} />
                      <span className={`font-bold ${t.type === 'buy' ? 'text-buy-400' : 'text-sell-400'}`}>
                        {t.type.toUpperCase()}
                      </span>
                      <span className="text-white font-medium">{t.amountSol} SOL</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-3xs text-neutral-500">{t.wallet}</span>
                      {t.tag === 'WHALE' && (
                        <span className="px-1.5 py-0.2 rounded bg-accent-500/20 text-accent-300 font-bold text-3xs border border-accent-500/30">
                          WHALE
                        </span>
                      )}
                      {t.tag === 'WASH_BOT' && (
                        <span className="px-1.5 py-0.2 rounded bg-warn-500/20 text-warn-300 font-bold text-3xs border border-warn-500/30">
                          WASH
                        </span>
                      )}
                      {t.tag === 'CLUSTER_BUY' && (
                        <span className="px-1.5 py-0.2 rounded bg-sell-500/20 text-sell-300 font-bold text-3xs border border-sell-500/30">
                          CABAL
                        </span>
                      )}
                      {t.tag === 'ORGANIC' && (
                        <span className="px-1.5 py-0.2 rounded bg-buy-500/20 text-buy-300 font-bold text-3xs border border-buy-500/30">
                          ORGANIC
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* SINGLE ACTION LINK TO DISCOVER SCREENER */}
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <Link
              href="/discover"
              className="flex items-center justify-between w-full p-2.5 rounded-lg bg-buy-500/10 hover:bg-buy-500/20 border border-buy-500/30 text-buy-300 hover:text-white transition-all group font-bold text-xs"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-buy-400 group-hover:scale-110 transition-transform" />
                <span>Explore Full Screener in Discover</span>
              </div>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
