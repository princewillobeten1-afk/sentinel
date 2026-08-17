'use client';

import React, { useState } from 'react';
import { SlidersHorizontal, X, RotateCcw, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import type { DiscoveryFilter } from '@/lib/discovery/types';

interface FilterRange {
  label: string;
  minKey: keyof DiscoveryFilter;
  maxKey: keyof DiscoveryFilter;
  unit: string;
  placeholder: [string, string];
}

const FILTER_RANGES: FilterRange[] = [
  { label: 'Market Cap', minKey: 'marketCapMin', maxKey: 'marketCapMax', unit: '$', placeholder: ['0', '∞'] },
  { label: 'Liquidity', minKey: 'liquidityMin', maxKey: 'liquidityMax', unit: '$', placeholder: ['0', '∞'] },
  { label: 'Volume (24h)', minKey: 'volumeMin', maxKey: 'volumeMax', unit: '$', placeholder: ['0', '∞'] },
  { label: 'Token Age', minKey: 'ageMinutesMin', maxKey: 'ageMinutesMax', unit: 'min', placeholder: ['0', '∞'] },
  { label: 'Price Change', minKey: 'priceChangeMin', maxKey: 'priceChangeMax', unit: '%', placeholder: ['-∞', '+∞'] },
  { label: 'Volume Change', minKey: 'volumeChangeMin', maxKey: 'volumeChangeMax', unit: '%', placeholder: ['0', '∞'] },
  { label: 'Holders', minKey: 'holdersMin', maxKey: 'holdersMax', unit: '', placeholder: ['0', '∞'] },
  { label: 'Discovery Score', minKey: 'discoveryScoreMin', maxKey: 'discoveryScoreMax', unit: '/100', placeholder: ['0', '100'] },
  { label: 'Organic Activity Score', minKey: 'organicVolumeMin', maxKey: 'organicVolume', unit: '/100', placeholder: ['70', '100'] },
];

const ADVANCED_FILTER_STUBS = [
  { label: 'Creator Reputation', description: 'Intelligence engine required' },
  { label: 'Insider Risk', description: 'Intelligence engine required' },
  { label: 'Ownership Concentration', description: 'On-chain analysis required' },
  { label: 'Organic Volume', description: 'Wash detection required' },
  { label: 'Exitability', description: 'Liquidity depth analysis required' },
  { label: 'Liquidity Lock', description: 'Contract inspection required' },
  { label: 'Contract Risk', description: 'Audit engine required' },
];

interface DiscoveryFiltersProps {
  filters: Partial<DiscoveryFilter>;
  onChange: (filters: Partial<DiscoveryFilter>) => void;
  onClearAll: () => void;
}

export function DiscoveryFilters({ filters, onChange, onClearAll }: DiscoveryFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeCount = FILTER_RANGES.reduce((count, range) => {
    const hasMin = filters[range.minKey] !== undefined;
    const hasMax = filters[range.maxKey] !== undefined;
    return count + (hasMin || hasMax ? 1 : 0);
  }, 0);

  const handleRangeChange = (key: keyof DiscoveryFilter, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    onChange({
      ...filters,
      [key]: isNaN(numValue as number) ? undefined : numValue,
    });
  };

  return (
    <div className="font-mono">
      {/* Filter Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
        className="relative"
      >
        Filters
        {activeCount > 0 && (
          <Badge variant="info" size="sm" className="ml-1.5 font-bold">
            {activeCount}
          </Badge>
        )}
        {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
      </Button>

      {/* Filter Panel */}
      {isOpen && (
        <Panel variant="default" className="mt-3 border-sky-500/20">
          <div className="space-y-4">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-sentinel-800 pb-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400" />
                Discovery Filters
              </h3>
              <div className="flex items-center gap-2">
                {activeCount > 0 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={onClearAll}
                    leftIcon={<RotateCcw className="h-3 w-3" />}
                    className="text-slate-400 hover:text-rose-400"
                  >
                    Clear All
                  </Button>
                )}
                <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Range Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {FILTER_RANGES.map((range) => {
                const minVal = filters[range.minKey];
                const maxVal = filters[range.maxKey];
                const isActive = minVal !== undefined || maxVal !== undefined;

                return (
                  <div
                    key={range.label}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isActive
                        ? 'border-sky-500/40 bg-sky-950/20'
                        : 'border-sentinel-800 bg-sentinel-950'
                    }`}
                  >
                    <label className="text-2xs text-slate-400 font-bold uppercase block mb-1.5">
                      {range.label}
                      {range.unit && <span className="text-slate-500 ml-1">({range.unit})</span>}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={minVal !== undefined ? String(minVal) : ''}
                        onChange={(e) => handleRangeChange(range.minKey, e.target.value)}
                        placeholder={range.placeholder[0]}
                        className="text-2xs h-7 bg-sentinel-900 border-sentinel-700 font-mono"
                      />
                      <span className="text-slate-500 text-2xs font-bold">—</span>
                      <Input
                        type="number"
                        value={maxVal !== undefined ? String(maxVal) : ''}
                        onChange={(e) => handleRangeChange(range.maxKey, e.target.value)}
                        placeholder={range.placeholder[1]}
                        className="text-2xs h-7 bg-sentinel-900 border-sentinel-700 font-mono"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Advanced Filters — Coming Soon (Section 25) */}
            <div className="border-t border-sentinel-800 pt-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-2xs text-slate-400 hover:text-slate-200 font-bold transition"
              >
                <Lock className="h-3 w-3" />
                Advanced Intelligence Filters
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                  {ADVANCED_FILTER_STUBS.map((stub) => (
                    <div
                      key={stub.label}
                      className="p-2 rounded-lg border border-sentinel-800 bg-sentinel-950/50 opacity-50 cursor-not-allowed"
                    >
                      <p className="text-2xs text-slate-500 font-bold uppercase flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        {stub.label}
                      </p>
                      <p className="text-2xs text-slate-600 mt-0.5">Coming Soon — {stub.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
