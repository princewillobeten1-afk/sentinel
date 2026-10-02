'use client';

import React, { useState, useMemo, useRef } from 'react';
import { TrendingUp, Calendar, Zap, Sparkles } from 'lucide-react';
import { formatCompactUsd } from '@/lib/discovery/format';
import { EquityCurvePoint } from '@/app/api/v1/smart-wallets/[address]/route';

interface WalletPnlChartProps {
  equityCurve: EquityCurvePoint[];
  totalRealizedPnl: number;
  timeframeCurves?: {
    '1d': EquityCurvePoint[];
    '7d': EquityCurvePoint[];
    '30d': EquityCurvePoint[];
    Max: EquityCurvePoint[];
  };
  activeTimeframe?: '1d' | '7d' | '30d' | 'Max';
  onTimeframeChange?: (tf: '1d' | '7d' | '30d' | 'Max') => void;
  height?: number;
}

export function WalletPnlChart({
  equityCurve,
  totalRealizedPnl,
  timeframeCurves,
  activeTimeframe = 'Max',
  onTimeframeChange,
  height = 190,
}: WalletPnlChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Active curve based on timeframe
  const activeData = useMemo(() => {
    if (timeframeCurves && timeframeCurves[activeTimeframe]) {
      return timeframeCurves[activeTimeframe];
    }
    if (!equityCurve || equityCurve.length === 0) return [];
    if (activeTimeframe === '1d') return equityCurve.slice(-Math.min(equityCurve.length, 6));
    if (activeTimeframe === '7d') return equityCurve.slice(-Math.min(equityCurve.length, 14));
    if (activeTimeframe === '30d') return equityCurve.slice(-Math.min(equityCurve.length, 28));
    return equityCurve;
  }, [equityCurve, timeframeCurves, activeTimeframe]);

  // Compute SVG chart coordinates (stepped or bezier curve)
  const { pathD, areaD, points, zeroY, isPositiveOverall } = useMemo(() => {
    if (activeData.length < 2) {
      return { pathD: '', areaD: '', points: [], zeroY: height / 2, isPositiveOverall: true };
    }

    const values = activeData.map((d) => d.cumulativePnlUsd);
    let rawMin = Math.min(...values);
    let rawMax = Math.max(...values);
    
    // Add headroom
    const padding = (rawMax - rawMin) * 0.12 || 500;
    const min = Math.min(0, rawMin - padding);
    const max = Math.max(1000, rawMax + padding);
    const range = max - min || 1;

    const width = 600; // Virtual SVG viewBox width
    const svgHeight = height;

    const coords = activeData.map((point, index) => {
      const x = (index / (activeData.length - 1)) * width;
      const y = svgHeight - ((point.cumulativePnlUsd - min) / range) * svgHeight;
      return { x, y, point, index };
    });

    const zeroYCoord = svgHeight - ((0 - min) / range) * svgHeight;

    // Stepped line path (Axiom style discrete realized PnL steps)
    let d = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      d += ` L ${next.x},${curr.y} L ${next.x},${next.y}`;
    }

    const area = `${d} L ${coords[coords.length - 1].x},${svgHeight} L ${coords[0].x},${svgHeight} Z`;

    return {
      pathD: d,
      areaD: area,
      points: coords,
      zeroY: zeroYCoord,
      isPositiveOverall: values[values.length - 1] >= 0,
    };
  }, [activeData, height]);

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : points[points.length - 1];

  return (
    <div className="w-full flex flex-col h-full justify-between select-none">
      {/* Realized PNL Header Strip */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1b202a]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white tracking-wide">Realized PNL</span>
          <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
            NEW Edge
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button className="text-slate-500 hover:text-white p-1 transition" title="Calendar date filter">
            <Calendar className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full flex-1 min-h-[140px] pt-1">
        <svg
          viewBox={`0 0 600 ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="realizedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e599" stopOpacity="0.22" />
              <stop offset="80%" stopColor="#00e599" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#00e599" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Stepped Glow Line */}
          {areaD && <path d={areaD} fill="url(#realizedGradient)" />}

          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#00e599"
              strokeWidth="2.2"
              strokeLinecap="square"
              strokeLinejoin="miter"
              className="drop-shadow-[0_0_8px_rgba(0,229,153,0.4)]"
            />
          )}

          {/* Interactive Crosshair */}
          {activePoint && hoverIndex !== null && (
            <line
              x1={activePoint.x}
              y1="0"
              x2={activePoint.x}
              y2={height}
              stroke="#38bdf8"
              strokeWidth="1"
              strokeDasharray="2 2"
              strokeOpacity="0.8"
            />
          )}

          {/* Interactive Trade Dots */}
          {points.map((pt) => {
            const isHovered = activePoint && activePoint.index === pt.index;
            return (
              <g
                key={pt.index}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(pt.index)}
              >
                <circle cx={pt.x} cy={pt.y} r={8} fill="transparent" />
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={5}
                    fill="none"
                    stroke={pt.point.isWin ? '#00e599' : '#f43f5e'}
                    strokeWidth="2"
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 4 : 2}
                  fill={pt.point.isWin ? '#00e599' : '#f43f5e'}
                  stroke="#0b0e14"
                  strokeWidth="1"
                />
              </g>
            );
          })}
        </svg>

        {/* Minimalist Watermark Logo in bottom left */}
        <div className="absolute bottom-1 left-1 pointer-events-none flex items-center gap-1 opacity-40">
          <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
