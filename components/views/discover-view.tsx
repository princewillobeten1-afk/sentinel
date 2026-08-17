'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Compass, Search, RefreshCw, SlidersHorizontal, Flame, Sparkles, TrendingUp, BarChart3, Droplets, ArrowUpDown, LayoutGrid, Table, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useDiscoveryFeed } from '@/lib/hooks/use-discovery-feed';
import { useDebouncedValue } from '@/lib/hooks/use-debounce';
import type { DiscoverySection, TimeWindow, DiscoveryFilter } from '@/lib/discovery/types';
import { TokenDiscoveryCard } from '@/components/discovery/token-card';
import { DiscoveryTable } from '@/components/discovery/discovery-table';
import { VirtualizedMobileGrid } from '@/components/discovery/virtualized-mobile-grid';
import { DiscoveryFilters } from '@/components/discovery/discovery-filters';
import { FilterPresetBar } from '@/components/discovery/filter-preset-bar';
import { telemetry } from '@/lib/telemetry/metrics';

export type DisplayViewMode = 'grid' | 'table' | 'mobile';

export function DiscoverView() {
  const [activeSection, setActiveSection] = useState<DiscoverySection>('trending');
  const [activeWindow, setActiveWindow] = useState<TimeWindow>('15m');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<DisplayViewMode>('grid');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [rangeFilters, setRangeFilters] = useState<Partial<DiscoveryFilter>>({});

  // The <Input> below stays bound to the raw `searchQuery` so typing never
  // lags; only the value that actually drives the fetch is debounced.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  const combinedFilter: Partial<DiscoveryFilter> = useMemo(() => ({
    section: activeSection,
    timeWindow: activeWindow,
    searchQuery: debouncedSearchQuery,
    ...rangeFilters,
  }), [activeSection, activeWindow, rangeFilters, debouncedSearchQuery]);

  const { tokens, updatedAt, isLoading, error, refresh, liveConnected } = useDiscoveryFeed(activeSection, activeWindow, combinedFilter);

  useEffect(() => {
    telemetry.recordQueryLatency(15);
  }, [tokens]);

  const filteredTokens = tokens;

  const handleRefresh = () => {
    setIsRefreshing(true);
    void refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handlePresetSelect = (presetId: string, filters: Partial<DiscoveryFilter>) => {
    setActivePresetId(presetId);
    setRangeFilters(filters);
  };

  const handleClearPreset = () => {
    setActivePresetId(null);
    setRangeFilters({});
  };

  const handleFiltersChange = (filters: Partial<DiscoveryFilter>) => {
    setRangeFilters(filters);
    setActivePresetId(null); // Editing filters clears the active preset
  };

  const handleClearAllFilters = () => {
    setRangeFilters({});
    setActivePresetId(null);
  };

  const activeFilterCount = Object.keys(rangeFilters).filter(
    (k) => rangeFilters[k as keyof DiscoveryFilter] !== undefined
  ).length;

  return (
    <main className="space-y-6 max-w-7xl mx-auto px-4 py-6 font-mono" role="main" aria-label="Token Discovery Dashboard">
      {/* Header & Description */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-sentinel-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Compass className="h-6 w-6 text-sky-400" /> Token Discovery Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Sentinel continuously scores and ranks observable market activity across price momentum, volume acceleration, liquidity depth, and trade velocity to prioritize signal over volume.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="info" size="md" className="font-mono text-sky-400 border-sky-500/30">
            Chain: Solana Mainnet
          </Badge>
          <Badge variant="neutral" size="sm" className="font-mono text-slate-400 border-slate-700/50">
            {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : 'Updating...'}
          </Badge>
          {liveConnected && (
            <Badge
              variant="success"
              size="sm"
              className="font-mono text-emerald-400 border-emerald-500/30"
              title="Live updates via WebSocket — refetches instantly on relevant signals instead of waiting for the next poll."
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
              Live
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            aria-label="Refresh discovery tokens"
          >
            Refresh
          </Button>
        </div>
      </header>

      {/* Control Bar: Search, Filters, View Switcher, Time Range */}
      <section className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-sentinel-900 p-3 rounded-2xl border border-sentinel-800" aria-label="Discovery Controls">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token name, symbol, or mint address..."
              className="pl-9 text-xs font-mono bg-sentinel-950 border-sentinel-800"
              aria-label="Search tokens"
            />
          </div>
          <DiscoveryFilters
            filters={rangeFilters}
            onChange={handleFiltersChange}
            onClearAll={handleClearAllFilters}
          />
        </div>

        {/* Display Mode Switcher (Cards vs High-Density Table vs Mobile Cards) */}
        <div className="flex items-center gap-1 bg-sentinel-950 p-1 rounded-xl border border-sentinel-800 text-xs" role="radiogroup" aria-label="View Mode Switcher">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              viewMode === 'grid' ? 'bg-sky-500 text-sentinel-950' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Grid Cards View"
            role="radio"
            aria-checked={viewMode === 'grid'}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              viewMode === 'table' ? 'bg-sky-500 text-sentinel-950' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="High Density Trader Table View"
            role="radio"
            aria-checked={viewMode === 'table'}
          >
            <Table className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Trader Table</span>
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              viewMode === 'mobile' ? 'bg-sky-500 text-sentinel-950' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Mobile Cards View"
            role="radio"
            aria-checked={viewMode === 'mobile'}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Time Window Buttons */}
        <div className="flex items-center gap-1 bg-sentinel-950 p-1 rounded-xl border border-sentinel-800 text-xs">
          <span className="text-2xs text-slate-500 px-2 font-bold uppercase">Window:</span>
          {(['1m', '5m', '15m', '1h', '4h', '24h'] as TimeWindow[]).map((win) => (
            <button
              key={win}
              onClick={() => setActiveWindow(win)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                activeWindow === win
                  ? 'bg-sky-500 text-sentinel-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-label={`Time window ${win}`}
            >
              {win}
            </button>
          ))}
        </div>
      </section>

      {/* Filter Preset Bar (Section 26) */}
      <FilterPresetBar
        activePresetId={activePresetId}
        onSelectPreset={handlePresetSelect}
        onClearPreset={handleClearPreset}
      />

      {/* Active Filter Summary */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="info" size="sm" className="font-mono">
            {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
          </Badge>
          <span className="text-slate-400">•</span>
          <span className="text-slate-400">{filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''} match</span>
          {activePresetId && (
            <>
              <span className="text-slate-400">•</span>
              <Badge variant="success" size="sm" className="font-mono">Preset Active</Badge>
            </>
          )}
        </div>
      )}

      {/* Primary Discovery Section Tabs */}
      <Tabs
        activeTab={activeSection}
        onChange={(tab) => setActiveSection(tab as DiscoverySection)}
        tabs={[
          { id: 'trending', label: 'Trending', icon: <Flame className="h-3.5 w-3.5 text-amber-400" /> },
          { id: 'new', label: 'New Tokens', icon: <Sparkles className="h-3.5 w-3.5 text-sky-400" /> },
          { id: 'momentum', label: 'Early Momentum', icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> },
          { id: 'volume', label: 'Volume Surge', icon: <BarChart3 className="h-3.5 w-3.5 text-purple-400" /> },
          { id: 'liquidity', label: 'Liquidity Changes', icon: <Droplets className="h-3.5 w-3.5 text-cyan-400" /> },
          { id: 'movers', label: 'Market Movers', icon: <ArrowUpDown className="h-3.5 w-3.5 text-rose-400" /> },
        ]}
      />

      {/* Discovery Results Container */}
      <section aria-label="Token Discovery Results">
        {error ? (
          <div className="text-center py-12 border border-dashed border-sentinel-800 rounded-2xl">
            <Compass className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-300 font-bold text-sm">Live discovery feed unavailable</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-sentinel-800 rounded-2xl">
            <Compass className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-300 font-bold text-sm">No discovery signals match filters</p>
            <p className="text-xs text-slate-500 mt-1">Try expanding search query, changing time window, or adjusting filters.</p>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllFilters}
                className="mt-3"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <DiscoveryTable tokens={filteredTokens} />
        ) : viewMode === 'mobile' ? (
          <VirtualizedMobileGrid tokens={filteredTokens} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTokens.map((token) => (
              <TokenDiscoveryCard key={token.id} token={token} variant="expanded" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
