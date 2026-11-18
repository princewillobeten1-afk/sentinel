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
  { id: 'score', label: 'Phivex Score' },
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
  const [isHovered, setIsHovered] = useState(false);
  const [frozenSnapshot, setFrozenSnapshot] = useState<DiscoveryToken[] | null>(null);
  const [renderLimit, setRenderLimit] = useState(18);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousTokenCountRef = useRef<number>(0);
  const displayTokensLengthRef = useRef<number>(0);

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
      setRenderLimit(18);
    } else if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) {
      setRenderLimit((prev) => (prev < displayTokensLengthRef.current ? prev + 16 : prev));
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
            if ((b.migratedAt ?? 0) !== (a.migratedAt ?? 0)) {
              return (b.migratedAt ?? 0) - (a.migratedAt ?? 0);
            }
            return (a.ageMinutes ?? 0) - (b.ageMinutes ?? 0);
          }
          if (config.type === 'migrating') {
            // The lifecycle feed already orders the rolling 20 by entry time.
            return 0;
          }
          return a.ageMinutes - b.ageMinutes;
        });
    }
  }, [tokens, sortBy, timeWindow, config.type]);

  useEffect(() => {
    setIsHovered(false);
    setFrozenSnapshot(null);
    setRenderLimit(18);
  }, [chain]);

  useEffect(() => {
    if (isHovered) {
      setFrozenSnapshot((prev) => prev ?? sortedTokens);
    } else {
      setFrozenSnapshot(null);
    }
  }, [isHovered, sortedTokens]);

  const { displayTokens, hoveredNewCount } = useMemo(() => {
    if (!isHovered || !frozenSnapshot) {
      return { displayTokens: sortedTokens, hoveredNewCount: 0 };
    }
    const liveByMint = new Map(sortedTokens.map((t) => [t.mint.toLowerCase(), t]));
    const frozenMints = new Set<string>();
    const merged = frozenSnapshot.map((oldToken) => {
      const key = oldToken.mint.toLowerCase();
      frozenMints.add(key);
      return liveByMint.get(key) ?? oldToken;
    });
    let unseenCount = 0;
    for (const t of sortedTokens) {
      if (!frozenMints.has(t.mint.toLowerCase())) unseenCount += 1;
    }
    return { displayTokens: merged, hoveredNewCount: unseenCount };
  }, [isHovered, frozenSnapshot, sortedTokens]);

  displayTokensLengthRef.current = displayTokens.length;

  const visibleTokens = useMemo(
    () => displayTokens.slice(0, renderLimit),
    [displayTokens, renderLimit],
  );

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
   * message, and only one of them was about filters. Lifecycle columns retain
   * the last 20 eligible entries, but can still be empty before the first
   * verified curve or migration arrives.
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
        detail: 'New Final Stretch entries stay here until they migrate, sell back below the threshold, or newer entries replace them.',
      };
    }
    if (config.type === 'graduated') {
      return {
        title: 'Waiting for confirmed migrations',
        detail: 'The latest 20 confirmed migrations remain here until newer ones replace them.',
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
      className="discovery-column flex flex-col h-full min-h-0 bg-[#0B0E14] border-0 md:border-r md:border-[#1E222D] last:md:border-r-0 rounded-none overflow-hidden min-w-0 md:min-w-[310px]"
    >
      {/* Sticky Column Header (42px Axiom Pulse header) */}
      <div className="hidden md:flex sticky top-0 z-10 shrink-0 items-center justify-between px-3 h-[42px] bg-[#10131A]/95 backdrop-blur-md border-b border-[#1E222D] text-xs">
        {/* Title + Icon + Count */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">
            {SECTION_ICONS[config.type] || <Sparkles className="w-3.5 h-3.5 text-[#526FFF]" />}
          </span>
          <span className="font-semibold text-[#F7F8F9] tracking-[-0.01em] text-[13px] truncate">
            {config.title}
          </span>
          <span className="px-1.5 py-px rounded bg-[#171B24] border border-[#222634] font-numeric text-[11px] text-[#C8C9D1] shrink-0">
            {sortedTokens.length}
          </span>
          {isHovered && (
            <span
              data-testid="column-hover-pause"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FFB224]/15 border border-[#FFB224]/30 text-[10px] font-mono font-semibold text-[#FFB224] shrink-0"
              title="Column paused while hovering"
            >
              <span>||</span>
              {hoveredNewCount > 0 && <span>+{hoveredNewCount}</span>}
            </span>
          )}
          {/* Says the rows are old rather than letting them pass as current. */}
          {staleForSec !== null && (
            <span
              className="px-1.5 py-0.5 rounded bg-[#FFB224]/12 border border-[#FFB224]/30 text-[10px] font-mono text-[#FFB224] shrink-0 whitespace-nowrap"
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
              className="flex items-center gap-1 px-2 py-1 rounded-[5px] bg-[#151821] hover:bg-[#1C202B] border border-[#222634] text-[11px] text-[#C8C9D1] font-medium transition-colors"
              title="Sort this feed"
            >
              <span>{SORT_OPTIONS.find((s) => s.id === sortBy)?.label.split(' ')[0] || 'Sort'}</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#828598]" />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-[#11141B] border border-[#222634] rounded-[8px] shadow-xl py-1 z-30 text-[11px]">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase text-[#828598] border-b border-[#1E222D]">
                  Sort Column By
                </div>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectSort(opt.id)}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-[#526FFF]/10 flex items-center justify-between transition-colors ${
                      sortBy === opt.id ? 'text-[#8EA2FF] font-semibold bg-[#526FFF]/15' : 'text-[#C8C9D1]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-[#526FFF]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => void refresh()}
            className="p-1 rounded hover:bg-[#1C202B] text-[#828598] hover:text-[#F7F8F9] transition-colors"
            title="Refresh Column"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-[#526FFF]' : ''}`} />
          </button>

          {/* Remove Column Button (if removable) */}
          {onRemoveColumn && (
            <button
              onClick={() => onRemoveColumn(config.id)}
              className="p-1 rounded hover:bg-[#1C202B] text-[#828598] hover:text-[#FF6166] transition-colors"
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
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#526FFF] text-white font-semibold text-[11px] shadow-[0_0_14px_rgba(82,111,255,0.45)] hover:bg-[#6683FF] transition-all transform hover:scale-105 animate-bounce"
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
        onMouseEnter={() => {
          setIsHovered(true);
          setFrozenSnapshot((prev) => prev ?? sortedTokens);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setFrozenSnapshot(null);
        }}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y"
      >
        {error ? (
          /* Independent Error State */
          <div className="p-4 m-3 rounded-[8px] border border-dashed border-[#EC397A]/40 bg-[#EC397A]/8 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-[#FF6166] mx-auto" />
            <p className="text-xs font-semibold text-[#FF6166]">Feed Unavailable</p>
            <p className="text-[11px] text-[#828598]">Token data could not be loaded. Please try again.</p>
            <button
              onClick={() => void refresh()}
              className="min-h-11 sm:min-h-8 px-3 py-1 rounded-[6px] bg-[#151821] hover:bg-[#1C202B] border border-[#222634] text-xs font-semibold text-[#F7F8F9] mt-2"
            >
              Retry
            </button>
          </div>
        ) : isLoading && sortedTokens.length === 0 ? (
          /* Skeletons Matching Exact Card Dimensions */
          <div>
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="h-[116px] bg-[#0B0E14] border-b border-[#181C26] px-2.5 py-2 animate-pulse flex gap-2.5"
              >
                <div className="w-[68px] h-[68px] rounded-[6px] bg-[#151821] shrink-0" />
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="w-24 h-3.5 bg-[#151821] rounded" />
                    <div className="w-20 h-3.5 bg-[#151821] rounded" />
                  </div>
                  <div className="w-2/3 h-3 bg-[#151821]/80 rounded" />
                  <div className="flex items-center justify-between">
                    <div className="w-40 h-4 bg-[#151821]/70 rounded" />
                    <div className="w-16 h-[22px] bg-[#415CF2]/20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedTokens.length === 0 ? (
          <div className="p-6 m-3 text-center border border-dashed border-[#1E222D] bg-[#090B10] rounded-[8px] space-y-2">
            <Sparkles className="w-6 h-6 text-[#525866] mx-auto" />
            <p className="text-xs font-semibold text-[#C8C9D1]">{emptyState.title}</p>
            <p className="text-[11px] text-[#828598]">{emptyState.detail}</p>
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
          {visibleTokens.map((token) => (
            <TokenDiscoveryCard
              key={token.id || token.mint}
              token={token}
              variant="compact"
              columnType={config.type}
              showBondingCurve={config.type === 'migrating'}
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
