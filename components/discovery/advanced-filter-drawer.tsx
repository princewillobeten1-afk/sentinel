'use client';

import React, { useState } from 'react';
import {
  X,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Bookmark,
  Sparkles,
  Shield,
  DollarSign,
  Activity,
  Users,
  Clock,
  Zap,
} from 'lucide-react';
import type { DiscoveryFilter } from '@/lib/discovery/types';

interface AdvancedFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Partial<DiscoveryFilter>;
  onApplyFilters: (filters: Partial<DiscoveryFilter>) => void;
  onResetFilters: () => void;
}

interface SavedPreset {
  id: string;
  name: string;
  filters: Partial<DiscoveryFilter>;
}

const DEFAULT_PRESETS: SavedPreset[] = [
  {
    id: 'early-gems',
    name: 'Early Gems (<30m, >$20K Liq)',
    filters: {
      ageMinutesMax: 30,
      liquidityMin: 20000,
      marketCapMax: 1000000,
      top10HoldingsMax: 35,
      devHoldingsMax: 5,
    },
  },
  {
    id: 'safe-high-liq',
    name: 'Safe & Verified (Score > 85, Renounced)',
    filters: {
      minRiskScore: 85,
      mintRenouncedOnly: true,
      liquidityLockedOnly: true,
      liquidityMin: 50000,
    },
  },
  {
    id: 'momentum-runners',
    name: 'Momentum Runners (Vol > $100K)',
    filters: {
      volumeMin: 100000,
      priceChangeMin: 20,
      top10HoldingsMax: 40,
    },
  },
];

export function AdvancedFilterDrawer({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
}: AdvancedFilterDrawerProps) {
  const [localFilters, setLocalFilters] = useState<Partial<DiscoveryFilter>>(filters);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(DEFAULT_PRESETS);

  if (!isOpen) return null;

  const handleChange = (key: keyof DiscoveryFilter, val: any) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: val === '' || val === undefined ? undefined : val,
    }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({});
    onResetFilters();
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setLocalFilters(preset.filters);
  };

  const handleSaveCurrentPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    const newPreset: SavedPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      filters: { ...localFilters },
    };
    setSavedPresets((prev) => [...prev, newPreset]);
    setPresetName('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Advanced Discovery Filters" onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-over Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-[#0a0e15] border-l border-slate-800 shadow-2xl flex flex-col z-10 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d121b] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-sky-400" />
            <h2 className="font-bold text-slate-100 text-sm">Advanced Discovery Filters</h2>
          </div>
          <button
            onClick={onClose}
            autoFocus
            aria-label="Close discovery filters"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Filters Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Quick Presets Section */}
          <div className="space-y-2">
            <span className="text-2xs font-bold uppercase text-slate-400 flex items-center gap-1">
              <Bookmark className="w-3 h-3 text-amber-400" /> Saved Filter Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {savedPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleLoadPreset(p)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-2xs font-medium text-slate-300 transition-colors text-left"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* 1. Market Metrics (MC, Liq, Vol) */}
          <div className="space-y-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-2xs font-bold uppercase text-sky-400 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Market & Financials
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-2xs text-slate-500 block">Min Market Cap ($)</span>
                <input
                  type="number"
                  value={localFilters.marketCapMin ?? ''}
                  onChange={(e) => handleChange('marketCapMin', parseFloat(e.target.value))}
                  placeholder="e.g. 50000"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Max Market Cap ($)</span>
                <input
                  type="number"
                  value={localFilters.marketCapMax ?? ''}
                  onChange={(e) => handleChange('marketCapMax', parseFloat(e.target.value))}
                  placeholder="e.g. 5000000"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Min Liquidity ($)</span>
                <input
                  type="number"
                  value={localFilters.liquidityMin ?? ''}
                  onChange={(e) => handleChange('liquidityMin', parseFloat(e.target.value))}
                  placeholder="e.g. 10000"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Min 24h Volume ($)</span>
                <input
                  type="number"
                  value={localFilters.volumeMin ?? ''}
                  onChange={(e) => handleChange('volumeMin', parseFloat(e.target.value))}
                  placeholder="e.g. 25000"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. Activity & Momentum (Price Change, Age) */}
          <div className="space-y-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-2xs font-bold uppercase text-emerald-400 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Momentum & Recency
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-2xs text-slate-500 block">Max Age (Minutes)</span>
                <input
                  type="number"
                  value={localFilters.ageMinutesMax ?? ''}
                  onChange={(e) => handleChange('ageMinutesMax', parseFloat(e.target.value))}
                  placeholder="e.g. 60"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Min 15m Price Change (%)</span>
                <input
                  type="number"
                  value={localFilters.priceChangeMin ?? ''}
                  onChange={(e) => handleChange('priceChangeMin', parseFloat(e.target.value))}
                  placeholder="e.g. 15"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Distribution & Safety (Top 10, Dev %, Risk) */}
          <div className="space-y-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-2xs font-bold uppercase text-amber-400 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Distribution & Safety
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-2xs text-slate-500 block">Max Top 10 Holdings (%)</span>
                <input
                  type="number"
                  value={localFilters.top10HoldingsMax ?? ''}
                  onChange={(e) => handleChange('top10HoldingsMax', parseFloat(e.target.value))}
                  placeholder="e.g. 30"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Max Dev Holdings (%)</span>
                <input
                  type="number"
                  value={localFilters.devHoldingsMax ?? ''}
                  onChange={(e) => handleChange('devHoldingsMax', parseFloat(e.target.value))}
                  placeholder="e.g. 5"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Max Snipers (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={localFilters.snipersMax ?? ''}
                  onChange={(e) => handleChange('snipersMax', parseFloat(e.target.value))}
                  placeholder="e.g. 10"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Max Insiders (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={localFilters.insidersMax ?? ''}
                  onChange={(e) => handleChange('insidersMax', parseFloat(e.target.value))}
                  placeholder="e.g. 10"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Max Bundlers (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={localFilters.bundlersMax ?? ''}
                  onChange={(e) => handleChange('bundlersMax', parseFloat(e.target.value))}
                  placeholder="e.g. 10"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Min Safety Score (0-100)</span>
                <input
                  type="number"
                  value={localFilters.minRiskScore ?? ''}
                  onChange={(e) => handleChange('minRiskScore', parseFloat(e.target.value))}
                  placeholder="e.g. 80"
                  className="w-full h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
                />
              </div>
              <div className="flex flex-col justify-end gap-1.5 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={localFilters.mintRenouncedOnly ?? false}
                    onChange={(e) => handleChange('mintRenouncedOnly', e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500"
                  />
                  <span className="text-2xs">Mint Renounced</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={localFilters.liquidityLockedOnly ?? false}
                    onChange={(e) => handleChange('liquidityLockedOnly', e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500"
                  />
                  <span className="text-2xs">LP Locked</span>
                </label>
              </div>
            </div>
          </div>

          {/* 4. Save Custom Preset */}
          <form onSubmit={handleSaveCurrentPreset} className="space-y-1.5 pt-1">
            <span className="text-2xs font-bold text-slate-400 block uppercase">
              Save Current Settings as Preset
            </span>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset Name (e.g. My Sniper Filter)"
                className="flex-1 h-7 px-2 rounded bg-slate-900 border border-slate-800 text-slate-100 text-xs"
              />
              <button
                type="submit"
                className="h-7 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
              >
                Save
              </button>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-3 bg-[#0d121b] border-t border-slate-800">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 text-xs transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
