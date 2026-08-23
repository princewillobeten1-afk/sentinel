'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpRight, Zap, Eye, ArrowUpDown, ChevronUp, ChevronDown, SlidersHorizontal, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { useAppActions } from '@/lib/store';
import type { DiscoveryToken } from '@/lib/discovery/types';
import { Decimal } from '@/lib/math/decimal';
import { detectAnomalies, getAnomalyIcon } from '@/lib/discovery/anomaly-detector';
import { useSentinelWS } from '@/lib/hooks/use-sentinel-ws';
import { useDebouncedValue } from '@/lib/hooks/use-debounce';
import { TokenAvatar } from '@/components/ui/token-avatar';

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible: boolean;
}

export const DISCOVERY_COLUMNS: ColumnDefinition[] = [
  { id: 'token', label: 'Token', defaultVisible: true },
  { id: 'price', label: 'Price', defaultVisible: true },
  { id: 'change15m', label: '15m Change', defaultVisible: true },
  { id: 'mcap', label: 'Market Cap', defaultVisible: true },
  { id: 'liquidity', label: 'Liquidity', defaultVisible: true },
  { id: 'volume', label: '24h Volume', defaultVisible: true },
  { id: 'volChange', label: 'Vol Surge', defaultVisible: true },
  { id: 'buySell', label: 'Buy/Sell Imbalance', defaultVisible: true },
  { id: 'holders', label: 'Holders', defaultVisible: true },
  { id: 'age', label: 'Age', defaultVisible: true },
  { id: 'score', label: 'Discovery Score', defaultVisible: true },
  { id: 'actions', label: 'Trade Actions', defaultVisible: true },
];

/**
 * Fixed pixel width per column, shared between the (non-virtualized) header
 * row and the virtualized body rows so they stay aligned — virtualized rows
 * are absolutely positioned `<tr>`s, which only works if every cell's width
 * is explicit rather than left to the browser's table layout algorithm.
 */
const COLUMN_WIDTHS: Record<string, number> = {
  token: 220,
  price: 110,
  change15m: 110,
  mcap: 110,
  liquidity: 110,
  volume: 110,
  volChange: 100,
  buySell: 170,
  holders: 90,
  age: 80,
  score: 120,
  actions: 170,
};

const ROW_HEIGHT = 56;
const VIEWPORT_HEIGHT = 640;

export type SortField = 'name' | 'priceUsd' | 'priceChange15m' | 'marketCapUsd' | 'liquidityUsd' | 'volume24hUsd' | 'volumeChange15mPct' | 'buyPressureRatio' | 'holdersCount' | 'ageMinutes' | 'discoveryScore';

interface DiscoveryTableProps {
  tokens: DiscoveryToken[];
}

export function DiscoveryTable({ tokens }: DiscoveryTableProps) {
  const { setQuickBuyOpen, setSelectedToken, setActiveView } = useAppActions();
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DISCOVERY_COLUMNS.forEach((col) => {
      initial[col.id] = col.defaultVisible;
    });
    return initial;
  });

  const [showColConfig, setShowColConfig] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('discoveryScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const toggleColumn = (colId: string) => {
    setVisibleColumns((prev) => ({ ...prev, [colId]: !prev[colId] }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort tokens
  const sortedTokens = useMemo(() => [...tokens].sort((a, b) => {
    let valA: number = 0;
    let valB: number = 0;

    switch (sortField) {
      case 'priceUsd':
        valA = livePrices[a.mint] ?? parseFloat(a.priceUsd);
        valB = livePrices[b.mint] ?? parseFloat(b.priceUsd);
        break;
      case 'priceChange15m':
        valA = a.priceChange15m;
        valB = b.priceChange15m;
        break;
      case 'marketCapUsd':
        valA = parseFloat(a.marketCapUsd);
        valB = parseFloat(b.marketCapUsd);
        break;
      case 'liquidityUsd':
        valA = parseFloat(a.liquidityUsd);
        valB = parseFloat(b.liquidityUsd);
        break;
      case 'volume24hUsd':
        valA = parseFloat(a.volume24hUsd);
        valB = parseFloat(b.volume24hUsd);
        break;
      case 'volumeChange15mPct':
        valA = a.volumeChange15mPct;
        valB = b.volumeChange15mPct;
        break;
      case 'buyPressureRatio':
        valA = a.buyPressureRatio;
        valB = b.buyPressureRatio;
        break;
      case 'holdersCount':
        valA = a.holdersCount;
        valB = b.holdersCount;
        break;
      case 'ageMinutes':
        valA = a.ageMinutes;
        valB = b.ageMinutes;
        break;
      case 'discoveryScore':
      default:
        valA = a.discoveryScore.totalScore;
        valB = b.discoveryScore.totalScore;
        break;
    }

    return sortDirection === 'desc' ? valB - valA : valA - valB;
  }), [tokens, sortField, sortDirection, livePrices]);

  const rowVirtualizer = useVirtualizer({
    count: sortedTokens.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  // Dynamically subscribe to live prices for the mints actually rendered right now
  const visiblePriceTopics = useMemo(
    () => virtualRows.map((row) => sortedTokens[row.index]?.mint ? `token.price:${sortedTokens[row.index]?.mint}` : '').filter(Boolean),
    [virtualRows, sortedTokens]
  );

  useSentinelWS(visiblePriceTopics, (data) => {
    if (data?.mint && data?.priceUsd !== undefined) {
      setLivePrices((prev) => ({
        ...prev,
        [data.mint]: Number(data.priceUsd),
      }));
    }
  });

  const getSortAria = (field: SortField) => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const totalColumnsWidth = DISCOVERY_COLUMNS.reduce(
    (sum, col) => sum + (visibleColumns[col.id] ? COLUMN_WIDTHS[col.id] : 0),
    0,
  );

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Table Toolbar & Column Customizer */}
      <div className="flex items-center justify-between bg-sentinel-950 p-2.5 rounded-xl border border-sentinel-800">
        <span className="text-2xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400" />
          High-Density Trader Table ({sortedTokens.length} tokens)
        </span>

        <div className="relative">
          <Button
            variant="outline"
            size="xs"
            onClick={() => setShowColConfig(!showColConfig)}
            leftIcon={<SlidersHorizontal className="h-3 w-3" />}
          >
            Configure Columns
          </Button>

          {showColConfig && (
            <Panel
              variant="default"
              className="absolute right-0 top-8 z-50 w-56 p-3 shadow-2xl border-sky-500/30 bg-sentinel-950/95 backdrop-blur-md space-y-2"
            >
              <p className="text-2xs text-slate-400 font-bold uppercase border-b border-sentinel-800 pb-1">
                Toggle Table Columns
              </p>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {DISCOVERY_COLUMNS.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className="w-full flex items-center justify-between p-1.5 rounded text-2xs hover:bg-sentinel-800 text-left text-slate-300"
                  >
                    <span>{col.label}</span>
                    {visibleColumns[col.id] && <Check className="h-3.5 w-3.5 text-sky-400" />}
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Virtualized High-Density Table — only rows currently scrolled into
          view are ever mounted, so DOM node count stays roughly constant
          regardless of how many tokens are in `tokens`. */}
      <div
        ref={scrollRef}
        className="overflow-auto rounded-2xl border border-sentinel-800 bg-sentinel-950"
        style={{ height: VIEWPORT_HEIGHT, maxHeight: '70vh' }}
      >
        <table
          style={{ display: 'grid', width: Math.max(totalColumnsWidth, 100) }}
          className="text-left border-collapse"
          role="grid"
          aria-label="Token Discovery Table"
          aria-rowcount={sortedTokens.length}
        >
          <thead style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 10 }}>
            <tr
              style={{ display: 'flex', width: '100%' }}
              className="border-b border-sentinel-800 bg-sentinel-900/95 backdrop-blur-sm text-2xs text-slate-400 uppercase font-bold select-none"
            >
              {visibleColumns.token && (
                <th scope="col" style={{ width: COLUMN_WIDTHS.token, flexShrink: 0 }} className="p-3">
                  Token
                </th>
              )}

              {visibleColumns.price && (
                <th
                  scope="col"
                  aria-sort={getSortAria('priceUsd')}
                  style={{ width: COLUMN_WIDTHS.price, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('priceUsd')}
                >
                  <div className="flex items-center gap-1">
                    Price <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.change15m && (
                <th
                  scope="col"
                  aria-sort={getSortAria('priceChange15m')}
                  style={{ width: COLUMN_WIDTHS.change15m, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('priceChange15m')}
                >
                  <div className="flex items-center gap-1">
                    15m Change <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.mcap && (
                <th
                  scope="col"
                  aria-sort={getSortAria('marketCapUsd')}
                  style={{ width: COLUMN_WIDTHS.mcap, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('marketCapUsd')}
                >
                  <div className="flex items-center gap-1">
                    Market Cap <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.liquidity && (
                <th
                  scope="col"
                  aria-sort={getSortAria('liquidityUsd')}
                  style={{ width: COLUMN_WIDTHS.liquidity, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('liquidityUsd')}
                >
                  <div className="flex items-center gap-1">
                    Liquidity <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.volume && (
                <th
                  scope="col"
                  aria-sort={getSortAria('volume24hUsd')}
                  style={{ width: COLUMN_WIDTHS.volume, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('volume24hUsd')}
                >
                  <div className="flex items-center gap-1">
                    24h Volume <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.volChange && (
                <th
                  scope="col"
                  aria-sort={getSortAria('volumeChange15mPct')}
                  style={{ width: COLUMN_WIDTHS.volChange, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('volumeChange15mPct')}
                >
                  <div className="flex items-center gap-1">
                    Vol Surge <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.buySell && (
                <th
                  scope="col"
                  aria-sort={getSortAria('buyPressureRatio')}
                  style={{ width: COLUMN_WIDTHS.buySell, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('buyPressureRatio')}
                >
                  <div className="flex items-center gap-1">
                    Buy/Sell Ratio <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.holders && (
                <th
                  scope="col"
                  aria-sort={getSortAria('holdersCount')}
                  style={{ width: COLUMN_WIDTHS.holders, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('holdersCount')}
                >
                  <div className="flex items-center gap-1">
                    Holders <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.age && (
                <th
                  scope="col"
                  aria-sort={getSortAria('ageMinutes')}
                  style={{ width: COLUMN_WIDTHS.age, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('ageMinutes')}
                >
                  <div className="flex items-center gap-1">
                    Age <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.score && (
                <th
                  scope="col"
                  aria-sort={getSortAria('discoveryScore')}
                  style={{ width: COLUMN_WIDTHS.score, flexShrink: 0 }}
                  className="p-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('discoveryScore')}
                >
                  <div className="flex items-center gap-1">
                    Score <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}

              {visibleColumns.actions && (
                <th scope="col" style={{ width: COLUMN_WIDTHS.actions, flexShrink: 0 }} className="p-3 text-right">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody style={{ display: 'grid', height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualRows.map((virtualRow) => {
              const token = sortedTokens[virtualRow.index];
              if (!token) return null;

              const currentPrice = livePrices[token.mint] !== undefined ? livePrices[token.mint].toString() : token.priceUsd;
              const priceDec = new Decimal(currentPrice);
              const mcapDec = new Decimal(token.marketCapUsd);
              const liqDec = new Decimal(token.liquidityUsd);
              const volDec = new Decimal(token.volume24hUsd);
              const buyPct = Math.round(token.buyPressureRatio * 100);
              const isBuyDominant = buyPct >= 55;
              const isUp = token.priceChange15m >= 0;
              const anomalies = detectAnomalies(token);

              return (
                <tr
                  key={token.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    display: 'flex',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b border-sentinel-800 hover:bg-sentinel-900/60 transition-colors group focus-within:bg-sentinel-900/80"
                  tabIndex={0}
                >
                  {/* Token Identity Column */}
                  {visibleColumns.token && (
                    <td style={{ width: COLUMN_WIDTHS.token, flexShrink: 0 }} className="p-3 overflow-hidden">
                      <div className="flex items-center gap-2.5">
                        <TokenAvatar
                          src={token.logoURI}
                          symbol={token.symbol}
                          name={token.name}
                          mint={token.mint}
                          size="sm"
                          dexBadge={token.source}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/trade/solana/${token.mint}`}
                            onClick={() => {
                              setSelectedToken({
                                mint: token.mint,
                                symbol: token.symbol,
                                name: token.name,
                                logoUrl: token.logoURI,
                                priceUsd: token.priceUsd,
                                marketCapUsd: token.marketCapUsd,
                                liquidityUsd: token.liquidityUsd,
                                chain: 'solana',
                              });
                              setActiveView('trade');
                            }}
                            className="font-bold text-slate-100 hover:text-sky-400 flex items-center gap-1 truncate"
                          >
                            {token.name} <span className="text-slate-400 text-2xs">${token.symbol}</span>
                            <ArrowUpRight className="h-3 w-3 shrink-0" />
                          </Link>
                          <div className="flex items-center gap-1 text-2xs text-slate-400 truncate">
                            <span>{token.source}</span>
                            {anomalies.length > 0 && (
                              <span className="text-amber-400 font-bold ml-1">
                                {getAnomalyIcon(anomalies[0].type)} {anomalies[0].label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  )}

                  {/* Price Column */}
                  {visibleColumns.price && (
                    <td style={{ width: COLUMN_WIDTHS.price, flexShrink: 0 }} className="p-3 font-bold text-slate-100">
                      {priceDec.formatUSD(4)}
                    </td>
                  )}

                  {/* Price Change (Non-color accessible indicator: directional symbol ▲/▼ + explicit +/-) */}
                  {visibleColumns.change15m && (
                    <td style={{ width: COLUMN_WIDTHS.change15m, flexShrink: 0 }} className="p-3 font-bold">
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          isUp ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                        aria-label={`Price change 15 minutes: ${isUp ? 'Up' : 'Down'} ${Math.abs(token.priceChange15m).toFixed(1)} percent`}
                      >
                        <span aria-hidden="true">{isUp ? '▲' : '▼'}</span>
                        <span>{isUp ? '+' : ''}{token.priceChange15m.toFixed(1)}%</span>
                      </span>
                    </td>
                  )}

                  {/* Market Cap */}
                  {visibleColumns.mcap && (
                    <td style={{ width: COLUMN_WIDTHS.mcap, flexShrink: 0 }} className="p-3 text-slate-300">
                      {mcapDec.formatUSD(0)}
                    </td>
                  )}

                  {/* Liquidity */}
                  {visibleColumns.liquidity && (
                    <td style={{ width: COLUMN_WIDTHS.liquidity, flexShrink: 0 }} className="p-3 text-slate-300">
                      {liqDec.formatUSD(0)}
                    </td>
                  )}

                  {/* Volume */}
                  {visibleColumns.volume && (
                    <td style={{ width: COLUMN_WIDTHS.volume, flexShrink: 0 }} className="p-3 text-slate-300">
                      {volDec.formatUSD(0)}
                    </td>
                  )}

                  {/* Vol Surge */}
                  {visibleColumns.volChange && (
                    <td style={{ width: COLUMN_WIDTHS.volChange, flexShrink: 0 }} className="p-3 font-bold text-purple-400">
                      +{token.volumeChange15mPct}%
                    </td>
                  )}

                  {/* Buy/Sell Imbalance (Non-color indicator: Textual label + Direction icon) */}
                  {visibleColumns.buySell && (
                    <td style={{ width: COLUMN_WIDTHS.buySell, flexShrink: 0 }} className="p-3 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold ${isBuyDominant ? 'text-emerald-400' : 'text-slate-300'}`}
                          aria-label={`Buy pressure ${buyPct} percent, ${isBuyDominant ? 'Buy-side dominant' : 'Balanced'}`}
                        >
                          <span aria-hidden="true">{isBuyDominant ? '🟢' : '⚪'}</span>
                          {buyPct}% Buy
                        </span>
                        <span className="text-2xs text-slate-500">
                          ({token.buysCount}B/{token.sellsCount}S)
                        </span>
                      </div>
                    </td>
                  )}

                  {/* Holders */}
                  {visibleColumns.holders && (
                    <td style={{ width: COLUMN_WIDTHS.holders, flexShrink: 0 }} className="p-3 text-slate-400">
                      {token.holdersCount.toLocaleString()}
                    </td>
                  )}

                  {/* Age */}
                  {visibleColumns.age && (
                    <td style={{ width: COLUMN_WIDTHS.age, flexShrink: 0 }} className="p-3 text-slate-400 whitespace-nowrap">
                      {token.ageFormatted}
                    </td>
                  )}

                  {/* Discovery Score */}
                  {visibleColumns.score && (
                    <td style={{ width: COLUMN_WIDTHS.score, flexShrink: 0 }} className="p-3">
                      <Badge
                        variant={
                          token.discoveryScore.totalScore >= 80
                            ? 'success'
                            : token.discoveryScore.totalScore >= 60
                            ? 'info'
                            : 'warning'
                        }
                        size="sm"
                        className="font-bold"
                      >
                        {token.discoveryScore.totalScore}/100
                      </Badge>
                    </td>
                  )}

                  {/* Quick Trade Actions (Low-click workflow) */}
                  {visibleColumns.actions && (
                    <td style={{ width: COLUMN_WIDTHS.actions, flexShrink: 0 }} className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/trade/solana/${token.mint}`}
                          onClick={() => {
                            setSelectedToken({
                              mint: token.mint,
                              symbol: token.symbol,
                              name: token.name,
                              logoUrl: token.logoURI,
                              priceUsd: token.priceUsd,
                              marketCapUsd: token.marketCapUsd,
                              liquidityUsd: token.liquidityUsd,
                              chain: 'solana',
                            });
                            setActiveView('trade');
                          }}
                        >
                          <Button variant="outline" size="xs" aria-label={`Inspect ${token.symbol}`}>
                            <Eye className="h-3 w-3 text-sky-400" />
                          </Button>
                        </Link>
                        <Button
                          variant="buy"
                          size="xs"
                          aria-label={`Quick swap ${token.symbol}`}
                          onClick={() => setQuickBuyOpen(true, {
                            name: token.name,
                            symbol: token.symbol,
                            mint: token.mint,
                            price: priceDec.formatUSD(4),
                            mcap: mcapDec.formatUSD(0),
                          })}
                          leftIcon={<Zap className="h-3 w-3 fill-current" />}
                        >
                          Swap
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
