'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { TokenIdentityHeader } from '@/components/token/token-identity-header';
import { MarketStats } from '@/components/market/market-stats';
import { MarketChart } from '@/components/market/market-chart';
import { MarketComparisonTable } from '@/components/token/market-comparison-table';
import { OrderPanel } from '@/components/trading/order-panel';
import { TradeHistoryFeed } from '@/components/trading/trade-history-feed';
import { TransactionHistoryTable } from '@/components/trading/transaction-history-table';
import { tokenDiscoveryPipeline } from '@/lib/market-data/discovery/token-discovery-pipeline';
import { snapshotEngine } from '@/lib/market-data/snapshots/snapshot-engine';
import { canonicalMarketRegistry } from '@/lib/market-data/discovery/market-registry';
import { priceEngine } from '@/lib/market-data/pricing/price-engine';
import { liquidityEngine } from '@/lib/market-data/liquidity/liquidity-engine';

export default function TokenTradingTerminalPage() {
  const params = useParams();
  const tokenId = (params?.id as string) || 'So11111111111111111111111111111111111111112';

  const [activeTab, setActiveTab] = useState<'chart' | 'markets' | 'trades' | 'transactions'>('chart');
  const [tokenData, setTokenData] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    // 1. Resolve Token Profile & Snapshot
    const token = tokenDiscoveryPipeline.getToken(tokenId);
    const snapshot = snapshotEngine.getTokenSnapshot(tokenId);

    setTokenData({
      tokenId,
      symbol: token?.symbol || snapshot.symbol || 'SOL',
      name: token?.name || snapshot.name || 'Wrapped SOL',
      chainId: token?.chainId || 'solana',
      verifiedStatus: token?.status === 'ACTIVE' ? 'VERIFIED' : (token?.status === 'SUSPICIOUS' ? 'SUSPICIOUS' : 'UNVERIFIED'),
      priceUsd: snapshot.priceUsd,
      snapshot,
    });

    // 2. Resolve Associated DEX Markets
    const rawMarkets = canonicalMarketRegistry.getMarketsForToken(tokenId);
    const enriched = rawMarkets.map((m, idx) => {
      const p = priceEngine.getMarketPrice(m.marketId);
      const r = liquidityEngine.getMarketReserve(m.marketId);
      return {
        ...m,
        priceUsd: p?.priceUsd || snapshot.priceUsd,
        liquidityUsd: r?.liquidityUsd || 1_000_000,
        spreadPct: 0.05,
        isPrimary: idx === 0,
      };
    });
    setMarkets(enriched);

    // 3. Simulated Live Trade Feed
    const simulatedTrades = [];
    const now = Date.now();
    for (let i = 0; i < 25; i++) {
      const isBuy = i % 2 === 0;
      const volume = (10 + (i % 7) * 4) * 150;
      simulatedTrades.push({
        id: `trade_${tokenId}_${i}`,
        side: isBuy ? ('BUY' as const) : ('SELL' as const),
        priceUsd: snapshot.priceUsd + (i % 3) * 0.15 - 0.2,
        baseAmount: (volume / snapshot.priceUsd).toFixed(2),
        quoteAmount: volume.toFixed(2),
        volumeUsd: volume,
        isLargeTrade: volume >= 3500,
        senderWallet: `7xK${i}...99a${i}`,
        txHash: `0xSwapTx${i}`,
        timestamp: new Date(now - i * 30000).toISOString(),
      });
    }
    setTrades(simulatedTrades);
  }, [tokenId]);

  if (!tokenData) {
    // Rendered inside the shell as well: showing bare chrome-less text first and
    // the full terminal a moment later reads as two different pages loading.
    return (
      <AppShell initialView="trade">
        <div className="flex items-center justify-center py-24 font-mono">
          <p className="text-xs text-slate-500 animate-pulse">Loading Trading Terminal...</p>
        </div>
      </AppShell>
    );
  }

  const primaryMarketId = markets.length > 0 ? markets[0].marketId : 'solana:raydium_cpmm:main';

  return (
    <AppShell initialView="trade">
      {/* Main Terminal Layout. The shell supplies nav, status bar and wallet;
          this page owns only the token content. */}
      <div className="max-w-[1600px] w-full mx-auto space-y-4 font-mono">
        {/* Token Identity Header Bar */}
        <TokenIdentityHeader
          tokenId={tokenData.tokenId}
          symbol={tokenData.symbol}
          name={tokenData.name}
          chainId={tokenData.chainId}
          verifiedStatus={tokenData.verifiedStatus}
        />

        {/* Global Market Stats Strip */}
        <MarketStats
          solPriceUsd={tokenData.priceUsd}
          totalVolume24hUsd={tokenData.snapshot.volume24hUsd}
          totalLiquidityUsd={tokenData.snapshot.totalLiquidityUsd}
          activePoolsCount={markets.length || 3}
        />

        {/* Core Trading Terminal Workspace (3-Column Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left / Center Workspace (Chart, Markets, Trades, Transactions) — 8 Cols */}
          <div className="lg:col-span-8 space-y-4">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-sentinel-900/60 rounded-2xl border border-white/5 text-xs w-fit">
              <button
                onClick={() => setActiveTab('chart')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  activeTab === 'chart'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Interactive Chart
              </button>

              <button
                onClick={() => setActiveTab('markets')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  activeTab === 'markets'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                DEX Markets ({markets.length})
              </button>

              <button
                onClick={() => setActiveTab('trades')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  activeTab === 'trades'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Swaps ({trades.length})
              </button>

              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  activeTab === 'transactions'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Your Orders
              </button>
            </div>

            {/* Active Workspace View */}
            {activeTab === 'chart' && (
              <div className="space-y-4">
                <MarketChart
                  marketId={primaryMarketId}
                  symbol={tokenData.symbol}
                  initialInterval="1h"
                />

                {/* Sub-panel: Live Trade Stream below chart */}
                <TradeHistoryFeed
                  trades={trades.slice(0, 10)}
                  tokenSymbol={tokenData.symbol}
                />
              </div>
            )}

            {activeTab === 'markets' && (
              <MarketComparisonTable
                markets={markets}
                onSelectMarket={(marketId) => console.log('Selected market:', marketId)}
              />
            )}

            {activeTab === 'trades' && (
              <TradeHistoryFeed
                trades={trades}
                tokenSymbol={tokenData.symbol}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionHistoryTable
                transactions={[
                  {
                    id: 'tx_demo_01',
                    type: 'SWAP',
                    tokenSymbol: tokenData.symbol,
                    amount: '10.0',
                    valueUsd: 1500.0,
                    status: 'CONFIRMED',
                    txHash: '5xSwapHash99SolanaTxRaydium1',
                    timestamp: new Date().toISOString(),
                  },
                ]}
              />
            )}
          </div>

          {/* Right Workspace (Authoritative Order Panel) — 4 Cols */}
          <div className="lg:col-span-4">
            <div className="sticky top-20">
              <OrderPanel
                tokenSymbol={tokenData.symbol}
                tokenId={tokenData.tokenId}
                currentPriceUsd={tokenData.priceUsd}
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
