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
  Settings,
} from 'lucide-react';
import { ChainPillSelector } from '@/components/mobile/chain-pill-selector';
import { TerminalTopBar } from '@/components/discovery/terminal-top-bar';
import { TerminalColumn } from '@/components/discovery/terminal-column';
import { AdvancedFilterDrawer } from '@/components/discovery/advanced-filter-drawer';
import { useDebouncedValue } from '@/lib/hooks/use-debounce';
import { subscribeToDiscovery, getDiscoverySnapshot, setDiscoveryQuery, getDiscoveryHealth, pauseDiscovery, resumeDiscovery } from '@/lib/discovery/discovery-store';
import { useAppState, useAppActions } from '@/lib/store';
import { normalizeChainKey } from '@/lib/chains/chain-config';
import type {
  DiscoverySection,
  DiscoveryColumnConfig,
  DiscoveryFilter,
  TimeWindow,
  DiscoveryToken,
} from '@/lib/discovery/types';

// Bumped to _v7: canonical tabs New Pairs (newest), Final Stretch (bonding %), Migrated (recency)
const STORAGE_COLUMNS_KEY = 'sentinel_discovery_columns_v7';
const STORAGE_ROBINHOOD_COLUMNS_KEY = 'sentinel_discovery_columns_robinhood_v1';
const STORAGE_QUICKBUY_KEY = 'sentinel_quickbuy_presets_v2';
const STORAGE_QUERY_KEY = 'sentinel_discovery_query_v1';

/**
 * The canonical discovery feed columns matching Axiom & Trojan standards:
 * New Pairs (newest first), Final Stretch (bonding/launchpad/migration progress), and Migrated (newest migration first).
 * Standardized across all supported chains (Solana, Robinhood Chain).
 */
const DEFAULT_COLUMNS: DiscoveryColumnConfig[] = [
  { id: 'col_new', type: 'new', title: 'New Pairs', sortBy: 'newest' },
  { id: 'col_bonding', type: 'migrating', title: 'Final Stretch', sortBy: 'newest' },
  { id: 'col_migrated', type: 'graduated', title: 'Migrated', sortBy: 'newest' },
];

const DEFAULT_QUICKBUY_PRESETS = [0.05, 0.1, 0.5, 1.0];

export function DiscoverView() {
  const { activeChain } = useAppState();
  const { setQuickBuyOpen, setActiveChain } = useAppActions();
  const selectedChain = activeChain;
  const setSelectedChain = useCallback(
    (chain: string) => setActiveChain(normalizeChainKey(chain)),
    [setActiveChain],
  );

  // State: Columns
  const [columns, setColumns] = useState<DiscoveryColumnConfig[]>(DEFAULT_COLUMNS);
  const [activeMobileColumnId, setActiveMobileColumnId] = useState<string>('col_new');
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const selectedColumnId = columns.some((column) => column.id === activeMobileColumnId)
    ? activeMobileColumnId : columns[0]?.id;

  // State: Global Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('5m');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [globalFilters, setGlobalFilters] = useState<Partial<DiscoveryFilter>>({});
  /** Zero-liquidity launches are hidden by default — they cannot be traded. */
  const [showZeroLiquidity, setShowZeroLiquidity] = useState(false);

  // State: Quick Buy Settings
  const [quickBuyPresets, setQuickBuyPresets] = useState<number[]>(DEFAULT_QUICKBUY_PRESETS);
  const [quickBuyMode, setQuickBuyMode] = useState<'sol' | 'usd'>('sol');
  const [quickBuyEnabled, setQuickBuyEnabled] = useState<boolean>(true);

  // Debounced search query
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  // Load persisted layout & preferences whenever selectedChain changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storageKey = selectedChain === 'robinhood' ? STORAGE_ROBINHOOD_COLUMNS_KEY : STORAGE_COLUMNS_KEY;
        const savedCols = localStorage.getItem(storageKey);
        if (savedCols) {
          const parsed = JSON.parse(savedCols);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Strip trending and hot columns (they belong on the Overview page)
            const cleaned = parsed
              .filter((c: any) => c.type !== 'trending' && c.type !== 'hot')
              .map((c: any) => {
                const updated = { ...c };
                if (updated.id === 'col_bonding' || updated.type === 'bonding' || updated.type === 'final-stretch') {
                  updated.type = 'migrating';
                  updated.title = 'Final Stretch';
                }
                if (updated.id === 'col_bonding' && updated.sortBy === 'migration-progress') {
                  updated.sortBy = 'newest';
                }
                return updated as DiscoveryColumnConfig;
              });
            const nextCols = cleaned.length > 0 ? cleaned : DEFAULT_COLUMNS;
            setColumns(nextCols);
            setActiveMobileColumnId(nextCols[0].id);
          } else {
            setColumns(DEFAULT_COLUMNS);
            setActiveMobileColumnId(DEFAULT_COLUMNS[0].id);
          }
        } else {
          setColumns(DEFAULT_COLUMNS);
          setActiveMobileColumnId(DEFAULT_COLUMNS[0].id);
        }
        const savedQB = localStorage.getItem(STORAGE_QUICKBUY_KEY);
        if (savedQB) {
          const parsedQB = JSON.parse(savedQB);
          if (parsedQB.presets) setQuickBuyPresets(parsedQB.presets);
          if (parsedQB.mode) setQuickBuyMode(parsedQB.mode);
        }
        const savedQBEnabled = localStorage.getItem('sentinel_quickbuy_enabled');
        if (savedQBEnabled !== null) {
          setQuickBuyEnabled(savedQBEnabled === 'true');
        }
        const savedQuery = localStorage.getItem(STORAGE_QUERY_KEY);
        if (savedQuery) {
          const parsedQuery = JSON.parse(savedQuery);
          if (typeof parsedQuery.searchQuery === 'string') setSearchQuery(parsedQuery.searchQuery);
          if (['5m', '1h', '24h'].includes(parsedQuery.timeWindow)) setTimeWindow(parsedQuery.timeWindow);
          if (typeof parsedQuery.showZeroLiquidity === 'boolean') setShowZeroLiquidity(parsedQuery.showZeroLiquidity);
          if (parsedQuery.globalFilters && typeof parsedQuery.globalFilters === 'object') setGlobalFilters(parsedQuery.globalFilters);
        }
      } catch (e) {
        console.warn('Failed to load discovery layout', e);
      }
    }
  }, [selectedChain]);

  useEffect(() => {
    setDiscoveryQuery({ chain: selectedChain });
  }, [selectedChain]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_QUERY_KEY, JSON.stringify({
      searchQuery,
      selectedChain,
      timeWindow,
      showZeroLiquidity,
      globalFilters,
    }));
  }, [searchQuery, selectedChain, timeWindow, showZeroLiquidity, globalFilters]);

  // Save layout changes to localStorage
  const persistColumns = useCallback((newCols: DiscoveryColumnConfig[]) => {
    setColumns(newCols);
    if (typeof window !== 'undefined') {
      try {
        const storageKey = selectedChain === 'robinhood' ? STORAGE_ROBINHOOD_COLUMNS_KEY : STORAGE_COLUMNS_KEY;
        localStorage.setItem(storageKey, JSON.stringify(newCols));
      } catch (e) {
        console.warn('Failed to persist discovery columns', e);
      }
    }
  }, [selectedChain]);

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
  const feedHealth = getDiscoveryHealth();
  const freshnessAt = Math.max(...Object.values(feedSnapshot.sections).map((section) => section.at), 0);

  // Column Actions
  const handleAddColumn = (type: DiscoverySection, title: string) => {
    const newCol: DiscoveryColumnConfig = {
      id: `col_${type}_${Date.now()}`,
      type,
      title,
      sortBy: type === 'new' || type === 'migrating' || type === 'graduated' ? 'newest' : 'volume',
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

  const handleToggleQuickBuy = () => {
    setQuickBuyEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('sentinel_quickbuy_enabled', String(next));
        } catch {}
      }
      return next;
    });
  };

  const handleCycleQuickBuyPreset = () => {
    setQuickBuyPresets((prev) => {
      if (prev.length <= 1) return prev;
      const next = [...prev.slice(1), prev[0]];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_QUICKBUY_KEY, JSON.stringify({ presets: next, mode: quickBuyMode }));
        } catch {}
      }
      return next;
    });
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
      customAmountUsd: quickBuyMode === 'usd' ? amount : undefined,
      liquidity: token.liquidityUsd,
      volume24h: token.volume24hUsd,
      priceChange24h: token.priceChange24h,
      holders: token.holdersCount,
      logoURI: token.logoURI,
    });
  };

  // Combined global filters
  const activeCombinedGlobalFilters = useMemo(() => ({
    ...globalFilters,
    searchQuery: debouncedSearch,
    chain: selectedChain,
  }), [globalFilters, debouncedSearch, selectedChain]);

  const activeFilterCount = Object.values(globalFilters).filter(
    (value) => value !== undefined && value !== false && value !== '' && (!Array.isArray(value) || value.length > 0)
  ).length;

  return (
    <div className="discovery-workspace flex flex-1 min-h-0 min-w-0 flex-col w-full bg-[#06070B] text-xs">
      {/* Sticky Global Top Bar (Desktop Only) */}
      <div className="hidden md:block">
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
          quickBuyEnabled={quickBuyEnabled}
          onToggleQuickBuy={handleToggleQuickBuy}
          onCycleQuickBuyPreset={handleCycleQuickBuyPreset}
          quickBuyMode={quickBuyMode}
          onUpdateQuickBuySettings={handleUpdateQuickBuySettings}
          health={feedHealth}
          paused={feedSnapshot.paused}
          pendingRefresh={feedSnapshot.pendingRefresh}
          freshnessAt={freshnessAt}
          onTogglePause={() => (feedSnapshot.paused ? resumeDiscovery() : pauseDiscovery())}
        />
      </div>

      {/* Mobile Sub-Header & Feed Tab Selector */}
      <div className="md:hidden flex flex-col gap-2 pt-2 px-2 border-b border-[#1E222D] bg-[#06070B] shrink-0">
        {/* Chain Pill + Preset/Settings row */}
        <div className="flex items-center justify-between px-1">
          <ChainPillSelector selectedChain={selectedChain} onSelectChain={setSelectedChain} />
          <button
            type="button"
            onClick={handleCycleQuickBuyPreset}
            className="flex items-center gap-1.5 bg-[#11141B] hover:bg-[#1C202B] border border-[#222634] rounded-full px-2.5 py-1 text-xs text-[#828598] hover:text-[#F7F8F9] transition-colors"
            title="Preset 1 (Click to cycle Quick Buy amount)"
          >
            <span className="font-semibold text-[#F7F8F9] font-mono">P1</span>
            <Settings className="w-3 h-3 text-[#828598]" />
          </button>
        </div>

        {/* Axiom Segmented Pill Tabs: New Pairs | Final Stretch | Migrated */}
        <div
          role="tablist"
          aria-label="Discovery columns"
          className="bg-[#0D1015] border border-[#1E222D] rounded-full p-1 flex items-center justify-between gap-1 mb-1"
        >
          {columns.map((col) => {
            const isSelected = selectedColumnId === col.id;
            return (
              <button
                key={col.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveMobileColumnId(col.id)}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all text-center ${
                  isSelected
                    ? 'bg-[#526FFF]/20 text-[#F7F8F9] border border-[#526FFF]/40 shadow-sm'
                    : 'text-[#828598] hover:text-[#F7F8F9] border border-transparent'
                }`}
              >
                {col.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Feed Area */}
      <div className="flex-1 min-h-0 min-w-0 pt-0 md:pt-1.5 flex flex-col h-full">
        {/* Mount each feed once; hidden duplicate copies competed for the
            same visible-card enrichment and socket budget. */}
        <div
          className="discovery-columns-grid grid flex-1 h-full min-h-0 gap-0 border border-[#1E222D] rounded-[6px] overflow-hidden bg-[#0B0E14] overflow-x-auto"
          style={{ gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : `repeat(${columns.length}, minmax(310px, 1fr))` }}
        >
          {(isMobile ? columns.filter((column) => column.id === selectedColumnId) : columns).map((col) => (
            <TerminalColumn
              key={col.id}
              config={col}
              timeWindow={timeWindow}
              chain={selectedChain}
              globalFilters={activeCombinedGlobalFilters}
              quickBuyPresets={quickBuyPresets}
              quickBuyMode={quickBuyMode}
              onRemoveColumn={!isMobile && columns.length > 1 ? handleRemoveColumn : undefined}
              onUpdateConfig={handleUpdateConfig}
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
