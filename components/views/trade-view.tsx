'use client';

import React, { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Wallet,
  Zap,
  TrendingUp,
  ShieldCheck,
  BarChart2,
  Settings2,
  ArrowRight,
  ExternalLink,
  Copy,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { SkeletonChart } from '@/components/ui/skeleton-states';
import { useAppState, useAppActions } from '@/lib/store';
import { useMarketData } from '@/lib/hooks/use-market-data';
import { TransactionPreviewModal } from '@/components/ui/transaction-preview-modal';
import { LimitOrderBuilder } from '@/components/limit-orders/limit-order-builder';
import { AxiomChartTabs } from '@/components/trading/axiom-chart-tabs';
import { TokenSocials } from '@/components/ui/token-socials';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData } from '@/lib/api/response';
import { resolveWalletId, resolveTokenId } from '@/lib/trading/resolve-ids';
import { toDecimalString, percentToDecimalString } from '@/lib/trading/decimal-input';

/** The chain's native asset — what a market buy is denominated in. */
const BASE_SYMBOL = 'SOL';

// Lazy-load Candlestick Chart for code-splitting and fast initial render
const DynamicCandlestickChart = dynamic(() => import('@/components/trading/candlestick-chart'), {
  loading: () => <SkeletonChart />,
  ssr: false,
});

/**
 * Market values are genuinely absent when the provider is down.
 *
 * `useMarketData` no longer substitutes mock numbers on failure, so these
 * render `—` rather than a plausible-looking figure. `n()` is for the few
 * places a number is structurally required (a chart input, a progress value);
 * it must never be used for a displayed figure.
 */
const dash = '—';
const money = (v: number | undefined, digits = 2, suffix = '') =>
  v === undefined || !Number.isFinite(v) ? dash : `$${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
const pct = (v: number | undefined, digits = 2) =>
  v === undefined || !Number.isFinite(v) ? dash : `${v.toFixed(digits)}%`;
const n = (v: number | undefined, fallback = 0) =>
  v === undefined || !Number.isFinite(v) ? fallback : v;

export function TradeView() {
  const { connectedWallet, primaryWallet } = useAppState();
  const { addNotification, addExecutionLog } = useAppActions();
  const { marketSummary } = useMarketData();

  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [executionMode, setExecutionMode] = useState<'market' | 'limit'>('market');
  const [solAmount, setSolAmount] = useState('0.5');
  const [slippage, setSlippage] = useState('1.0');
  const [timeframe, setTimeframe] = useState('15m');
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [pendingQuote, setPendingQuote] = useState<{ expectedOut: number; priceImpactPct: number; networkFeeUsd: number } | null>(null);
  /** Resolved database ids, held between the preview and the confirmed submit. */
  const [pendingOrder, setPendingOrder] = useState<{ walletId: string; tokenId: string; quantity: string } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showLimitBuilder, setShowLimitBuilder] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  /**
   * The token being traded against the native asset.
   *
   * Still fixed while the terminal has no token-selection control wired to it —
   * but it is now resolved against the registry rather than sent as a bare
   * string, so an unknown symbol is reported instead of silently accepted.
   */
  const quoteSymbol = 'SENT';

  /**
   * One idempotency key per order attempt, minted when the flow starts and
   * cleared once the order is placed. Held in a ref rather than state so that
   * a re-render between preview and confirm cannot mint a second key — which
   * would defeat the deduplication it exists to provide.
   */
  const idempotencyKeyRef = useRef<string | null>(null);

  const activeWalletAddress = primaryWallet?.address || connectedWallet?.address || '';
  const activeBalance = primaryWallet?.balanceSol ?? connectedWallet?.balanceSol ?? 42.85;

  const handleInitiateOrder = async () => {
    setIsExecuting(true);
    setExecutionError(null);

    const walletId = activeWalletAddress;
    const amountVal = parseFloat(solAmount);
    if (!amountVal || amountVal <= 0) {
      setExecutionError('Invalid SOL amount specified.');
      setIsExecuting(false);
      return;
    }

    // The order API is wallet-scoped and ownership-checked. Previously a
    // truncated display string ('7xK9...3a19') stood in for a missing wallet,
    // which the in-memory route accepted; say what is actually needed instead.
    if (!walletId) {
      setExecutionError('Connect a wallet before placing an order.');
      setIsExecuting(false);
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    addExecutionLog({
      text: `[OMS-INTENT] Pricing ${orderType.toUpperCase()} ${solAmount} ${BASE_SYMBOL} on $${quoteSymbol}...`,
      level: 'info',
    });

    try {
      // Step 1: price the swap. `/api/v1/trading/quote` is validated and
      // rate-limited and runs the real quote router, unlike the legacy
      // `/api/orders/:id/quote` which read back an in-memory intent.
      const quoteRes = await fetch(apiUrl(endpoints.trading.quote), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          inputToken: orderType === 'buy' ? BASE_SYMBOL : quoteSymbol,
          outputToken: orderType === 'buy' ? quoteSymbol : BASE_SYMBOL,
          amount: String(amountVal),
          slippage: parseFloat(slippage),
          walletAddress: walletId,
        }),
      });
      const quoteBody = await readApiData<{ quote?: any }>(
        quoteRes,
        'Failed to obtain a live route quote',
      );

      const quote = quoteBody?.quote ?? {};
      setPendingQuote({
        expectedOut: Number(quote.outputAmount ?? 0),
        priceImpactPct: Number(quote.priceImpact ?? 0),
        networkFeeUsd: Number(quote.fees?.networkFeeUsd ?? quote.fees?.totalUsd ?? 0),
      });

      // Step 2: resolve the identifiers the order API needs. Done before the
      // preview opens so an unlinked wallet or unknown token is reported now,
      // rather than after the user has confirmed.
      const [resolvedWalletId, resolvedTokenId] = await Promise.all([
        resolveWalletId(walletId),
        resolveTokenId(quoteSymbol),
      ]);
      // Sent as the decimal string the user typed: the order API validates
      // against /^\d+(\.\d+)?$/ and stores NUMERIC, so a float would both fail
      // validation and lose precision.
      setPendingOrder({
        walletId: resolvedWalletId,
        tokenId: resolvedTokenId,
        quantity: toDecimalString(solAmount),
      });

      setShowPreviewModal(true);
    } catch (err: any) {
      setExecutionError(err.message || 'Execution failed');
      addNotification({
        title: 'Order Intent Error',
        message: err.message || 'Failed to initiate swap route.',
        type: 'risk',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleConfirmAndExecute = async () => {
    if (!pendingOrder) return;
    setIsExecuting(true);
    setShowPreviewModal(false);

    try {
      // Step 3: place the order. This is the Phase 3 Postgres domain — the row
      // persists, the state machine enforces its transitions, and the
      // idempotency key means a double-submit produces one order, not two.
      const res = await fetch(apiUrl(endpoints.orders.create), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          walletId: pendingOrder.walletId,
          tokenId: pendingOrder.tokenId,
          orderType: executionMode === 'limit' ? 'LIMIT' : 'MARKET',
          side: orderType === 'buy' ? 'BUY' : 'SELL',
          quantity: pendingOrder.quantity,
          slippageLimit: percentToDecimalString(slippage),
          idempotencyKey: idempotencyKeyRef.current ?? undefined,
        }),
      });

      const body = await readApiData<{ order: any; replayed: boolean }>(res, 'Order was rejected');

      const order = body.order;
      setActiveOrderId(order.id);

      addNotification({
        title: `${orderType.toUpperCase()} Order ${body.replayed ? 'Already Placed' : 'Placed'}`,
        message: body.replayed
          ? `This order was already submitted — showing the existing order ${order.id}.`
          : `Order ${order.id} accepted for ${solAmount} ${BASE_SYMBOL} → $${quoteSymbol}. Status: ${order.status}.`,
        type: 'execution',
      });

      addExecutionLog({
        text: `[OMS] Order ${order.id} ${body.replayed ? 'replayed' : 'created'} — status ${order.status}`,
        level: 'info',
      });

      // A new key per completed submission: the next order is a new intent, and
      // reusing the key would make it collapse into this one.
      idempotencyKeyRef.current = null;
    } catch (err: any) {
      setExecutionError(err.message || 'Order placement failed');
      addNotification({
        title: 'Order Failed',
        message: err.message || 'Order could not be placed.',
        type: 'risk',
      });
    } finally {
      setIsExecuting(false);
      setPendingOrder(null);
      setPendingQuote(null);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {/* Top Token Information Header */}
      <div className="rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-3 sm:p-3.5 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TokenAvatar
            symbol="SENT"
            name="Solana Sentinel"
            mint="7xK99zK8mP2xQ5wN3a19"
            size="md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">Solana Sentinel</h2>
              <span className="text-xs font-mono text-slate-400">$SENT</span>
              <Badge variant="risk-low" size="sm">LOW RISK</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
              <p className="text-2xs text-slate-400 font-numeric flex items-center gap-1.5">
                <span>Mint: 7xK99zK8mP2xQ5wN3a19</span>
                <Copy className="h-3 w-3 cursor-pointer hover:text-white" />
              </p>
              {/* Token Social Media Handles */}
              <TokenSocials symbol="SENT" showHandles={true} size="xs" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-numeric">
          <div className="min-w-[130px]">
            <p className="text-2xs text-slate-400 uppercase font-mono">Price</p>
            <p className="text-base sm:text-lg font-bold text-white">{money(marketSummary?.solPriceUsd, 4)} <span className="text-xs text-emerald-400 font-bold">{pct(marketSummary?.solChange24h)}</span></p>
          </div>

          <div className="min-w-[130px]">
            <p className="text-2xs text-slate-400 uppercase font-mono">24h Organic Vol</p>
            <p className="text-xs sm:text-sm font-bold text-slate-200">
              {money(marketSummary?.totalVolume24hUsd, 0)}
              {/* Was `raw * 0.87`, presented as an organic figure. MarketSummary
                  carries no organic field; wire /api/v1/analytics/market before
                  showing a split. */}
              <span className="text-2xs text-slate-500 font-normal"> reported</span>
            </p>
          </div>

          <div className="min-w-[120px]">
            <p className="text-2xs text-slate-400 uppercase font-mono">Liquidity</p>
            <p className="text-xs sm:text-sm font-bold text-slate-200">${marketSummary?.totalLiquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>

          <div className="min-w-[120px]">
            <p className="text-2xs text-slate-400 uppercase font-mono">Market Cap</p>
            <p className="text-xs sm:text-sm font-bold text-slate-200">${marketSummary?.totalMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      </div>

      {/* Main Terminal Workspace Layout */}
      <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-4 items-start">
        {/* Left 3 Cols: Chart + Intelligence Breakdown */}
        <div className="lg:col-span-3 space-y-2.5 sm:space-y-3">
          {/* Candlestick Chart (Compact Embedded) */}
          <DynamicCandlestickChart
            compact={true}
            height="h-[250px] sm:h-[265px]"
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />

          {/* Axiom-Style Navigation Tabs (Trades, Positions, Orders, Sentinel Intelligence Audit, Holders, Top Traders, Dev Tokens) */}
          <AxiomChartTabs
            currentPrice={n(marketSummary?.solPriceUsd)}
            tokenSymbol="SENT"
            tokenMint="7xK99zK8mP2xQ5wN3a19"
            onOpenLimitBuilder={() => setShowLimitBuilder(true)}
            onQuickTrade={(type, amt) => {
              setOrderType(type);
              setSolAmount(amt.toString());
              setExecutionMode('market');
              addNotification({
                title: `Instant ${type.toUpperCase()} Selected`,
                message: `Set ${type.toUpperCase()} order size to ${amt} SOL on $SENT. Click execute to submit.`,
                type: 'system',
              });
            }}
          />
        </div>

        {/* Right 1 Col: Execution Order Form Panel */}
        <div className="space-y-2.5 sm:space-y-3">
          <Panel
            padding="sm"
            title={
              <span className="flex items-center gap-2 text-white font-bold text-xs">
                <Zap className="h-3.5 w-3.5 text-emerald-400 fill-current" /> DEX Order Execution
              </span>
            }
          >
            <div className="space-y-2.5">
              {/* Buy / Sell Toggle Buttons */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-sentinel-950 border border-sentinel-800">
                <button
                  onClick={() => setOrderType('buy')}
                  className={`py-1.5 rounded-lg font-bold text-xs transition ${
                    orderType === 'buy'
                      ? 'bg-trading-buy text-slate-950 shadow-glow-buy'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  BUY $SENT
                </button>
                <button
                  onClick={() => setOrderType('sell')}
                  className={`py-1.5 rounded-lg font-bold text-xs transition ${
                    orderType === 'sell'
                      ? 'bg-trading-sell text-white shadow-glow-sell'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  SELL $SENT
                </button>
              </div>

              {/* Market vs Limit */}
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setExecutionMode('market')}
                  className={`flex-1 py-1 rounded transition uppercase ${
                    executionMode === 'market'
                      ? 'bg-sentinel-750 text-sky-300 font-bold border border-sentinel-600'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Market
                </button>
                <button
                  onClick={() => {
                    setExecutionMode('limit');
                    setShowLimitBuilder(true);
                  }}
                  className={`flex-1 py-1 rounded transition uppercase ${
                    executionMode === 'limit'
                      ? 'bg-sentinel-750 text-sky-300 font-bold border border-sentinel-600'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Limit
                </button>
              </div>

              {/* Amount Inputs */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400 font-numeric">
                  <span>Order Size:</span>
                  <span>Balance: <strong className="text-white">{activeBalance.toFixed(2)} SOL</strong></span>
                </div>

                <Input
                  isMonospace
                  type="number"
                  value={solAmount}
                  onChange={(e) => setSolAmount(e.target.value)}
                  rightAddon={<span className="text-xs font-mono text-slate-400">SOL</span>}
                />

                <div className="grid grid-cols-4 gap-1 font-numeric text-xs">
                  {['0.1', '0.5', '1.0', '5.0'].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setSolAmount(amt)}
                      className={`py-1 rounded border text-2xs font-bold transition ${
                        solAmount === amt
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                          : 'bg-sentinel-900 text-slate-400 border-sentinel-800'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slippage & MEV settings */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-2 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Slippage:</span>
                  <div className="flex items-center gap-1 font-mono">
                    {['0.5', '1.0', '2.0'].map((slip) => (
                      <button
                        key={slip}
                        onClick={() => setSlippage(slip)}
                        className={`px-1.5 py-0.5 rounded text-2xs ${
                          slippage === slip ? 'bg-sky-500/30 text-sky-300 border border-sky-500/50' : 'bg-sentinel-900 text-slate-400'
                        }`}
                      >
                        {slip}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Routing:</span>
                  <span className="font-mono text-emerald-400 font-bold">Sentinel Aggregator</span>
                </div>
              </div>

              {executionError && (
                <div className="p-2 rounded-lg border border-rose-500/30 bg-rose-950/40 text-xs text-rose-300">
                  {executionError}
                </div>
              )}

              {/* Action Execute Button */}
              {executionMode === 'limit' ? (
                <Button
                  onClick={() => setShowLimitBuilder(true)}
                  variant={orderType === 'buy' ? 'buy' : 'sell'}
                  size="md"
                  className="w-full text-xs font-bold py-2.5 uppercase tracking-wide"
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Configure Limit {orderType.toUpperCase()}
                </Button>
              ) : (
                <Button
                  onClick={handleInitiateOrder}
                  variant={orderType === 'buy' ? 'buy' : 'sell'}
                  size="md"
                  isLoading={isExecuting}
                  className="w-full text-xs font-extrabold py-2.5 uppercase tracking-wide shadow-md"
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Execute {orderType.toUpperCase()}
                </Button>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Transaction Preview Modal Gate */}
      {showPreviewModal && (
        <TransactionPreviewModal
          walletId={activeWalletAddress}
          tokenId={quoteSymbol}
          action={orderType === 'buy' ? 'BUY' : 'SELL'}
          amountUsd={parseFloat(solAmount) * n(marketSummary?.solPriceUsd)}
          // The quote already fetched from /api/v1/trading/quote, so the figures
          // the user confirms are the ones they were quoted.
          simulation={
            pendingQuote
              ? {
                  success: true,
                  // Value received, not token count: `expectedOut` is denominated
                  // in the *output* token, so converting it with the SOL price
                  // would be meaningless. A swap trades equal value less costs,
                  // so the input value net of impact and fee is the honest
                  // figure to show against a "$" label.
                  expectedReceiveUsd: Math.max(
                    0,
                    parseFloat(solAmount) *
                      n(marketSummary?.solPriceUsd) *
                      (1 - pendingQuote.priceImpactPct / 100) -
                      pendingQuote.networkFeeUsd,
                  ),
                  priceImpactPct: pendingQuote.priceImpactPct,
                  networkFeeUsd: pendingQuote.networkFeeUsd,
                  route: [BASE_SYMBOL, quoteSymbol],
                  contractRisk: 'LOW',
                }
              : null
          }
          onCancel={() => {
            setShowPreviewModal(false);
            setPendingOrder(null);
            setPendingQuote(null);
          }}
          onSign={handleConfirmAndExecute}
        />
      )}

      {/* Intelligent Limit Order Builder Modal (Sprint 21) */}
      {showLimitBuilder && (
        <LimitOrderBuilder
          currentPrice={n(marketSummary?.solPriceUsd)}
          walletBalanceSol={activeBalance}
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
