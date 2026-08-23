'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Flame,
  TrendingUp,
  GraduationCap,
  Star,
  Zap,
  BarChart2,
  ArrowUpDown,
  RefreshCw,
  X,
  ChevronDown,
  ArrowUp,
  AlertCircle,
} from 'lucide-react';
import { TokenDiscoveryCard } from './token-card';
import { useDiscoveryFeed } from '@/lib/hooks/use-discovery-feed';
import type {
  DiscoverySection,
  DiscoveryToken,
  DiscoveryFilter,
  TimeWindow,
  ColumnSortOption,
  DiscoveryColumnConfig,
} from '@/lib/discovery/types';

interface TerminalColumnProps {
  config: DiscoveryColumnConfig;
  timeWindow: TimeWindow;
  globalFilters?: Partial<DiscoveryFilter>;
  quickBuyPresets?: number[];
  quickBuyMode?: 'sol' | 'usd';
  onRemoveColumn?: (id: string) => void;
  onUpdateConfig?: (id: string, updates: Partial<DiscoveryColumnConfig>) => void;
  onQuickBuy?: (token: DiscoveryToken, amount: number) => void;
}

const SECTION_ICONS: Record<DiscoverySection, React.ReactNode> = {
  new: <Sparkles className="w-3.5 h-3.5 text-sky-400" />,
  trending: <Flame className="w-3.5 h-3.5 text-amber-400" />,
  migrating: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
  graduated: <GraduationCap className="w-3.5 h-3.5 text-purple-400" />,
  watchlist: <Star className="w-3.5 h-3.5 text-amber-400" />,
  'smart-money': <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />,
  'ai-picks': <Zap className="w-3.5 h-3.5 text-sky-400" />,
  'top-gainers': <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />,
  'top-losers': <ArrowUpDown className="w-3.5 h-3.5 text-rose-400" />,
  momentum: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
  volume: <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />,
  liquidity: <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />,
  movers: <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />,
  personalized: <Sparkles className="w-3.5 h-3.5 text-sky-400" />,
};

const SORT_OPTIONS: { id: ColumnSortOption; label: string }[] = [
  { id: 'newest', label: 'Newest First' },
  { id: 'volume', label: 'Volume (24h)' },
  { id: 'market-cap', label: 'Market Cap' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'price-change', label: 'Top % Gainers' },
  { id: 'tx-count', label: 'Transaction Velocity' },
  { id: 'buy-pressure', label: 'Buy Pressure Ratio' },
  { id: 'migration-progress', label: 'Bonding %' },
  { id: 'score', label: 'Sentinel Score' },
];

export function TerminalColumn({
  config,
  timeWindow,
  globalFilters,
  quickBuyPresets,
  quickBuyMode,
  onRemoveColumn,
  onUpdateConfig,
  onQuickBuy,
}: TerminalColumnProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<ColumnSortOption>(config.sortBy || 'newest');
  const [unreadNewCount, setUnreadNewCount] = useState(0);
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousTokenCountRef = useRef<number>(0);

  // Combine column filters with global filters
  const combinedFilters: Partial<DiscoveryFilter> = {
    ...globalFilters,
    ...config.filters,
    section: config.type,
    timeWindow,
  };

  const {
    tokens,
    isLoading,
    error,
    refresh,
    liveConnected,
  } = useDiscoveryFeed(config.type, timeWindow, combinedFilters);

  // Handle real-time buffer & scroll detection
  useEffect(() => {
    if (previousTokenCountRef.current > 0 && tokens.length > previousTokenCountRef.current) {
      const added = tokens.length - previousTokenCountRef.current;
      if (isScrolledDown) {
        setUnreadNewCount((prev) => prev + added);
      }
    }
    previousTokenCountRef.current = tokens.length;
  }, [tokens.length, isScrolledDown]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isDown = el.scrollTop > 120;
    setIsScrolledDown(isDown);
    if (!isDown) {
      setUnreadNewCount(0);
    }
  }, []);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      setUnreadNewCount(0);
    }
  };

  const handleSelectSort = (option: ColumnSortOption) => {
    setSortBy(option);
    setShowSortMenu(false);
    onUpdateConfig?.(config.id, { sortBy: option });
  };

  // Client-side sorting on tokens
  const sortedTokens = React.useMemo(() => {
    const list = [...tokens];
    switch (sortBy) {
      case 'volume':
        return list.sort((a, b) => parseFloat(b.volume24hUsd || '0') - parseFloat(a.volume24hUsd || '0'));
      case 'market-cap':
        return list.sort((a, b) => parseFloat(b.marketCapUsd || '0') - parseFloat(a.marketCapUsd || '0'));
      case 'liquidity':
        return list.sort((a, b) => parseFloat(b.liquidityUsd || '0') - parseFloat(a.liquidityUsd || '0'));
      case 'price-change':
        return list.sort((a, b) => (b.priceChange15m || 0) - (a.priceChange15m || 0));
      case 'tx-count':
        return list.sort((a, b) => (b.txCount1h || 0) - (a.txCount1h || 0));
      case 'buy-pressure':
        return list.sort((a, b) => (b.buyPressureRatio || 0) - (a.buyPressureRatio || 0));
      case 'migration-progress':
        return list.sort((a, b) => (b.migrationProgress || 0) - (a.migrationProgress || 0));
      case 'score':
        return list.sort((a, b) => (b.discoveryScore?.totalScore || 0) - (a.discoveryScore?.totalScore || 0));
      case 'newest':
      default:
        return list.sort((a, b) => a.ageMinutes - b.ageMinutes);
    }
  }, [tokens, sortBy]);

  return (
    <div className="flex flex-col h-full bg-[#080b10] border border-slate-800/80 rounded-xl overflow-hidden min-w-[290px] shadow-sm">
      {/* Sticky Column Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-[#0c1017] border-b border-slate-800/90 text-xs">
        {/* Title + Icon + Count */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0">
            {SECTION_ICONS[config.type] || <Sparkles className="w-3.5 h-3.5 text-sky-400" />}
          </div>
          <span className="font-bold text-slate-100 uppercase tracking-wide text-xs truncate">
            {config.title}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-2xs font-bold text-slate-400 shrink-0">
            {sortedTokens.length}
          </span>
        </div>

        {/* Column Header Controls: Sort Dropdown & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-2xs text-slate-300 font-medium transition-colors"
              title="Sort this feed"
            >
              <span>{SORT_OPTIONS.find((s) => s.id === sortBy)?.label.split(' ')[0] || 'Sort'}</span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-[#0d121a] border border-slate-700/80 rounded-lg shadow-xl py-1 z-30 text-[11px]">
                <div className="px-2 py-1 text-2xs font-bold uppercase text-slate-500 border-b border-slate-800">
                  Sort Column By
                </div>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectSort(opt.id)}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-sky-500/10 flex items-center justify-between transition-colors ${
                      sortBy === opt.id ? 'text-sky-400 font-bold bg-sky-500/5' : 'text-slate-300'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => void refresh()}
            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
            title="Refresh Column"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Remove Column Button (if removable) */}
          {onRemoveColumn && (
            <button
              onClick={() => onRemoveColumn(config.id)}
              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
              title="Remove Column"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Floating "New Tokens Arrived" Notification Pill */}
      {unreadNewCount > 0 && (
        <div className="relative z-20 flex justify-center -mb-7 pointer-events-none">
          <button
            onClick={scrollToTop}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500 text-slate-950 font-bold text-2xs shadow-lg hover:bg-sky-400 transition-all transform hover:scale-105 animate-bounce"
          >
            <ArrowUp className="w-3 h-3" />
            <span>{unreadNewCount} new tokens</span>
          </button>
        </div>
      )}

      {/* Independent Scrollable Feed Body */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
      >
        {error ? (
          /* Independent Error State */
          <div className="p-4 rounded-xl border border-dashed border-rose-900/50 bg-rose-950/20 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs font-bold text-rose-300">Feed Unavailable</p>
            <p className="text-2xs text-slate-500">{error}</p>
            <button
              onClick={() => void refresh()}
              className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 mt-2"
            >
              Retry
            </button>
          </div>
        ) : isLoading && sortedTokens.length === 0 ? (
          /* Skeletons Matching Exact Card Dimensions */
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="h-[105px] rounded-xl bg-slate-900/40 border border-slate-800/60 p-2.5 animate-pulse flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-slate-800" />
                    <div className="space-y-1">
                      <div className="w-16 h-3 bg-slate-800 rounded" />
                      <div className="w-24 h-2.5 bg-slate-800/60 rounded" />
                    </div>
                  </div>
                  <div className="w-12 h-3.5 bg-slate-800 rounded" />
                </div>
                <div className="w-full h-8 bg-slate-950/60 rounded border border-slate-800/40" />
                <div className="w-full h-4 bg-slate-900/60 rounded" />
              </div>
            ))}
          </div>
        ) : sortedTokens.length === 0 ? (
          /* Empty State */
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
            <Sparkles className="w-6 h-6 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-300">No tokens matching filters</p>
            <p className="text-2xs text-slate-500">Try loosening your filter parameters</p>
          </div>
        ) : (
          /* Dense Cards List */
          sortedTokens.map((token) => (
            <TokenDiscoveryCard
              key={token.id || token.mint}
              token={token}
              variant="compact"
              quickBuyPresets={quickBuyPresets}
              quickBuyMode={quickBuyMode}
              onQuickBuy={onQuickBuy}
            />
          ))
        )}
      </div>
    </div>
  );
}
