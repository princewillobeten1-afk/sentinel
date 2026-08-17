'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FILTER_PRESETS } from '@/lib/discovery/filter-presets';
import type { DiscoveryFilter } from '@/lib/discovery/types';

interface FilterPresetBarProps {
  activePresetId: string | null;
  onSelectPreset: (presetId: string, filters: Partial<DiscoveryFilter>) => void;
  onClearPreset: () => void;
}

export function FilterPresetBar({ activePresetId, onSelectPreset, onClearPreset }: FilterPresetBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-sentinel-700 font-mono">
      <span className="text-2xs text-slate-500 font-bold uppercase whitespace-nowrap shrink-0">
        Presets:
      </span>
      {FILTER_PRESETS.map((preset) => {
        const isActive = activePresetId === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => {
              if (isActive) {
                onClearPreset();
              } else {
                onSelectPreset(preset.id, preset.filters);
              }
            }}
            title={preset.description}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-2xs font-bold whitespace-nowrap transition-all border ${
              isActive
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.15)]'
                : 'bg-sentinel-900 border-sentinel-700 text-slate-400 hover:border-sentinel-600 hover:text-slate-200'
            }`}
          >
            <span>{preset.icon}</span>
            <span>{preset.name}</span>
            {isActive && (
              <Badge variant="info" size="sm" className="ml-0.5">Active</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
