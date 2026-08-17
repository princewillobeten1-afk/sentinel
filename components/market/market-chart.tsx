'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, Radio, RefreshCw } from 'lucide-react';
import { OhlcvCandle, CandleInterval } from '@/lib/market-data/types';
import { ohlcvEngine } from '@/lib/market-data/ohlcv/ohlcv-engine';
import { realtimeMarketPublisher } from '@/lib/market-data/realtime/realtime-publisher';

interface MarketChartProps {
  marketId: string;
  symbol?: string;
  initialInterval?: CandleInterval;
}

const INTERVALS: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export function MarketChart({
  marketId,
  symbol = 'SOL',
  initialInterval = '1h',
}: MarketChartProps) {
  const [interval, setInterval] = useState<CandleInterval>(initialInterval);
  const [candles, setCandles] = useState<OhlcvCandle[]>([]);
  const [hoveredCandle, setHoveredCandle] = useState<OhlcvCandle | null>(null);

  useEffect(() => {
    // Load initial candles from REST / engine
    const data = ohlcvEngine.getCandles(marketId, interval, 60);
    setCandles(data);

    // Subscribe to realtime updates for this market
    const unsubscribe = realtimeMarketPublisher.subscribe(
      `market.price_updated:${marketId.toLowerCase()}`,
      (update) => {
        // Refresh latest candles on live tick
        const refreshed = ohlcvEngine.getCandles(marketId, interval, 60);
        setCandles(refreshed);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [marketId, interval]);

  const activeCandle = hoveredCandle || (candles.length > 0 ? candles[candles.length - 1] : null);

  // SVG Chart Calculations
  const chartHeight = 240;
  const chartWidth = 600;
  const candleCount = candles.length;

  const minPrice = candles.length > 0 ? Math.min(...candles.map((c) => c.low)) : 100;
  const maxPrice = candles.length > 0 ? Math.max(...candles.map((c) => c.high)) : 200;
  const priceRange = maxPrice - minPrice || 1;

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 40) - 20;
  };

  return (
    <div className="w-full rounded-2xl bg-sentinel-900/60 border border-white/5 p-4 space-y-4">
      {/* Chart Header & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white font-mono">
              ${symbol} / USD Chart
            </h3>
          </div>

          {activeCandle && (
            <div className="flex items-center gap-3 text-2xs font-mono text-slate-400">
              <span>O: <strong className="text-white">${activeCandle.open.toFixed(2)}</strong></span>
              <span>H: <strong className="text-emerald-400">${activeCandle.high.toFixed(2)}</strong></span>
              <span>L: <strong className="text-rose-400">${activeCandle.low.toFixed(2)}</strong></span>
              <span>C: <strong className="text-white">${activeCandle.close.toFixed(2)}</strong></span>
            </div>
          )}
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/5 font-mono">
          {INTERVALS.map((tf) => (
            <button
              key={tf}
              onClick={() => setInterval(tf)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                interval === tf
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Candlestick Canvas */}
      <div className="w-full h-[260px] bg-sentinel-950/80 rounded-xl border border-white/5 relative flex items-center justify-center overflow-hidden">
        {candles.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono">No OHLCV candle data available for this market.</p>
        ) : (
          <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            {/* Grid lines */}
            <line x1="0" y1="40" x2={chartWidth} y2="40" stroke="rgba(255,255,255,0.03)" />
            <line x1="0" y1="100" x2={chartWidth} y2="100" stroke="rgba(255,255,255,0.03)" />
            <line x1="0" y1="160" x2={chartWidth} y2="160" stroke="rgba(255,255,255,0.03)" />
            <line x1="0" y1="220" x2={chartWidth} y2="220" stroke="rgba(255,255,255,0.03)" />

            {/* Candlesticks */}
            {candles.map((c, idx) => {
              const candleWidth = Math.max(3, (chartWidth / candleCount) * 0.7);
              const x = (idx / (candleCount - 1 || 1)) * (chartWidth - 40) + 20;

              const isGreen = c.close >= c.open;
              const color = isGreen ? '#22C489' : '#EC5A5F';

              const yOpen = getY(c.open);
              const yClose = getY(c.close);
              const yHigh = getY(c.high);
              const yLow = getY(c.low);

              const bodyY = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

              return (
                <g
                  key={c.id}
                  onMouseEnter={() => setHoveredCandle(c)}
                  onMouseLeave={() => setHoveredCandle(null)}
                  className="cursor-pointer"
                >
                  {/* High / Low Wick */}
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={color}
                    strokeWidth="1.25"
                  />
                  {/* Open / Close Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyY}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                    rx="1"
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
