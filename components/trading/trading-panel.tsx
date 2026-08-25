'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Zap, ShieldCheck, Settings2, ChevronDown, ChevronUp, AlertTriangle, ArrowDownUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { usePrimaryWallet, useConnectWallet, useNotificationsActions, useWalletState, useWalletActions } from '@/lib/store';
import type { Quote } from '@/lib/quote/types';
import { simulateTradeExecution, submitTradeOrder } from '@/lib/trading/service';
import type { TransactionExecutionState } from '@/lib/trading/types';
import { signatureToBase58 } from '@/lib/wallet/siws';
import { Decimal } from '@/lib/math/decimal';
import { TransactionPreviewModal } from './transaction-preview-modal';

interface TradingPanelProps {
  tokenSymbol: string;
  tokenMint: string;
  tokenPriceUsd: string;
}

export function TradingPanel({ tokenSymbol, tokenMint, tokenPriceUsd }: TradingPanelProps) {
  const { primaryWallet, address, balanceSol } = usePrimaryWallet();
  const { selectedAdapter } = useWalletState();
  const { recordTradeExecution } = useWalletActions();
  const { openModal: openWalletModal } = useConnectWallet();
  const { addNotification, addExecutionLog } = useNotificationsActions();

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [inputAmount, setInputAmount] = useState('0.5');
  const [slippage, setSlippage] = useState(0.5); // 0.5% default
  const [customSlippage, setCustomSlippage] = useState('');
  const [isCustomSlippage, setIsCustomSlippage] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [showAdvancedRoute, setShowAdvancedRoute] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [transactionState, setTransactionState] = useState<TransactionExecutionState>('idle');
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isSimulationLoading, setIsSimulationLoading] = useState(false);
  const [simulationErrors, setSimulationErrors] = useState<string[]>([]);
  const [simulationWarnings, setSimulationWarnings] = useState<string[]>([]);
  const [simulationTxHash, setSimulationTxHash] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const effectiveSlippage = isCustomSlippage ? parseFloat(customSlippage) || 0.5 : slippage;
  const isHighSlippage = effectiveSlippage > 3.0;

  // Fetch authoritative quote whenever input, side, or slippage changes
  const updateQuote = useCallback(async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    setIsQuoteLoading(true);
    setQuoteError(null);

    try {
      // Mints, not symbols. The previous call passed 'SOL' and a symbol into a
      // client-side router that applied one hardcoded rate to every pair, which
      // is how the panel came to offer SOL in exchange for SOL.
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const res = await fetch('/api/v1/trading/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          inputMint: side === 'buy' ? SOL_MINT : tokenMint,
          outputMint: side === 'buy' ? tokenMint : SOL_MINT,
          inputSymbol: side === 'buy' ? 'SOL' : tokenSymbol,
          outputSymbol: side === 'buy' ? tokenSymbol : 'SOL',
          amount: inputAmount,
          slippage: effectiveSlippage,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data?.quote) {
        throw new Error(body?.error?.message || `Quote unavailable (${res.status})`);
      }
      setQuote(body.data.quote);
    } catch (err: any) {
      setQuoteError(err.message || 'Failed to fetch quote');
      setQuote(null);
    } finally {
      setIsQuoteLoading(false);
    }
  }, [inputAmount, side, effectiveSlippage, tokenSymbol, tokenMint]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateQuote();
    }, 250);
    return () => clearTimeout(timer);
  }, [updateQuote]);

  // Quick Percentage Amount Handlers (25%, 50%, 75%, MAX)
  const handleQuickPercent = (percent: number) => {
    if (!primaryWallet) return;
    const maxAvailable = side === 'buy' ? balanceSol : 10000; // Mock token balance
    const portion = (maxAvailable * (percent / 100)).toFixed(4);
    setInputAmount(portion);
  };

  const formatPreviewError = (technical: string): string => {
    if (technical.toLowerCase().includes('price impact') || technical.toLowerCase().includes('slippage')) {
      return 'The trade could not be simulated because the expected price moved beyond your selected slippage. Review the quote and try again.';
    }
    if (technical.toLowerCase().includes('expired')) {
      return 'The quote expired before the trade could be simulated. Refresh the quote and confirm again.';
    }
    if (technical.toLowerCase().includes('insufficient')) {
      return 'Your wallet does not hold enough balance to execute this order. Adjust the amount or switch wallets.';
    }
    if (technical.toLowerCase().includes('route failure')) {
      return 'Unable to construct a valid route for this swap. Try a smaller size or different market.';
    }
    return 'The trade could not be simulated. Review the quote and try again.';
  };

  const handleOpenPreview = async () => {
    if (!primaryWallet) {
      openWalletModal();
      return;
    }
    if (!quote) return;

    const stableKey = `${quote.id}:${address || primaryWallet.address}`;
    setIdempotencyKey(stableKey);
    setSimulationErrors([]);
    setSimulationWarnings([]);
    setSimulationTxHash(null);
    setExecutionError(null);
    setTransactionState('preparing');
    setIsSimulationLoading(true);
    setIsPreviewOpen(true);

    try {
      const result = await simulateTradeExecution(quote, address || primaryWallet.address, balanceSol, 'solana:mainnet');
      setSimulationErrors(result.errors);
      setSimulationWarnings(result.warnings);
      setSimulationTxHash(result.simulatedTxHash || null);

      if (!result.valid) {
        setTransactionState('failed');
        setExecutionError(formatPreviewError(result.errors[0] || 'Simulation failed.'));
        addExecutionLog({
          text: `[SIMULATION] Trade simulation failed for ${side.toUpperCase()} order on ${quote.provider}.`,
          level: 'warn',
        });
      } else {
        setTransactionState('idle');
        addExecutionLog({
          text: `[SIMULATION] Trade simulation passed. Prepared payload for ${side.toUpperCase()} order.`,
          level: 'info',
        });
      }
    } catch (err: any) {
      const technical = err.message || 'Unknown error';
      setTransactionState('failed');
      setExecutionError(formatPreviewError(technical));
      setSimulationErrors([technical]);
      setSimulationWarnings([]);
      addExecutionLog({
        text: `[SIMULATION] Error while simulating trade: ${technical}`,
        level: 'error',
      });
    } finally {
      setIsSimulationLoading(false);
    }
  };

  const handleConfirmTrade = async () => {
    if (!quote || !selectedAdapter || simulationErrors.length > 0) return;
    const walletAddress = address || primaryWallet?.address;
    if (!walletAddress) {
      addNotification({
        title: 'Execution Failed',
        message: 'No connected wallet found for transaction signing.',
        type: 'system',
      });
      setTransactionState('failed');
      setExecutionError('No connected wallet found for transaction signing.');
      return;
    }

    setExecutionError(null);
    setTransactionState('awaitingWallet');

    addExecutionLog({
      text: `[TERMINAL-EXEC] Requesting wallet signature for ${side.toUpperCase()} order...`,
      level: 'info',
    });

    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        quoteId: quote.id,
        quote,
        wallet: walletAddress,
        network: 'solana:mainnet',
        simulationTxHash,
      }));

      const signatureBytes = await selectedAdapter.signMessage(payload);
      setTransactionState('signing');

      const signatureBase58 = signatureToBase58(signatureBytes);
      setTransactionState('submitting');

      const confirmedTrade = await submitTradeOrder(
        quote,
        walletAddress,
        signatureBase58,
        'solana:mainnet',
        idempotencyKey ?? `${quote.id}:${walletAddress}`
      );
      setTransactionState('confirming');

      if (confirmedTrade.status === 'confirmed') {
        setTransactionState('confirmed');
        setIsPreviewOpen(false);

        const solAmount = side === 'buy' ? Number(inputAmount) : Number(quote.outputAmount);
        const tokenAmount = side === 'buy' ? Number(quote.outputAmount) : Number(inputAmount);
        const numPriceUsd =
          parseFloat(tokenPriceUsd) ||
          Number(quote.estimatedPriceUsd) ||
          (side === 'buy' && tokenAmount > 0 ? (solAmount * 170) / tokenAmount : 0.042);

        recordTradeExecution({
          side,
          tokenSymbol,
          tokenMint,
          tokenName: tokenSymbol,
          amountSol: solAmount,
          tokenAmount,
          priceUsd: numPriceUsd,
          txHash: confirmedTrade.txHash,
        });

        addNotification({
          title: `Order Submitted`,
          message: `Your ${side.toUpperCase()} order was submitted as ${confirmedTrade.txHash}.`,
          type: 'execution',
        });
      } else {
        setTransactionState('failed');
        setExecutionError('The swap execution returned a failed status.');
      }

      addExecutionLog({
        text: `[TERMINAL-EXEC] SUBMITTED: Swap Tx ${confirmedTrade.txHash} via ${quote.provider}`,
        level: confirmedTrade.status === 'confirmed' ? 'success' : 'error',
      });
    } catch (err: any) {
      const technical = err.message || 'Wallet signing or submission error';
      const friendly = technical.toLowerCase().includes('reject')
        ? 'The wallet signature was rejected. Approve the transaction in your wallet to continue.'
        : technical.toLowerCase().includes('expire')
        ? 'The quote expired before submission. Refresh and confirm again.'
        : 'The trade could not be submitted. Confirm the quote and try again.';

      const nextState = technical.toLowerCase().includes('reject')
        ? 'rejected'
        : technical.toLowerCase().includes('expire')
        ? 'expired'
        : 'failed';

      setTransactionState(nextState);
      setExecutionError(friendly);

      addNotification({
        title: 'Execution Failed',
        message: friendly,
        type: 'system',
      });
      addExecutionLog({
        text: `[TERMINAL-EXEC] FAILED: ${technical}`,
        level: 'error',
      });
    }
  };

  return (
    <Panel variant="default" className="space-y-4">
      {/* Buy / Sell Tab Controls */}
      <div className="grid grid-cols-2 gap-2 bg-sentinel-900/80 p-1 rounded-xl border border-sentinel-800 font-mono text-xs">
        <button
          onClick={() => {
            setSide('buy');
            setInputAmount('0.5');
          }}
          className={`py-2 rounded-lg font-bold transition text-center ${
            side === 'buy'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          BUY {tokenSymbol}
        </button>
        <button
          onClick={() => {
            setSide('sell');
            setInputAmount('1000');
          }}
          className={`py-2 rounded-lg font-bold transition text-center ${
            side === 'sell'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          SELL {tokenSymbol}
        </button>
      </div>

      {/* Wallet Balance Header */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-sky-400" />
          <span>Balance:</span>
        </span>
        {primaryWallet ? (
          <span className="text-slate-200 font-bold">
            {side === 'buy' ? `${balanceSol.toFixed(4)} SOL` : `10,000 ${tokenSymbol}`}
          </span>
        ) : (
          <button onClick={openWalletModal} className="text-sky-400 hover:underline">
            Connect Wallet
          </button>
        )}
      </div>

      {/* Input Amount Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
          <span>You Pay ({side === 'buy' ? 'SOL' : tokenSymbol})</span>
          {primaryWallet && (
            <div className="flex items-center gap-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handleQuickPercent(pct)}
                  className="px-1.5 py-0.5 text-2xs rounded bg-sentinel-800 text-slate-400 hover:text-white border border-sentinel-700"
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        <Input
          type="number"
          value={inputAmount}
          onChange={(e) => setInputAmount(e.target.value)}
          placeholder="0.0"
          className="font-mono text-lg"
        />
      </div>

      {/* Quote Output Estimate Section */}
      <div className="space-y-1.5 rounded-xl border border-sentinel-800 bg-sentinel-950 p-3">
        <div className="flex items-center justify-between text-2xs text-slate-400">
          <span>You Receive (Estimated)</span>
          {isQuoteLoading && <span className="text-sky-400 text-2xs animate-pulse">Calculating Quote...</span>}
        </div>

        <div className="text-lg font-bold text-emerald-400">
          {quote ? new Decimal(quote.outputAmount).formatToken(4) : '0.00'}{' '}
          <span className="text-xs text-emerald-300">{side === 'buy' ? tokenSymbol : 'SOL'}</span>
        </div>

        {quote && (
          <p className="text-2xs text-slate-500">
            {/* Formatted, not interpolated raw. `estimatedPriceUsd` is an
                18-decimal fixed-point string, so printing it directly rendered
                "$3.450000000000000000" on screen. The same Decimal treatment is
                used on the amount above. */}
            Est. Price: ${new Decimal(quote.estimatedPriceUsd).formatToken(4)} | Provider: {quote.provider}
          </p>
        )}
      </div>

      {/* Slippage Selection Controls */}
      <div className="space-y-2 font-mono">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Slippage Tolerance</span>
          <span className={`font-bold ${isHighSlippage ? 'text-amber-400' : 'text-slate-200'}`}>
            {effectiveSlippage}%
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {[0.1, 0.5, 1.0].map((val) => (
            <button
              key={val}
              onClick={() => {
                setSlippage(val);
                setIsCustomSlippage(false);
              }}
              className={`py-1.5 rounded-lg border text-center transition ${
                !isCustomSlippage && slippage === val
                  ? 'border-sky-500 bg-sky-950/40 text-sky-300 font-bold'
                  : 'border-sentinel-800 bg-sentinel-900 text-slate-400'
              }`}
            >
              {val}%
            </button>
          ))}
          <button
            onClick={() => setIsCustomSlippage(true)}
            className={`py-1.5 rounded-lg border text-center transition ${
              isCustomSlippage
                ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-bold'
                : 'border-sentinel-800 bg-sentinel-900 text-slate-400'
            }`}
          >
            Custom
          </button>
        </div>

        {isCustomSlippage && (
          <Input
            type="number"
            value={customSlippage}
            onChange={(e) => setCustomSlippage(e.target.value)}
            placeholder="Custom % (e.g. 2.5)"
            className="font-mono text-xs"
          />
        )}

        {isHighSlippage && (
          <div className="rounded-lg bg-amber-950/30 border border-amber-500/40 p-2 flex items-center gap-1.5 text-2xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>High slippage setting increase risk of front-running.</span>
          </div>
        )}
      </div>

      {/* Expandable Advanced Route Details */}
      {quote && (
        <div className="border-t border-sentinel-800 pt-2 font-mono text-2xs">
          <button
            onClick={() => setShowAdvancedRoute(!showAdvancedRoute)}
            className="w-full flex items-center justify-between text-slate-400 hover:text-slate-200 py-1"
          >
            <span>Advanced Route Breakdown</span>
            {showAdvancedRoute ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showAdvancedRoute && (
            <div className="mt-2 space-y-1.5 p-2.5 rounded-lg bg-sentinel-950 border border-sentinel-800 text-slate-300">
              <div className="flex justify-between">
                <span>Min Received:</span>
                <span className="font-bold">{new Decimal(quote.minimumReceived).formatToken(4)}</span>
              </div>
              <div className="flex justify-between">
                <span>Price Impact:</span>
                <span className={quote.priceImpact > 2.0 ? 'text-amber-400' : 'text-slate-200'}>
                  {quote.priceImpact}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Network Fee:</span>
                {/* Optional on the Quote type — an absent fee is unknown, not zero. */}
                <span>
                  {quote.networkFeeSol ? `${new Decimal(quote.networkFeeSol).formatToken(6)} SOL` : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Execute Button */}
      {!primaryWallet ? (
        <Button variant="buy" size="lg" className="w-full font-bold" onClick={openWalletModal}>
          Connect Wallet to Trade
        </Button>
      ) : (
        <Button
          variant={side === 'buy' ? 'buy' : 'sell'}
          size="lg"
          className="w-full font-bold"
          onClick={handleOpenPreview}
          disabled={!quote || isQuoteLoading}
        >
          Preview {side.toUpperCase()} Order
        </Button>
      )}

      {/* Transaction Preview Modal */}
      <TransactionPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setTransactionState('idle');
          setExecutionError(null);
        }}
        quote={quote}
        side={side}
        onConfirmExecute={handleConfirmTrade}
        executionState={transactionState}
        executionError={executionError}
        isExecuting={
          transactionState === 'awaitingWallet' ||
          transactionState === 'signing' ||
          transactionState === 'submitting' ||
          transactionState === 'confirming'
        }
        simulationErrors={simulationErrors}
        simulationWarnings={simulationWarnings}
        isSimulationLoading={isSimulationLoading}
      />
    </Panel>
  );
}
