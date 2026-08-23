'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Wallet, AlertCircle, Loader2, CheckCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SlippageControl } from './slippage-control';
import { TransactionPreviewModal } from './transaction-preview-modal';
import { TransactionStatusModal } from './transaction-status-modal';
import { quoteService } from '@/lib/quote/quote-service';
import { executionService } from '@/lib/execution/execution-service';
import { masterWalletProvider } from '@/lib/wallet/wallet-provider';
import { Quote } from '@/lib/quote/types';
import { TransactionLifecycleState } from '@/lib/transaction/state-machine';
import { Decimal } from '@/lib/math/decimal';

interface OrderPanelProps {
  tokenSymbol: string;
  tokenId: string;
  currentPriceUsd: number;
}

export function OrderPanel({
  tokenSymbol,
  tokenId,
  currentPriceUsd,
}: OrderPanelProps) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  const [amount, setAmount] = useState('1.0');
  const [slippage, setSlippage] = useState(0.5);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [txState, setTxState] = useState<TransactionLifecycleState>('CREATED');
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const isConnected = masterWalletProvider.getState() === 'CONNECTED';
  const walletAddress = masterWalletProvider.getAddress() || '7xK9...3a19';

  const userSolBalance = masterWalletProvider.getBalance('So11111111111111111111111111111111111111112').amount;
  const userTokenBalance = masterWalletProvider.getBalance(tokenId).amount;

  const currentAvailableBalance = side === 'BUY' ? userSolBalance : userTokenBalance;
  const paySymbol = side === 'BUY' ? 'SOL' : tokenSymbol;
  const receiveSymbol = side === 'BUY' ? tokenSymbol : 'SOL';

  // Request fresh quote when inputs change
  useEffect(() => {
    let active = true;
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setQuote(null);
        return;
      }

      setIsQuoting(true);
      try {
        const inputToken = side === 'BUY' ? 'SOL' : tokenId;
        const outputToken = side === 'BUY' ? tokenId : 'SOL';

        const q = await quoteService.getQuote({
          inputToken,
          outputToken,
          amount,
          slippage,
        });

        if (active) {
          setQuote(q);
        }
      } catch (err) {
        console.error('Quote error:', err);
      } finally {
        if (active) setIsQuoting(false);
      }
    };

    fetchQuote();
    return () => {
      active = false;
    };
  }, [side, amount, slippage, tokenId, tokenSymbol]);

  const handlePercentageShortcut = (pct: number) => {
    const calculated = (currentAvailableBalance * (pct / 100)).toFixed(4);
    setAmount(calculated);
  };

  const parsedAmount = parseFloat(amount || '0');
  const isInsufficientBalance = isConnected && parsedAmount > currentAvailableBalance;

  const handleOpenPreview = () => {
    if (!quote || isInsufficientBalance) return;
    setPreviewOpen(true);
  };

  const handleExecuteTrade = async () => {
    if (!quote) return;

    setPreviewOpen(false);
    setStatusModalOpen(true);
    setTxState('SIMULATING');

    try {
      // 1. Prepare intent & pre-flight simulate
      const { intent } = await executionService.prepareTransaction({
        userId: 'user_default',
        walletAddress,
        quoteId: quote.id,
      });

      const sim = await executionService.simulateTransaction(intent.intentId);
      if (!sim.success) {
        setTxState('SIMULATION_FAILED');
        setErrorMessage(sim.revertReason || 'Simulation rejected by pool reserves.');
        return;
      }

      // 2. Request Wallet Signature
      setTxState('AUTHORIZED');
      const signature = await masterWalletProvider.signTransaction(intent);

      // 3. Submit Transaction to mempool
      setTxState('SUBMITTED');
      const submission = await executionService.submitTransaction({
        intentId: intent.intentId,
        signatureHexOrBase58: signature,
      });

      setTxHash(submission.txHash);
      setTxState('CONFIRMED');
    } catch (err: any) {
      setTxState('BROADCAST_FAILED');
      setErrorMessage(err.message || 'Execution error');
    }
  };

  return (
    <div className="w-full bg-sentinel-900/70 border border-white/5 rounded-3xl p-4 sm:p-5 backdrop-blur-xl shadow-2xl space-y-4 font-mono">
      {/* Top Tabs: BUY / SELL */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-sentinel-950/80 rounded-2xl border border-white/5">
        <button
          onClick={() => setSide('BUY')}
          className={`py-2.5 rounded-xl font-bold text-xs transition ${
            side === 'BUY'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.15)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          BUY ${tokenSymbol}
        </button>

        <button
          onClick={() => setSide('SELL')}
          className={`py-2.5 rounded-xl font-bold text-xs transition ${
            side === 'SELL'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          SELL ${tokenSymbol}
        </button>
      </div>

      {/* Order Type Tabs (Market active, Limit/Stop disabled for future sprints) */}
      <div className="flex items-center gap-1 text-2xs">
        <button
          onClick={() => setOrderType('MARKET')}
          className={`px-3 py-1 rounded-lg font-semibold transition ${
            orderType === 'MARKET'
              ? 'bg-white/10 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Market
        </button>

        <button
          disabled
          title="Limit orders enabled in next sprint"
          className="px-3 py-1 rounded-lg text-slate-600 cursor-not-allowed"
        >
          Limit (Soon)
        </button>

        <button
          disabled
          title="Stop Loss enabled in next sprint"
          className="px-3 py-1 rounded-lg text-slate-600 cursor-not-allowed"
        >
          Stop Loss
        </button>
      </div>

      {/* You Pay Input Card */}
      <div className="p-3.5 rounded-2xl bg-sentinel-950/80 border border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>You Pay</span>
          <div className="flex items-center gap-1.5 text-2xs">
            <Wallet className="h-3 w-3 text-slate-500" />
            <span>Balance: <strong className="text-white">{currentAvailableBalance.toFixed(3)} {paySymbol}</strong></span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-xl sm:text-2xl font-bold text-white focus:outline-none placeholder:text-slate-600 font-mono"
          />

          <span className="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 font-bold text-xs text-sky-300 shrink-0">
            ${paySymbol}
          </span>
        </div>

        {/* Percentage Shortcuts */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => handlePercentageShortcut(pct)}
              className="py-1 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 text-2xs text-slate-400 hover:text-white transition font-bold"
            >
              {pct === 100 ? 'MAX' : `${pct}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Switch Arrow Icon */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={() => setSide(side === 'BUY' ? 'SELL' : 'BUY')}
          className="h-7 w-7 rounded-full bg-sentinel-900 border border-white/10 hover:border-sky-500/40 text-slate-400 hover:text-white flex items-center justify-center transition shadow-lg"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* You Receive Output Card */}
      <div className="p-3.5 rounded-2xl bg-sentinel-950/80 border border-white/5 space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>You Receive (Estimated)</span>
          {isQuoting && <Loader2 className="h-3 w-3 text-sky-400 animate-spin" />}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xl sm:text-2xl font-bold text-emerald-400 truncate">
            {quote ? new Decimal(quote.outputAmount).formatToken(4) : '0.00'}
          </span>

          <span className="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 font-bold text-xs text-emerald-300 shrink-0">
            ${receiveSymbol}
          </span>
        </div>
      </div>

      {/* Financial Details & Slippage */}
      <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Price:</span>
          <span className="font-bold text-white">
            1 ${tokenSymbol} ≈ ${currentPriceUsd.toFixed(4)} USD
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Price Impact:</span>
          <span
            className={`font-bold ${
              quote?.priceImpactRating === 'HIGH' || quote?.priceImpactRating === 'EXTREME'
                ? 'text-rose-400'
                : quote?.priceImpactRating === 'MEDIUM'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {quote ? `${quote.priceImpact}%` : '0.00%'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Est. Fees:</span>
          <span className="font-bold text-slate-200">
            ${quote ? quote.fees.totalFeeUsd.toFixed(4) : '0.00'}
          </span>
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-slate-500 text-2xs">Slippage Settings</span>
          <SlippageControl slippage={slippage} onChange={setSlippage} />
        </div>
      </div>

      {/* Main Execution Action Button */}
      <div>
        {!isConnected ? (
          <Button
            onClick={() => masterWalletProvider.connect()}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(56,189,248,0.3)]"
          >
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet to Trade
          </Button>
        ) : isInsufficientBalance ? (
          <Button
            disabled
            className="w-full h-12 rounded-2xl bg-white/5 text-slate-500 border border-white/5 font-bold text-sm cursor-not-allowed"
          >
            <AlertCircle className="h-4 w-4 mr-2 text-rose-400" />
            Insufficient {paySymbol} Balance
          </Button>
        ) : (
          <Button
            onClick={handleOpenPreview}
            disabled={!quote || isQuoting || parsedAmount <= 0}
            className={`w-full h-12 rounded-2xl font-bold text-sm text-white shadow-xl transition-all duration-200 ${
              side === 'BUY'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
            }`}
          >
            {isQuoting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {side === 'BUY' ? `Buy $${tokenSymbol}` : `Sell $${tokenSymbol}`}
          </Button>
        )}
      </div>

      {/* Modals */}
      {previewOpen && quote && (
        <TransactionPreviewModal
          quote={quote}
          onConfirm={handleExecuteTrade}
          onCancel={() => setPreviewOpen(false)}
        />
      )}

      {statusModalOpen && (
        <TransactionStatusModal
          state={txState}
          txHash={txHash}
          errorMessage={errorMessage}
          onClose={() => setStatusModalOpen(false)}
        />
      )}
    </div>
  );
}
