'use client';

import React, { useState } from 'react';
import { ActivityHeatmapDay } from '@/app/api/v1/smart-wallets/[address]/route';

interface ActivityHeatmapProps {
  data: ActivityHeatmapDay[];
  currentHour?: number;
}

export function ActivityHeatmap({ data, currentHour = 18 }: ActivityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    day: string;
    hour: number;
    count: number;
    pnl: number;
  } | null>(null);

  if (!data || data.length === 0) return null;

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour === 6) return '6a';
    if (hour === 12) return '12p';
    if (hour === 18) return '6p';
    return `${hour}`;
  };

  return (
    <div className="flex flex-col gap-1 select-none w-full max-w-[220px]">
      {/* Time header markers */}
      <div className="flex items-center text-[8px] font-mono text-slate-500 pl-3 justify-between pr-0.5 relative">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span className="text-[8px] font-mono font-bold bg-[#1f2633] text-slate-200 px-1 py-0.2 rounded border border-[#2b3548]">
          6:02 PM
        </span>
      </div>

      {/* Heatmap Grid with current-time crosshair */}
      <div className="relative flex flex-col gap-[2px]">
        {/* Subtle vertical indicator line for current time */}
        <div
          className="absolute top-0 bottom-0 w-[1px] bg-slate-300/40 pointer-events-none z-10"
          style={{ left: `calc(12px + (${currentHour} / 24) * (100% - 12px))` }}
        />

        {data.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1">
            <span className="w-2.5 text-[8px] font-mono text-slate-500 font-semibold text-center leading-none">
              {row.dayLabel}
            </span>

            <div
              className="flex-1"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
                gap: '1.5px',
              }}
            >
              {row.hours.map((cell) => {
                let bg = 'bg-[#141822]'; // Inactive hour
                if (cell.count > 0) {
                  if (cell.pnl > 0) {
                    bg = cell.count > 2 ? 'bg-[#00e599] shadow-[0_0_3px_rgba(0,229,153,0.6)]' : 'bg-[#00e599]/60';
                  } else {
                    bg = cell.count > 2 ? 'bg-[#f43f5e] shadow-[0_0_3px_rgba(244,63,94,0.6)]' : 'bg-[#f43f5e]/55';
                  }
                }

                return (
                  <div
                    key={cell.hour}
                    onMouseEnter={() =>
                      setHoveredCell({
                        day: row.dayLabel,
                        hour: cell.hour,
                        count: cell.count,
                        pnl: cell.pnl,
                      })
                    }
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`h-[7px] rounded-[1px] ${bg} hover:ring-1 hover:ring-white transition-all cursor-pointer`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Hover Info Tooltip */}
      <div className="h-3 text-[9px] font-mono text-slate-400 mt-0.5 flex items-center justify-between">
        {hoveredCell ? (
          <span className="flex items-center gap-1 truncate">
            <span className="text-slate-200 font-bold">
              {hoveredCell.day} {formatHour(hoveredCell.hour)}:
            </span>
            {hoveredCell.count > 0 ? (
              <span className={hoveredCell.pnl >= 0 ? 'text-[#00e599]' : 'text-rose-400'}>
                {hoveredCell.count} txns ({hoveredCell.pnl >= 0 ? '+' : ''}${hoveredCell.pnl})
              </span>
            ) : (
              <span className="text-slate-600">Inactive</span>
            )}
          </span>
        ) : (
          <span className="text-slate-600 text-[8px]">7D/24H Activity</span>
        )}
      </div>
    </div>
  );
}

