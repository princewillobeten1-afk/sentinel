'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Compass,
  Sparkles,
  Flame,
  TrendingUp,
  GraduationCap,
  Star,
  Zap,
  BarChart2,
  SlidersHorizontal,
  Layers,
  Smartphone,
  LayoutGrid,
} from 'lucide-react';
import { TerminalTopBar } from '@/components/discovery/terminal-top-bar';
import { TerminalColumn } from '@/components/discovery/terminal-column';
import { AdvancedFilterDrawer } from '@/components/discovery/advanced-filter-drawer';
import { useDebouncedValue } from '@/lib/hooks/use-debounce';
import { subscribeToDiscovery, getDiscoverySnapshot, setDiscoveryQuery } from '@/lib/discovery/discovery-store';
import { useAppActions } from '@/lib/store';
import type {
  DiscoverySection,
  DiscoveryColumnConfig,
  DiscoveryFilter,
  TimeWindow,
  DiscoveryToken,
} from '@/lib/discovery/types';

// Bumped from _v3: saved 3-column layouts would otherwise suppress the two
// new columns for anyone who has used the page before.
const STORAGE_COLUMNS_KEY = 'sentinel_discovery_columns_v4';
const STORAGE_QUICKBUY_KEY = 'sentinel_quickbuy_presets_v2';

/**
 * The five columns, each backed by a distinct real source.
 *
 * New / Bonding / Migrated all read Jupiter's `/recent` (tokens aged 0-2
 * minutes) and are partitioned by the structural bonding test in
 * `jupiter-feed.ts#isOnBondingCurve` — one request serves all three. Trending
 * and Hot read their own ranked feeds on slower cadences.
 */
const DEFAULT_COLUMNS: DiscoveryColumnConfig[] = [
  { id: 'col_new', type: 'new', title: 'New Launches', sortBy: 'newest' },
  { id: 'col_bonding', type: 'migrating', title: 'Bonding', sortBy: 'market-cap' },
  { id: 'col_migrated', type: 'graduated', title: 'Migrated', sortBy: 'market-cap' },
  { id: 'col_trending', type: 'trending', title: 'Trending', sortBy: 'volume' },
  { id: 'col_hot', type: 'hot', title: 'Hot', sortBy: 'volume' },
];

const DEFAULT_QUICKBUY_PRESETS = [0.05, 0.1, 0.5, 1.0];

export function DiscoverView() {
  const { setQuickBuyOpen } = useAppActions();

  // State: Columns
  const [columns, setColumns] = useState<DiscoveryColumnConfig[]>(DEFAULT_COLUMNS);
  const [activeMobileColumnId, setActiveMobileColumnId] = useState<string>('col_new');

  // State: Global Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChain, setSelectedChain] = useState('solana');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('15m');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [globalFilters, setGlobalFilters] = useState<Partial<DiscoveryFilter>>({});
  /** Zero-liquidity launches are hidden by default — they cannot be traded. */
  const [showZeroLiquidity, setShowZeroLiquidity] = useState(false);

  // State: Quick Buy Settings
  const [quickBuyPresets, setQuickBuyPresets] = useState<number[]>(DEFAULT_QUICKBUY_PRESETS);
  const [quickBuyMode, setQuickBuyMode] = useState<'sol' | 'usd'>('sol');

  // Debounced search query
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  // Load persisted layout & preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCols = localStorage.getItem(STORAGE_COLUMNS_KEY);
        if (savedCols) {
          const parsed = JSON.parse(savedCols);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Trending columns used to be stripped here because the section
            // had no working source. It now reads Jupiter's ranked feed, so
            // removing it would delete a column the user can see working.
            setColumns(parsed.length > 0 ? parsed : DEFAULT_COLUMNS);
          }
        }
        const savedQB = localStorage.getItem(STORAGE_QUICKBUY_KEY);
        if (savedQB) {
          const parsedQB = JSON.parse(savedQB);
          if (parsedQB.presets) setQuickBuyPresets(parsedQB.presets);
          if (parsedQB.mode) setQuickBuyMode(parsedQB.mode);
        }
      } catch (e) {
        console.warn('Failed to load discovery layout', e);
      }
    }
  }, []);

  // Save layout changes to localStorage
  const persistColumns = useCallback((newCols: DiscoveryColumnConfig[]) => {
    setColumns(newCols);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_COLUMNS_KEY, JSON.stringify(newCols));
      } catch (e) {
        console.warn('Failed to persist discovery columns', e);
      }
    }
  }, []);

  /**
   * Feed health for the header indicator.
   *
   * This used to mount a whole `useRealtimeTokenFeed` — a sixth instance with
   * its own timer, socket and `/api/v1/events` catch-up — purely to read a
   * boolean. Defaulting to `section: 'new'` is why that section was fetched
   * three times as often as the others (this call, the New column, and
   * StrictMode doubling both in dev). It now reads the shared store.
   */
  const [feedVersion, setFeedVersion] = useState(0);
  useEffect(() => subscribeToDiscovery(() => setFeedVersion((v) => v + 1)), []);
  const feedSnapshot = getDiscoverySnapshot();
  const liveConnected =
    feedSnapshot.hasLoaded &&
    Object.values(feedSnapshot.sections).some((section) => section.state === 'live');

  // Column Actions
  const handleAddColumn = (type: DiscoverySection, title: string) => {
    const newCol: DiscoveryColumnConfig = {
      id: `col_${type}_${Date.now()}`,
      type,
      title,
      sortBy: type === 'new' ? 'newest' : type === 'migrating' ? 'migration-progress' : 'volume',
    };
    persistColumns([...columns, newCol]);
  };

  const handleRemoveColumn = (id: string) => {
    if (columns.length <= 1) return; // Keep at least 1 column
    persistColumns(columns.filter((c) => c.id !== id));
  };

  const handleUpdateConfig = (id: string, updates: Partial<DiscoveryColumnConfig>) => {
    persistColumns(
      columns.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleResetLayout = () => {
    persistColumns(DEFAULT_COLUMNS);
  };

  const handleUpdateQuickBuySettings = (presets: number[], mode: 'sol' | 'usd') => {
    setQuickBuyPresets(presets);
    setQuickBuyMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_QUICKBUY_KEY, JSON.stringify({ presets, mode }));
      } catch (e) {
        console.warn('Failed to persist quick buy settings', e);
      }
    }
  };

  // Quick Buy execution handler
  const handleQuickBuy = (token: DiscoveryToken, amount: number) => {
    setQuickBuyOpen(true, {
      name: token.name,
      symbol: token.symbol,
      mint: token.mint,
      price: `$${token.priceUsd}`,
      mcap: `$${token.marketCapUsd}`,
      customAmountSol: quickBuyMode === 'sol' ? amount : undefined,
    });
  };

  // Combined global filters
  const activeCombinedGlobalFilters = useMemo(() => ({
    ...globalFilters,
    searchQuery: debouncedSearch,
    chain: selectedChain,
  }), [globalFilters, debouncedSearch, selectedChain]);

  const activeFilterCount = Object.keys(globalFilters).filter(
    (k) => globalFilters[k as keyof DiscoveryFilter] !== undefined
  ).length;

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] w-full overflow-hidden bg-[#05080d] text-xs">
      {/* Sticky Global Top Bar */}
      <TerminalTopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedChain={selectedChain}
        onChainChange={setSelectedChain}
        timeWindow={timeWindow}
        onTimeWindowChange={setTimeWindow}
        activeFilterCount={activeFilterCount}
        onOpenFilterDrawer={() => setIsFilterDrawerOpen(true)}
        columns={columns}
        showZeroLiquidity={showZeroLiquidity}
        onToggleZeroLiquidity={(next) => {
          setShowZeroLiquidity(next);
          setDiscoveryQuery({ includeZeroLiquidity: next });
        }}
        onAddColumn={handleAddColumn}
        onResetLayout={handleResetLayout}
        quickBuyPresets={quickBuyPresets}
        quickBuyMode={quickBuyMode}
        onUpdateQuickBuySettings={handleUpdateQuickBuySettings}
        liveConnected={liveConnected}
      />

      {/* Mobile Feed Tab Selector (visible only on small screens) */}
      <div className="md:hidden flex items-center gap-1.5 p-2 bg-[#090d14] border-b border-slate-800 overflow-x-auto shrink-0 scrollbar-none">
        {columns.map((col) => (
          <button
            key={col.id}
            onClick={() => setActiveMobileColumnId(col.id)}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              activeMobileColumnId === col.id
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {col.title}
          </button>
        ))}
      </div>

      {/* Main Workspace Feed Area */}
      <div className="flex-1 overflow-hidden p-2.5">
        {/* Desktop View: Multi-Column Independent Grid */}
        <div
          className="hidden md:grid h-full gap-2.5 overflow-x-auto"
          style={{
            // 290px x 5 exceeded the workspace at 1440 and pushed the fifth
            // column off-screen entirely. 252px lets all five sit side by side
            // at 1440 while staying legible; the container scrolls
            // horizontally below that, which is the behaviour these terminals
            // use anyway once a user adds columns.
            gridTemplateColumns: `repeat(${columns.length}, minmax(252px, 1fr))`,
          }}
        >
          {columns.map((col) => (
            <TerminalColumn
              key={col.id}
              config={col}
              timeWindow={timeWindow}
              globalFilters={activeCombinedGlobalFilters}
              quickBuyPresets={quickBuyPresets}
              quickBuyMode={quickBuyMode}
              onRemoveColumn={columns.length > 1 ? handleRemoveColumn : undefined}
              onUpdateConfig={handleUpdateConfig}
              onQuickBuy={handleQuickBuy}
            />
          ))}
        </div>

        {/* Mobile View: Single Column with Active Tab */}
        <div className="md:hidden h-full">
          {columns
            .filter((col) => col.id === activeMobileColumnId)
            .map((col) => (
              <TerminalColumn
                key={col.id}
                config={col}
                timeWindow={timeWindow}
                globalFilters={activeCombinedGlobalFilters}
                quickBuyPresets={quickBuyPresets}
                quickBuyMode={quickBuyMode}
                onQuickBuy={handleQuickBuy}
              />
            ))}
        </div>
      </div>

      {/* Slide-over Advanced Filter Drawer */}
      <AdvancedFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={globalFilters}
        onApplyFilters={setGlobalFilters}
        onResetFilters={() => setGlobalFilters({})}
      />
    </div>
  );
}

export default DiscoverView;

