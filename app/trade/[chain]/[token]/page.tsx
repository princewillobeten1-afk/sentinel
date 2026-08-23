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
import { TokenAvatar } from '@/components/ui/token-avatar';
import { Decimal } from '@/lib/math/decimal';
import { formatPercent } from '@/lib/discovery/format';
import { useSentinelWS } from '@/lib/hooks/use-sentinel-ws';
import type { TokenOverview } from '@/lib/api/birdeye/stats';

export default function DynamicTokenPage() {
  const params = useParams();
  const chain = (params?.chain as string) || 'solana';
  // No invalid fallback. `/trade` redirects here with a real mint, so an empty
  // param now means a genuinely malformed URL and should read as one rather
  // than silently substituting a 20-character string that is not a Solana
  // address and can never resolve.
  const tokenMint = (params?.token as string) || '';

  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenOverview, setTokenOverview] = useState<TokenOverview | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    if (!tokenMint) {
      setOverviewError('No token specified in the URL.');
      setIsOverviewLoading(false);
      return;
    }
    setIsOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch(`/api/v1/tokens/${chain}/${tokenMint}`);
      if (!res.ok) {
        throw new Error(`Failed to load token: ${res.statusText}`);
      }
      const json = await res.json();
      const token = json.data?.token || json.token || json;
      if (token) {
        setTokenOverview({
          address: token.mint || tokenMint,
          decimals: token.decimals || 9,
          symbol: token.symbol || tokenMint.slice(0, 4).toUpperCase(),
          name: token.name || `Token ${tokenMint.slice(0, 4)}`,
          marketCap: Number(token.marketCapUsd) || 0,
          fdv: Number(token.marketCapUsd) || 0,
          totalSupply: Number(token.totalSupply) || 1000000000,
          circulatingSupply: Number(token.circulatingSupply) || 1000000000,
          logoURI: token.logoUrl || token.logoURI || '',
          liquidity: Number(token.liquidityUsd) || 0,
          lastTradeUnixTime: Date.now(),
          lastTradeHumanTime: 'Just now',
          price: Number(token.priceUsd) || 0,
          holder: token.holderCount || 0,
          numberMarkets: 1,
          priceChange24hPercent: Number(token.priceChange24h) || 0,
          v24hUSD: Number(token.volume24hUsd) || 0,
        });
      } else {
        setOverviewError('Market data provider returned no data for this token.');
      }
    } catch (err) {
      setOverviewError(
        err instanceof Error ? err.message : 'Market data provider is unavailable.',
      );
    } finally {
      setIsOverviewLoading(false);
    }
  }, [tokenMint, chain]);

  React.useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // Real-time market streaming via internal Node.js WebSocket gateway
  const wsTopics = React.useMemo(
    () => (tokenMint ? [`token.price:${tokenMint}`, `token.trade:${tokenMint}`] : []),
    [tokenMint]
  );

  useSentinelWS(wsTopics, (data, msg) => {
    if (msg.topic === `token.price:${tokenMint}`) {
      if (data?.priceUsd !== undefined) {
        setLivePrice(Number(data.priceUsd));
      }
    } else if (msg.topic === `token.trade:${tokenMint}`) {
      const volUsd = data.priceUsd && data.amount ? Number(data.priceUsd) * Number(data.amount) : undefined;
      setRecentTrades((prev) => [
        {
          id: data.signature || `tx_${Date.now()}_${Math.random()}`,
          side: data.side ? data.side.toLowerCase() : 'buy',
          amount: `${data.amount ? Number(data.amount).toFixed(2) : '1.00'} ${tokenOverview?.symbol || 'Tokens'}`,
          valueUsd: volUsd ? `$${volUsd.toFixed(2)}` : data.priceUsd ? `$${Number(data.priceUsd).toFixed(2)}` : '$0.00',
          time: 'Just now',
          tx: data.signature ? `${data.signature.slice(0, 8)}...` : 'tx...',
        },
        ...prev,
      ].slice(0, 10));
    }
  });

  const tokenData = {
    // Falls back to the mint rather than 'Loading...'/'...'. Those strings were
    // shown indefinitely on failure, and worse, propagated into the trading
    // panel as the literal buy/sell token ("BUY ...") and into the quote request.
    name: tokenOverview?.name || (isOverviewLoading ? 'Loading…' : `${tokenMint.slice(0, 4)}…${tokenMint.slice(-4)}`),
    symbol: tokenOverview?.symbol || (isOverviewLoading ? '' : tokenMint.slice(0, 4).toUpperCase()),
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
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/*
          Token header.

          Identity and statistics sit directly on the page ground, grouped by
          alignment and a single hairline rather than in bordered tiles —
          borders are boundaries, not decoration (lib/design/system.md rule 1).
          The price is the one primary-tier element on this screen.
        */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <TokenAvatar
              src={tokenOverview?.logoURI}
              symbol={tokenData.symbol}
              name={tokenData.name}
              mint={tokenMint}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <h1 className="text-xl font-bold text-slate-100 truncate">{tokenData.name}</h1>
                <span className="text-sm font-numeric text-slate-400 shrink-0">${tokenData.symbol}</span>
                <span className="label-micro shrink-0">{tokenData.chain}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1 font-numeric">
                  {tokenMint.slice(0, 6)}…{tokenMint.slice(-6)}
                  <button
                    onClick={handleCopyAddress}
                    aria-label="Copy mint address"
                    className="hover:text-slate-200 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {copied && <span className="text-emerald-400">Copied</span>}
                </span>
                <a
                  href={tokenData.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-sky-400 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Explorer
                </a>
                <TokenSocials symbol={tokenData.symbol} showHandles={false} size="xs" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <CompactActivityIndicator />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsWatchlisted(!isWatchlisted)}
              leftIcon={<Star className={`h-4 w-4 ${isWatchlisted ? 'fill-amber-400 text-amber-400' : ''}`} />}
            >
              {isWatchlisted ? 'Watchlisted' : 'Watchlist'}
            </Button>
          </div>
        </header>

        {/* Provider failure is stated, not hidden behind zeros. */}
        {overviewError && !isOverviewLoading && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-amber-300">Market data unavailable</h4>
              <p className="text-2xs text-slate-300 mt-0.5 break-words">{overviewError}</p>
              <p className="text-2xs text-slate-500 mt-1">
                Figures below are unavailable rather than zero.
              </p>
            </div>
            <Button variant="outline" size="xs" onClick={() => void loadOverview()}>
              Retry
            </Button>
          </div>
        )}

        {/* Statistics. One aligned row, no tiles. */}
        <section className="flex flex-wrap items-end gap-x-8 gap-y-4 border-t border-sentinel-800/80 pt-4">
          <div>
            <p className="label-micro">Price</p>
            <p className="text-3xl font-bold text-slate-100 font-numeric leading-tight">
              {tokenData.priceUsd.formatUSD(4)}
            </p>
            <p
              className={`text-xs font-semibold font-numeric ${
                tokenData.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatPercent(tokenData.priceChange24h)} 24h
            </p>
          </div>

          {[
            { label: 'Market Cap', value: tokenData.marketCapUsd.formatUSD(0) },
            { label: 'Liquidity', value: tokenData.liquidityUsd.formatUSD(0) },
            { label: '24h Volume', value: tokenData.volume24hUsd.formatUSD(0) },
            { label: 'Holders', value: tokenData.holders.toLocaleString() },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="label-micro">{stat.label}</p>
              <p className="text-base font-semibold text-slate-200 font-numeric">{stat.value}</p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CandlestickChart initialTimeframe="15m" symbol={tokenMint} chain={chain} />
            <AxiomChartTabs
              currentPrice={livePrice || tokenData.priceUsd.toNumber()}
              tokenSymbol={tokenData.symbol}
              tokenMint={tokenMint}
            />
          </div>

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
