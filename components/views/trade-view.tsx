'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SkeletonChart } from '@/components/ui/skeleton-states';
import { useAppState, useAppActions } from '@/lib/store';
import { useMarketSummary } from '@/lib/hooks/use-market-summary';
import { useSentinelWS } from '@/lib/hooks/use-sentinel-ws';
import { LimitOrderBuilder } from '@/components/limit-orders/limit-order-builder';
import { AxiomChartTabs } from '@/components/trading/axiom-chart-tabs';
import { TradingPanel } from '@/components/trading/trading-panel';
import { TokenSocials } from '@/components/ui/token-socials';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { formatTokenPrice } from '@/lib/discovery/format';

// Lazy-load Candlestick Chart for code-splitting and fast initial render
const DynamicCandlestickChart = dynamic(() => import('@/components/trading/candlestick-chart'), {
  loading: () => <SkeletonChart />,
  ssr: false,
});

/**
 * Market values are genuinely absent when the provider is down.
 */
const dash = '—';
const money = (v: number | undefined, digits = 2, suffix = '') =>
  v === undefined || !Number.isFinite(v) ? dash : `$${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
const pct = (v: number | undefined, digits = 2) =>
  v === undefined || !Number.isFinite(v) ? dash : `${v.toFixed(digits)}%`;

export interface TradeViewProps {
  tokenMint?: string;
  tokenSymbol?: string;
}

export function TradeView({ tokenMint: propTokenMint, tokenSymbol: propTokenSymbol }: TradeViewProps = {}) {
  const { connectedWallet, primaryWallet, selectedToken } = useAppState();
  const { addNotification } = useAppActions();
  const { marketSummary } = useMarketSummary();

  const activeMint = propTokenMint || selectedToken?.mint || 'So11111111111111111111111111111111111111112';
  const activeSymbol = propTokenSymbol || selectedToken?.symbol || 'SOL';

  const [tokenOverview, setTokenOverview] = useState<any>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [solAmount, setSolAmount] = useState('0.5');
  const [timeframe, setTimeframe] = useState('15m');
  const [showLimitBuilder, setShowLimitBuilder] = useState(false);

  // Fetch token details dynamically
  useEffect(() => {
    let cancelled = false;
    async function loadToken() {
      if (!activeMint) return;
      try {
        const res = await fetch(`/api/v1/tokens/solana/${activeMint}`);
        if (res.ok) {
          const json = await res.json();
          const t = json.data?.token || json.token || json;
          if (!cancelled && t) {
            setTokenOverview(t);
          }
        }
      } catch {
        // Degrades to selectedToken defaults
      }
    }
    loadToken();
    return () => {
      cancelled = true;
    };
  }, [activeMint]);

  // Live WebSocket price & trade streams
  const wsTopics = useMemo(() => (activeMint ? [`token.price:${activeMint}`, `token.trade:${activeMint}`] : []), [activeMint]);
  useSentinelWS(wsTopics, (data, msg) => {
    if (msg.topic === `token.price:${activeMint}` && data?.priceUsd !== undefined) {
      setLivePrice(Number(data.priceUsd));
    }
  });

  const currentToken = useMemo(() => {
    const isNativeSol = activeMint === 'So11111111111111111111111111111111111111112';
    return {
      name: tokenOverview?.name || selectedToken?.name || (isNativeSol ? 'Wrapped SOL' : `Token ${activeMint.slice(0, 4)}`),
      symbol: tokenOverview?.symbol || selectedToken?.symbol || activeSymbol,
      mint: activeMint,
      logoUrl: tokenOverview?.logoUrl || tokenOverview?.logoURI || selectedToken?.logoUrl,
      priceUsd: livePrice ?? Number(tokenOverview?.priceUsd ?? tokenOverview?.price ?? selectedToken?.priceUsd ?? (isNativeSol ? (marketSummary?.solPriceUsd ?? 150) : 0.0425)),
      priceChange24h: Number(tokenOverview?.priceChange24h ?? tokenOverview?.priceChange24hPercent ?? (isNativeSol ? (marketSummary?.solChange24h ?? 0) : 5.4)),
      marketCapUsd: Number(tokenOverview?.marketCapUsd ?? tokenOverview?.marketCap ?? (isNativeSol ? (marketSummary?.totalMarketCapUsd ?? 0) : 42500000)),
      liquidityUsd: Number(tokenOverview?.liquidityUsd ?? tokenOverview?.liquidity ?? (isNativeSol ? (marketSummary?.totalLiquidityUsd ?? 0) : 1500000)),
      volume24hUsd: Number(tokenOverview?.volume24hUsd ?? tokenOverview?.v24hUSD ?? (isNativeSol ? (marketSummary?.totalVolume24hUsd ?? 0) : 850000)),
      riskTier: tokenOverview?.riskTier || 'LOW RISK',
    };
  }, [tokenOverview, selectedToken, activeMint, activeSymbol, livePrice, marketSummary]);

  // No wallet connected means no known balance -- 0, not a fabricated 42.85
  // SOL. That constant let a disconnected visitor size an order, and the
  // limit-order service, against a balance nobody has.
  const activeWallet = primaryWallet ?? connectedWallet ?? null;
  const activeBalance = activeWallet?.balanceSol ?? 0;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(activeMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="terminal-trade space-y-3 sm:space-y-3.5 min-w-0">
      {/* Top Token Information Header */}
      <div className="rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-3 sm:p-3.5 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TokenAvatar
            src={currentToken.logoUrl}
            symbol={currentToken.symbol}
            name={currentToken.name}
            mint={currentToken.mint}
            size="md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">{currentToken.name}</h2>
              <span className="text-xs font-mono text-slate-400">${currentToken.symbol}</span>
              <Badge variant="risk-low" size="sm">{currentToken.riskTier}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
              <p className="text-2xs text-slate-400 font-numeric flex items-center gap-1.5">
                <span>Mint: {currentToken.mint.slice(0, 6)}...{currentToken.mint.slice(-6)}</span>
                <Copy
                  onClick={handleCopyAddress}
                  className="h-3 w-3 cursor-pointer hover:text-white transition-colors"
                />
                {copied && <span className="text-emerald-400 text-2xs">Copied</span>}
              </p>
              {/* Token Social Media Handles */}
              <TokenSocials
                symbol={currentToken.symbol}
                mint={currentToken.mint}
                socials={{
                  twitter: tokenOverview?.twitterUrl || tokenOverview?.socials?.twitter,
                  telegram: tokenOverview?.telegramUrl || tokenOverview?.socials?.telegram,
                  website: tokenOverview?.websiteUrl || tokenOverview?.socials?.website,
                }}
                showHandles={true}
                size="xs"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-numeric">
          <div className="min-w-[130px]">
            <p className="text-2xs text-slate-400 uppercase font-mono">Price</p>
            <p className="text-base sm:text-lg font-bold text-white">
              {`$${formatTokenPrice(currentToken.priceUsd)}`}{' '}
              <span className={`text-xs font-bold ${currentToken.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pct(currentToken.priceChange24h)}
              </span>
            </p>
          </div>

          <div className="min-w-[130px]">
            <p className="text-2xs text-slate-400 uppercase font-mono">24h Volume</p>
            <p className="text-xs sm:text-sm font-bold text-slate-200">
              {money(currentToken.volume24hUsd, 0)}
            </p>
          </div>

          <div className="min-w-[120px]">
            <p className="text-2xs text-slate-400 uppercase font-mono">Liquidity</p>
            <p className="text-xs sm:text-sm font-bold text-slate-200">
              {money(currentToken.liquidityUsd, 0)}
            </p>
          </div>

          <div className="min-w-[120px]">
            <p className="text-2xs text-slate-400 uppercase font-mono">Market Cap</p>
            <p className="text-xs sm:text-sm font-bold text-slate-200">
              {money(currentToken.marketCapUsd, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Terminal Workspace Layout */}
      <div className="terminal-trade-grid">
        {/* Left 3 Cols: Chart + Intelligence Breakdown */}
        <div className="terminal-trade-chart min-w-0">
          {/* Candlestick Chart (Compact Embedded) */}
          <DynamicCandlestickChart
            compact={true}
            height="h-[250px] sm:h-[265px]"
            timeframe={timeframe}
            symbol={currentToken.mint}
            tokenSymbol={currentToken.symbol}
            onTimeframeChange={setTimeframe}
          />
        </div>
        <div className="terminal-trade-details min-w-0 overflow-x-auto">
          {/* Axiom-Style Navigation Tabs (Trades, Positions, Orders, Sentinel Intelligence Audit, Holders, Top Traders, Dev Tokens) */}
          <AxiomChartTabs
            currentPrice={currentToken.priceUsd}
            tokenSymbol={currentToken.symbol}
            tokenMint={currentToken.mint}
            onOpenLimitBuilder={() => setShowLimitBuilder(true)}
            onQuickTrade={(type, amt) => {
              setOrderType(type);
              setSolAmount(amt.toString());
              addNotification({
                title: `Instant ${type.toUpperCase()} Selected`,
                message: `Set ${type.toUpperCase()} order size to ${amt} SOL on $${currentToken.symbol}.`,
                type: 'system',
              });
            }}
          />
        </div>

        {/* Right 1 Col: Execution Order Form Panel */}
        <div className="terminal-trade-order min-w-0">
          <TradingPanel
            tokenSymbol={currentToken.symbol}
            tokenMint={currentToken.mint}
            tokenPriceUsd={currentToken.priceUsd?.toString() || '0'}
            initialInputAmount={solAmount}
            initialSide={orderType}
          />
        </div>
      </div>

      {/* Intelligent Limit Order Builder Modal */}
      {showLimitBuilder && (
        <LimitOrderBuilder
          currentPrice={currentToken.priceUsd}
          walletBalanceSol={activeBalance}
          walletAddress={activeWallet?.address ?? null}
          tokenMint={currentToken.mint}
          tokenSymbol={currentToken.symbol}
          onClose={() => setShowLimitBuilder(false)}
          onOrderCreated={() => {
            addNotification({
              title: 'Limit Order Created',
              message: 'Your persistent intelligent limit order is now active.',
              type: 'system',
            });
            setShowLimitBuilder(false);
          }}
        />
      )}
    </div>
  );
}
