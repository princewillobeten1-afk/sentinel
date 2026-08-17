'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Star, ShieldCheck, Activity, Users, Lock, Eye, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { CandlestickChart } from '@/components/trading/candlestick-chart';
import { TradingPanel } from '@/components/trading/trading-panel';
import { AxiomChartTabs } from '@/components/trading/axiom-chart-tabs';
import { TokenSocials } from '@/components/ui/token-socials';
import { CompactActivityIndicator } from '@/components/trade/compact-activity-indicator';
import { Decimal } from '@/lib/math/decimal';
import { fetchTokenOverview, fetchTokenSecurity } from '@/lib/actions/birdeye';
import { useBirdeyeWS } from '@/lib/hooks/use-birdeye-ws';
import type { WsResponse, WsTxsDataResponse, WsPriceDataResponse } from '@/lib/api/birdeye/ws';
import type { TokenOverview } from '@/lib/api/birdeye/stats';
import type { TokenSecurityData } from '@/lib/api/birdeye/security';

export default function DynamicTokenPage() {
  const params = useParams();
  const chain = (params?.chain as string) || 'solana';
  const tokenMint = (params?.token as string) || '7xK99zK8mP2xQ5wN3a19';

  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenOverview, setTokenOverview] = useState<TokenOverview | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);

  const { client, isReady } = useBirdeyeWS();

  React.useEffect(() => {
    fetchTokenOverview(tokenMint).then(setTokenOverview).catch(console.error);
  }, [tokenMint]);

  React.useEffect(() => {
    if (!isReady || !client) return;
    
    const txSub = {
      type: 'SUBSCRIBE_TXS' as const,
      data: { queryType: 'simple' as const, address: tokenMint, txsType: 'swap' as const }
    };
    
    const priceSub = {
      type: 'SUBSCRIBE_PRICE' as const,
      data: { queryType: 'simple' as const, address: tokenMint, currency: 'usd' as const, chartType: '1m' }
    };

    client.subscribe(txSub);
    client.subscribe(priceSub);

    const handler = (data: WsResponse) => {
      if (data.type === 'TXS_DATA') {
        const payload = data as WsTxsDataResponse;
        if (payload.data.side && payload.data.volumeUSD) {
          setRecentTrades(prev => [
            {
              id: payload.data.txHash,
              side: payload.data.side,
              amount: `${(payload.data.volumeUSD! / (payload.data.pricePair || 1)).toFixed(2)} ${tokenOverview?.symbol || 'Tokens'}`,
              valueUsd: `$${payload.data.volumeUSD!.toFixed(2)}`,
              time: 'Just now',
              tx: payload.data.txHash.substring(0, 8) + '...'
            },
            ...prev
          ].slice(0, 10));
        }
      } else if (data.type === 'PRICE_DATA') {
        const payload = data as WsPriceDataResponse;
        if (payload.data.c) setLivePrice(payload.data.c);
      }
    };
    client.addHandler(handler);

    return () => {
      client.removeHandler(handler);
      client.unsubscribe(txSub);
      client.unsubscribe(priceSub);
    };
  }, [client, isReady, tokenMint, tokenOverview?.symbol]);

  const tokenData = {
    name: tokenOverview?.name || 'Loading...',
    symbol: tokenOverview?.symbol || '...',
    mint: tokenMint,
    chain: chain.toUpperCase(),
    priceUsd: new Decimal(livePrice || tokenOverview?.price || 0),
    priceChange24h: tokenOverview?.priceChange24hPercent || 0,
    marketCapUsd: new Decimal(tokenOverview?.marketCap || 0),
    liquidityUsd: new Decimal(tokenOverview?.liquidity || 0),
    volume24hUsd: new Decimal(tokenOverview?.v24hUSD || 0),
    holders: tokenOverview?.holder || 0,
    explorerUrl: `https://solscan.io/token/${tokenMint}`,
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(tokenMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell initialView="trade">
      <div className="space-y-5 p-4 max-w-7xl mx-auto">
        {/* Token Header Bar */}
        <div className="rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-4 shadow-card flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sentinel-750 font-bold text-sky-400 text-lg border border-sentinel-600">
              {tokenData.symbol.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-100">{tokenData.name}</h1>
                <span className="text-xs font-mono text-slate-400">${tokenData.symbol}</span>
                <Badge variant="mono" size="sm" className="font-mono">{tokenData.chain}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  Mint: {tokenMint.slice(0, 6)}...{tokenMint.slice(-6)}
                  <button onClick={handleCopyAddress} className="hover:text-slate-200">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </span>
                {copied && <span className="text-emerald-400 text-2xs">Copied!</span>}
                <a href={tokenData.explorerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-sky-400">
                  <ExternalLink className="h-3.5 w-3.5" /> Explorer
                </a>
                {/* Clickable Social Media Handles */}
                <TokenSocials symbol={tokenData.symbol} showHandles={true} size="xs" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono">
            <CompactActivityIndicator />
            <Button
              variant={isWatchlisted ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIsWatchlisted(!isWatchlisted)}
              leftIcon={<Star className={`h-4 w-4 ${isWatchlisted ? 'fill-amber-400 text-amber-400' : ''}`} />}
            >
              {isWatchlisted ? 'Watchlisted' : 'Add to Watchlist'}
            </Button>
          </div>
        </div>

        {/* Market Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-900/80 p-3">
            <p className="text-2xs text-slate-400 uppercase">PRICE</p>
            <p className="text-base font-bold text-slate-100">{tokenData.priceUsd.formatUSD(4)}</p>
            <p className="text-xs font-bold text-emerald-400">+{tokenData.priceChange24h.toFixed(2)}% 24h</p>
          </div>
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-900/80 p-3">
            <p className="text-2xs text-slate-400 uppercase">MARKET CAP</p>
            <p className="text-base font-bold text-slate-100">{tokenData.marketCapUsd.formatUSD(0)}</p>
          </div>
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-900/80 p-3">
            <p className="text-2xs text-slate-400 uppercase">LIQUIDITY</p>
            <p className="text-base font-bold text-slate-100">{tokenData.liquidityUsd.formatUSD(0)}</p>
          </div>
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-900/80 p-3">
            <p className="text-2xs text-slate-400 uppercase">24H VOLUME</p>
            <p className="text-base font-bold text-slate-100">{tokenData.volume24hUsd.formatUSD(0)}</p>
          </div>
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-900/80 p-3 col-span-2 md:col-span-1">
            <p className="text-2xs text-slate-400 uppercase">HOLDERS</p>
            <p className="text-base font-bold text-slate-100">{tokenData.holders.toLocaleString()}</p>
          </div>
        </div>

        {/* Main Grid: Left Chart & Activity | Right Trading Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart & Recent Activity Column */}
          <div className="lg:col-span-2 space-y-5">
            <CandlestickChart initialTimeframe="15m" />

            {/* Axiom-Style Multi-Tab Navigation Bar (Trades, Positions, Orders, Sentinel Intelligence Audit, Holders, Top Traders, Dev Tokens) */}
            <AxiomChartTabs
              currentPrice={livePrice || tokenData.priceUsd.toNumber()}
              tokenSymbol={tokenData.symbol}
              tokenMint={tokenMint}
            />
          </div>

          {/* Right Column: Authoritative Trading Panel */}
          <div>
            <TradingPanel
              tokenSymbol={tokenData.symbol}
              tokenMint={tokenData.mint}
              tokenPriceUsd={tokenData.priceUsd.toString(18)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
