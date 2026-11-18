'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Zap, Trash2, ArrowUpRight, Grid2X2, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { useAppActions } from '@/lib/store';
import { useWatchlist } from '@/lib/store/watchlist-store';
import type { NormalizedSearchResult } from '@/lib/token/search-service';
import { useLiveTokenUpdates } from '@/lib/hooks/use-live-token-updates';
import { apiUrl, endpoints } from '@/lib/api/endpoints';
import { readApiData, ApiRequestError } from '@/lib/api/response';

interface WatchlistDiscoveryToken {
  mint: string;
  name: string;
  symbol: string;
  chain?: string;
  priceUsd?: string;
  priceChange24h?: number;
  marketCapUsd?: string;
  liquidityUsd?: string;
  rugRisk?: { level?: string };
}

function toWatchlistResult(token: WatchlistDiscoveryToken): NormalizedSearchResult {
  const chain = token.chain || (token.mint.startsWith('0x') ? 'robinhood' : 'solana');
  return {
    id: `watchlist_${chain}_${token.mint}`,
    mint: token.mint,
    name: token.name,
    symbol: token.symbol.replace(/^\$/, ''),
    chain,
    priceUsd: token.priceUsd ?? '—',
    priceChange24h: token.priceChange24h ?? 0,
    marketCapUsd: token.marketCapUsd ?? '—',
    liquidityUsd: token.liquidityUsd ?? '—',
    riskRating: token.rugRisk?.level === 'critical' ? 'critical' : token.rugRisk?.level === 'high' ? 'high' : token.rugRisk?.level === 'medium' ? 'med' : token.rugRisk?.level === 'low' ? 'low' : 'unknown',
  };
}

export function WatchlistView() {
  const { setQuickBuyOpen, setSelectedToken, setActiveView } = useAppActions();
  const { getWatchlistTokens, removeFromWatchlist } = useWatchlist();
  const cachedTokens = getWatchlistTokens();
  const [discoveryTokens, setDiscoveryTokens] = useState<NormalizedSearchResult[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [view, setView] = React.useState<'table' | 'grid'>('table');
  const live = useLiveTokenUpdates(discoveryTokens.map((token) => token.mint));

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/v1/discovery/watchlist', { limit: 100, timeWindow: '24h' }), { credentials: 'include' });
        const data = await readApiData<{ tokens: WatchlistDiscoveryToken[] }>(response, 'Failed to load watchlist market data');
        if (!disposed) {
          setDiscoveryTokens((data.tokens ?? []).map(toWatchlistResult));
          setFeedError(null);
        }
      } catch (error) {
        if (!disposed && !(error instanceof ApiRequestError && error.status === 401)) {
          setFeedError(error instanceof Error ? error.message : 'Watchlist market data unavailable.');
        }
      }
    };
    void load();
    return () => { disposed = true; };
  }, []);

  const watchlistTokens = (() => {
    if (discoveryTokens.length === 0) return cachedTokens;
    const seen = new Set(discoveryTokens.map((t) => t.mint.toLowerCase()));
    const missingCached = cachedTokens.filter((t) => !seen.has(t.mint.toLowerCase()));
    return [...missingCached, ...discoveryTokens];
  })();
  const liveWatchlistTokens = watchlistTokens.map((item) => {
    const update = live.updates.get(item.mint);
    if (!update) return item;
    return {
      ...item,
      priceUsd: update.priceUsd == null ? item.priceUsd : String(update.priceUsd),
      priceChange24h: update.priceChange24h ?? item.priceChange24h,
      marketCapUsd: update.marketCapUsd ?? item.marketCapUsd,
      liquidityUsd: update.liquidityUsd ?? item.liquidityUsd,
    };
  });

  const columns: Column<NormalizedSearchResult>[] = [
    {
      key: 'token',
      header: 'Token',
      accessor: (item) => {
        const itemChain = (item.chain || (item.mint.startsWith('0x') ? 'robinhood' : 'solana')).toLowerCase();
        const isRobinhood = itemChain === 'robinhood';
        return (
          <div className="flex items-center gap-2.5 font-mono">
            <TokenAvatar symbol={item.symbol} name={item.name} mint={item.mint} size="sm" />
            <div className="min-w-0">
              <Link
                href={`/trade/${itemChain}/${item.mint}`}
                onClick={() => {
                  setSelectedToken({
                    mint: item.mint,
                    symbol: item.symbol,
                    name: item.name,
                    priceUsd: String(item.priceUsd),
                    marketCapUsd: String(item.marketCapUsd),
                    liquidityUsd: String(item.liquidityUsd),
                    chain: itemChain,
                  });
                  setActiveView('trade');
                }}
                className="font-bold text-slate-100 hover:text-sky-300 flex items-center gap-1.5 transition-colors"
              >
                {item.name} <span className="text-slate-400 text-xs">${item.symbol}</span>
                <span
                  className={`rounded px-1 py-0.2 text-[9px] font-bold uppercase ${
                    isRobinhood
                      ? 'bg-lime-500/15 text-lime-300 border border-lime-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isRobinhood ? 'RH' : 'SOL'}
                </span>
                <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              </Link>
              <p className="text-2xs text-slate-500">
                {isRobinhood ? 'Contract' : 'Mint'}: {item.mint.slice(0, 6)}...{item.mint.slice(-6)}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'price',
      header: 'Price / 24h',
      isMonospace: true,
      align: 'right',
      accessor: (item) => (
        <div>
          <p className="font-bold text-white">${item.priceUsd}</p>
          <p className={`text-[11px] font-bold ${item.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {item.priceChange24h >= 0 ? '+' : ''}{item.priceChange24h.toFixed(2)}%
          </p>
        </div>
      ),
    },
    {
      key: 'mcap',
      header: 'Market Cap / Liquidity',
      isMonospace: true,
      align: 'right',
      accessor: (item) => (
        <div>
          <p className="font-bold text-slate-200">{item.marketCapUsd}</p>
          <p className="text-2xs text-slate-500">Liq {item.liquidityUsd}</p>
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'Risk Level',
      align: 'center',
      accessor: (item) => (
        <Badge variant={item.riskRating === 'unknown' ? 'neutral' : item.riskRating === 'low' ? 'risk-low' : item.riskRating === 'critical' ? 'risk-critical' : item.riskRating === 'high' ? 'risk-high' : 'risk-med'}>
          {item.riskRating}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      accessor: (item) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => setQuickBuyOpen(true, { name: item.name, symbol: item.symbol, mint: item.mint, price: item.priceUsd, mcap: item.marketCapUsd })}
            variant="buy"
            size="xs"
            leftIcon={<Zap className="h-3 w-3 fill-current" />}
          >
            Quick Trade
          </Button>
          <button
            onClick={() => removeFromWatchlist(item.mint)}
            className="p-1 text-slate-500 hover:text-rose-400 transition"
            title="Remove from Watchlist"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto select-none">
      <div data-page-header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F7F8F9] flex items-center gap-2">
            <Bookmark className="h-5 w-5 sm:h-6 sm:w-6 text-[#526FFF]" /> Watchlist
          </h1>
          <p className="text-xs text-[#828598] mt-0.5">
            Your saved tokens, market activity, and risk signals.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-[8px] border border-[#1E222D] bg-[#0D1015] p-1" aria-label="Watchlist view">
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} className={`min-h-8 min-w-8 rounded-[6px] p-1.5 transition-colors ${view === 'table' ? 'bg-[#526FFF] text-white' : 'text-[#828598] hover:text-[#F7F8F9]'}`} title="Table view"><List className="h-4 w-4" /></button>
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')} className={`min-h-8 min-w-8 rounded-[6px] p-1.5 transition-colors ${view === 'grid' ? 'bg-[#526FFF] text-white' : 'text-[#828598] hover:text-[#F7F8F9]'}`} title="Grid view"><Grid2X2 className="h-4 w-4" /></button>
        </div>
      </div>

      <Panel padding="none">
        {feedError && <p role="status" className="border-b border-[#FFB224]/30 bg-[#FFB224]/10 px-3 py-2 text-xs text-[#FFB224]">{feedError}</p>}
        {liveWatchlistTokens.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#828598] space-y-2">
            <p className="font-semibold text-[#C8C9D1]">Your watchlist is currently empty.</p>
            <p className="text-[#525866]">Search for any token or visit a token page to add it to your watchlist.</p>
          </div>
        ) : view === 'table' ? (
          <DataTable columns={columns} data={liveWatchlistTokens} keyExtractor={(w) => w.id} />
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {liveWatchlistTokens.map((item) => {
              const itemChain = (item.chain || (item.mint.startsWith('0x') ? 'robinhood' : 'solana')).toLowerCase();
              const isRobinhood = itemChain === 'robinhood';
              return (
              <article key={item.id} className="rounded-[8px] border border-[#1E222D] hover:border-[#32374A] bg-[#080A0F] p-3 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/trade/${itemChain}/${item.mint}`}
                    onClick={() => {
                      setSelectedToken({
                        mint: item.mint,
                        symbol: item.symbol,
                        name: item.name,
                        priceUsd: String(item.priceUsd),
                        marketCapUsd: String(item.marketCapUsd),
                        liquidityUsd: String(item.liquidityUsd),
                        chain: itemChain,
                      });
                      setActiveView('trade');
                    }}
                    className="flex min-w-0 items-center gap-2 hover:text-sky-300 transition-colors"
                  >
                    <TokenAvatar symbol={item.symbol} name={item.name} mint={item.mint} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-100 flex items-center gap-1.5">
                        {item.name}
                        <span
                          className={`rounded px-1 py-0.2 text-[9px] font-bold uppercase ${
                            isRobinhood
                              ? 'bg-lime-500/15 text-lime-300 border border-lime-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isRobinhood ? 'RH' : 'SOL'}
                        </span>
                      </p>
                      <p className="text-2xs text-slate-500">${item.symbol}</p>
                    </div>
                  </Link>
                  <Badge variant={item.riskRating === 'unknown' ? 'neutral' : item.riskRating === 'low' ? 'risk-low' : item.riskRating === 'critical' ? 'risk-critical' : item.riskRating === 'high' ? 'risk-high' : 'risk-med'}>{item.riskRating}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span className="text-slate-500">Price <strong className="block text-slate-200">${item.priceUsd}</strong></span><span className="text-slate-500">24h <strong className={`block ${item.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{item.priceChange24h.toFixed(2)}%</strong></span><span className="text-slate-500">Market cap <strong className="block text-slate-200">{item.marketCapUsd}</strong></span><span className="text-slate-500">Liquidity <strong className="block text-slate-200">{item.liquidityUsd}</strong></span></div>
                <div className="mt-3 flex items-center gap-2"><Button onClick={() => setQuickBuyOpen(true, { name: item.name, symbol: item.symbol, mint: item.mint, price: item.priceUsd, mcap: item.marketCapUsd })} variant="buy" size="xs" leftIcon={<Zap className="h-3 w-3 fill-current" />}>Quick Trade</Button><button onClick={() => removeFromWatchlist(item.mint)} className="p-1 text-slate-500 hover:text-rose-400" title="Remove from Watchlist"><Trash2 className="h-3.5 w-3.5" /></button></div>
              </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
