'use client';

import React from 'react';
import Link from 'next/link';
import { Bookmark, Zap, Trash2, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { useAppActions } from '@/lib/store';
import { useWatchlist } from '@/lib/store/watchlist-store';
import type { NormalizedSearchResult } from '@/lib/token/search-service';

export function WatchlistView() {
  const { setQuickBuyOpen, setSelectedToken, setActiveView } = useAppActions();
  const { getWatchlistTokens, removeFromWatchlist } = useWatchlist();
  const watchlistTokens = getWatchlistTokens();

  const columns: Column<NormalizedSearchResult>[] = [
    {
      key: 'token',
      header: 'Token',
      accessor: (item) => (
        <div className="flex items-center gap-2.5 font-mono">
          <TokenAvatar symbol={item.symbol} name={item.name} mint={item.mint} size="sm" />
          <div className="min-w-0">
            <Link
              href={`/trade/solana/${item.mint}`}
              onClick={() => {
                setSelectedToken({
                  mint: item.mint,
                  symbol: item.symbol,
                  name: item.name,
                  priceUsd: String(item.priceUsd),
                  marketCapUsd: String(item.marketCapUsd),
                  liquidityUsd: String(item.liquidityUsd),
                  chain: 'solana',
                });
                setActiveView('trade');
              }}
              className="font-bold text-slate-100 hover:text-sky-300 flex items-center gap-1.5 transition-colors"
            >
              {item.name} <span className="text-slate-400 text-xs">${item.symbol}</span>
              <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </Link>
            <p className="text-2xs text-slate-500">Mint: {item.mint.slice(0, 6)}...{item.mint.slice(-6)}</p>
          </div>
        </div>
      ),
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
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Bookmark className="h-5 w-5 sm:h-6 sm:w-6 text-sky-400" /> Watchlist
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Your saved tokens, market activity, and risk signals.
          </p>
        </div>
      </div>

      <Panel padding="none">
        {watchlistTokens.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300">Your watchlist is currently empty.</p>
            <p className="text-slate-500">Search for any token or visit a token page to add it to your watchlist.</p>
          </div>
        ) : (
          <DataTable columns={columns} data={watchlistTokens} keyExtractor={(w) => w.id} />
        )}
      </Panel>
    </div>
  );
}
