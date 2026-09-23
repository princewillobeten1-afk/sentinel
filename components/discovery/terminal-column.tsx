'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { useLiveTokenUpdates } from '@/lib/hooks/use-live-token-updates';
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
  chain?: string;
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
  hot: <Zap className="w-3.5 h-3.5 text-rose-400" />,
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
  revived: <TrendingUp className="w-3.5 h-3.5 text-amber-400" />,
  legacy: <GraduationCap className="w-3.5 h-3.5 text-slate-400" />,
  similar: <Sparkles className="w-3.5 h-3.5 text-cyan-400" />,
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
  chain = 'solana',
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
  const [visibleMintSet, setVisibleMintSet] = useState<Set<string>>(() => new Set());

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
    state: feedState,
    paused,
    lastUpdatedAt,
  } = useDiscoveryFeed(config.type, timeWindow, combinedFilters, chain);

  /**
   * How stale this column's rows are.
   *
   * A failed fetch keeps the previous rows rather than blanking the column —
   * but they must not go on looking current. This ticks so the age advances
   * visibly instead of freezing at whatever it was when React last rendered.

   */
  // The clock is held in state rather than a counter, so the value the memo
  // reads is the one it depends on. A bare tick counter works too, but it is
  // invisible to exhaustive-deps — which then reports the dependency that makes
  // this correct as an unnecessary one.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  const staleForSec = useMemo(
    () =>
      feedState === 'stale' && lastUpdatedAt ? Math.floor((now - lastUpdatedAt) / 1000) : null,
    [feedState, lastUpdatedAt, now],
  );

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

  const handleColumnWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current && !scrollContainerRef.current.contains(e.target as Node)) {
      scrollContainerRef.current.scrollTop += e.deltaY;
    }
  }, []);

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
        return list.sort((a, b) => {
          const value = (token: DiscoveryToken) => timeWindow === '5m' ? token.volume5mUsd : timeWindow === '1h' ? token.volume1hUsd : token.volume24hUsd;
          return parseFloat(value(b) || '0') - parseFloat(value(a) || '0');
        });
      case 'market-cap':
        return list.sort((a, b) => parseFloat(b.marketCapUsd || '0') - parseFloat(a.marketCapUsd || '0'));
      case 'liquidity':
        return list.sort((a, b) => parseFloat(b.liquidityUsd || '0') - parseFloat(a.liquidityUsd || '0'));
      case 'price-change':
        return list.sort((a, b) => {
          const value = (token: DiscoveryToken) => timeWindow === '5m' ? token.priceChange5m : timeWindow === '1h' ? token.priceChange1h : token.priceChange24h;
          return (value(b) ?? 0) - (value(a) ?? 0);
        });
      case 'tx-count':
        return list.sort((a, b) => (b.txCount1h || 0) - (a.txCount1h || 0));
      case 'buy-pressure':
        return list.sort((a, b) => (b.buyPressureRatio || 0) - (a.buyPressureRatio || 0));
      case 'migration-progress':
        return list.sort((a, b) => (b.bondingCurveProgress ?? b.migrationProgress ?? 0) - (a.bondingCurveProgress ?? a.migrationProgress ?? 0));
      case 'score':
        return list.sort((a, b) => (b.discoveryScore?.totalScore || 0) - (a.discoveryScore?.totalScore || 0));
      case 'newest':
      default:
        return list.sort((a, b) => {
          if (config.type === 'graduated') {
            return (b.migratedAt ?? 0) - (a.migratedAt ?? 0);
          }
          if (config.type === 'migrating') {
            return (b.bondingCurveProgress ?? b.migrationProgress ?? 0) - (a.bondingCurveProgress ?? a.migrationProgress ?? 0);
          }
          return a.ageMinutes - b.ageMinutes;
        });
    }
  }, [tokens, sortBy, timeWindow, config.type]);

  const handleCardVisibility = useCallback((mint: string, visible: boolean) => {
    setVisibleMintSet((previous) => {
      const next = new Set(previous);
      if (visible) next.add(mint);
      else next.delete(mint);
      if (next.size === previous.size && [...next].every((value) => previous.has(value))) return previous;
      return next;
    });
  }, []);

  useEffect(() => {
    const existing = new Set(sortedTokens.map((token) => token.mint));
    setVisibleMintSet((previous) => {
      const next = new Set([...previous].filter((mint) => existing.has(mint)));
      return next.size === previous.size ? previous : next;
    });
  }, [sortedTokens]);

  /**
   * One planned subscription for the whole column.
   *
   * Each card previously opened its own, and they all shared a single socket
   * against a 30-topic session cap: 42 mounted cards asked for 84 topics and
   * the server refused 16 of them per load with `SUBSCRIPTION_LIMIT`. Cards
   * that lost the race kept rendering as if they were streaming.
   *
   * `useLiveTokenUpdates` plans the budget with `planTokenTopics` — a price
   * stream for every visible mint before any mint gets a trade stream — and
   * reports what it could not fit, so those cards can say so instead of
   * pretending.
   */
  /**
   * What an empty column actually means.
   *
   * Three different situations rendered the same "no tokens matching filters"
   * message, and only one of them was about filters. Final Stretch requires a
   * high curve completion that few tokens hold at any moment, and Migrated
   * looks back over a fixed window — both are legitimately empty much of the
   * time, and neither is fixed by loosening anything.
   */
  const emptyState = React.useMemo(() => {
    /**
     * Keys that are always present and are not filters.
     *
     * `section`, `timeWindow` and `chain` ride along in the same object as the
     * real filters, so a naive "any value is set" check reports filters active
     * on every column, forever — which is how the misleading message survived
     * the first attempt at this fix.
     */
    const NOT_A_FILTER = new Set(['section', 'timeWindow', 'chain', 'limit', 'offset']);
    const isRealFilter = ([key, value]: [string, unknown]) =>
      !NOT_A_FILTER.has(key) && value !== undefined && value !== '' && value !== false;

    const hasFilters =
      Object.entries(config.filters ?? {}).some(isRealFilter) ||
      Object.entries(globalFilters ?? {}).some(isRealFilter);

    if (hasFilters) {
      return {
        title: 'No tokens matching filters',
        detail: 'Try loosening your filter parameters',
      };
    }
    if (config.type === 'migrating') {
      return {
        title: 'Nothing near migration',
        detail: 'No token is far enough along its bonding curve yet (≥80%). Curves cross this point quickly, so this fills and empties often.',
      };
    }
    if (config.type === 'graduated') {
      return {
        title: 'No recent migrations',
        detail: 'Nothing has migrated to a pool in the last two hours.',
      };
    }
    return { title: 'Nothing here yet', detail: 'Waiting for the feed to report tokens for this column.' };
  }, [config.filters, config.type, globalFilters]);

  const liveMints = React.useMemo(() => {
    const visible = sortedTokens.filter((token) => visibleMintSet.has(token.mint)).map((token) => token.mint);
    // IntersectionObserver fires after paint. Seed the first rows so cards do
    // not spend that frame unsubscribed, then follow the real viewport.
    return visible.length > 0 ? visible : sortedTokens.slice(0, 6).map((token) => token.mint);
  }, [sortedTokens, visibleMintSet]);
  const { updates: liveUpdates, droppedMints } = useLiveTokenUpdates(liveMints, paused);
  const droppedLiveMints = React.useMemo(() => new Set(droppedMints), [droppedMints]);

  return (
    <div
      onWheel={handleColumnWheel}
      className="discovery-column flex flex-col h-full min-h-0 bg-slate-900 border border-slate-700 rounded-md overflow-hidden min-w-[290px]"
    >
      {/* Sticky Column Header */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between px-3 h-10 bg-slate-850 border-b border-slate-700 text-xs">
        {/* Title + Icon + Count */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">
            {SECTION_ICONS[config.type] || <Sparkles className="w-3.5 h-3.5 text-sky-400" />}
          </span>
          <span className="font-bold text-slate-100 uppercase tracking-wide text-xs truncate">
            {config.title}
          </span>
          <span className="px-1.5 py-px rounded-full bg-slate-800 border border-slate-700 font-numeric text-2xs text-slate-400 shrink-0">
            {sortedTokens.length}
          </span>
          {/* Says the rows are old rather than letting them pass as current. */}
          {staleForSec !== null && (
            <span
              className="px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-900/50 text-2xs font-mono text-amber-400 shrink-0 whitespace-nowrap"
              title={`This column's last successful update was ${staleForSec}s ago. Rows shown are from then.`}
            >
              {staleForSec < 60
                ? `${staleForSec}s old`
                : `${Math.floor(staleForSec / 60)}m ${staleForSec % 60}s old`}
            </span>
          )}
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
              <div className="absolute right-0 mt-1 w-44 bg-slate-850 border border-slate-700/80 rounded-lg shadow-xl py-1 z-30 text-[11px]">
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
        data-discovery-scroll
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y px-1"
      >
        {error ? (
          /* Independent Error State */
          <div className="p-4 rounded-xl border border-dashed border-rose-900/50 bg-rose-950/20 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs font-bold text-rose-300">Feed Unavailable</p>
            <p className="text-2xs text-slate-400">Token data could not be loaded. Please try again.</p>
            <button
              onClick={() => void refresh()}
              className="min-h-11 sm:min-h-8 px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 mt-2"
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
                  className="h-[164px] bg-slate-950 border-b border-slate-800/60 p-2.5 animate-pulse flex flex-col justify-between"
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
          /* Empty state, saying which case this is.
             It always blamed filters — "Try loosening your filter parameters" —
             even with no filter set, which sent a reader hunting through a
             panel of empty fields for something that was never the cause. The
             common reason is simply that nothing currently qualifies. */
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
            <Sparkles className="w-6 h-6 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-300">{emptyState.title}</p>
            <p className="text-2xs text-slate-500">{emptyState.detail}</p>
          </div>
        ) : (
          /* Dense Cards List.
             Desaturated while stale: the header badge states the age, and the
             rows themselves stop looking live. */
          <div
              className={`flex flex-col ${
              feedState === 'stale' ? 'opacity-60 saturate-50 transition-opacity' : ''
            }`}
          >
          {sortedTokens.map((token) => (
            <TokenDiscoveryCard
              key={token.id || token.mint}
              token={token}
              variant="compact"
              quickBuyPresets={quickBuyPresets}
              quickBuyMode={quickBuyMode}
              timeWindow={timeWindow}
              onQuickBuy={onQuickBuy}
              live={liveUpdates.get(token.mint)}
              liveUnavailable={droppedLiveMints.has(token.mint)}
              onVisibilityChange={handleCardVisibility}
            />
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
