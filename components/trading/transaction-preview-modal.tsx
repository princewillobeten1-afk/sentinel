'use client';

import React, { useState } from 'react';
import { X, ArrowDown, Route, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Quote } from '@/lib/quote/types';
import { Decimal } from '@/lib/math/decimal';

export interface TransactionPreviewModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  quote?: Quote | null;
  side?: 'BUY' | 'SELL' | 'buy' | 'sell';
  onConfirmExecute?: () => void;
  executionState?: string;
  executionError?: string | null;
  isExecuting?: boolean;
  simulationErrors?: string[];
  simulationWarnings?: string[];
  isSimulationLoading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  mainnetSwap?: boolean;
  feeLamports?: number | null;
  txSignature?: string | null;
  pending?: boolean;
  onCheckStatus?: () => void;
}

export function TransactionPreviewModal({
  isOpen = true,
  onClose,
  quote,
  onConfirmExecute,
  isExecuting = false,
  executionState = 'idle',
  executionError = null,
  onConfirm,
  onCancel,
  isLoading = false,
  mainnetSwap = false,
  feeLamports,
  txSignature,
  pending = false,
  onCheckStatus,
}: TransactionPreviewModalProps) {
  const [acknowledgedMainnet, setAcknowledgedMainnet] = useState(false);
  const [acknowledgedImpact, setAcknowledgedImpact] = useState(
    quote ? (quote.priceImpactRating !== 'HIGH' && quote.priceImpactRating !== 'EXTREME') : true
  );

  if (isOpen === false || !quote) return null;

  const handleConfirm = onConfirm || onConfirmExecute || (() => {});
  const handleCancel = onCancel || onClose || (() => {});
  const actualLoading = isLoading || isExecuting;
  const isHighImpact = quote.priceImpactRating === 'HIGH' || quote.priceImpactRating === 'EXTREME';
  const stateLabel: Record<string, string> = {
    preparing: 'Preparing simulation…',
    awaitingWallet: 'Waiting for wallet approval…',
    signing: 'Signing transaction…',
    submitting: 'Submitting transaction…',
    confirming: 'Waiting for network confirmation…',
    confirmed: 'Transaction confirmed',
    rejected: 'Wallet rejected the request',
    failed: 'Execution failed',
    expired: 'Quote expired',
    unknown: 'Submission status needs checking',
  };
  const executionLabel = executionState ? stateLabel[executionState] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-sentinel-950 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">Confirm Swap</h3>
          </div>
          <button
            onClick={handleCancel}
            disabled={actualLoading}
            aria-label="Close transaction review"
            className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* You Pay / You Receive Cards */}
        <div className="space-y-2">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 uppercase font-bold">You Pay</span>
            <p className="text-xl font-bold text-white">
              {new Decimal(quote.inputAmount).formatToken(4)} <span className="text-sky-400">${quote.inputToken.slice(0, 4).toUpperCase()}</span>
            </p>
          </div>

          <div className="flex justify-center -my-2 relative z-10">
            <div className="h-7 w-7 rounded-full bg-sentinel-900 border border-white/10 flex items-center justify-center text-slate-400">
              <ArrowDown className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 uppercase font-bold">You Receive (Estimated)</span>
            <p className="text-xl font-bold text-emerald-400">
              {new Decimal(quote.outputAmount).formatToken(4)} <span className="text-white">${quote.outputToken.slice(0, 4).toUpperCase()}</span>
            </p>
          </div>
        </div>

        {/* Route Visualization */}
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5 text-sky-400" />
              <span>Smart Order Route</span>
            </span>
            <span className="text-2xs text-slate-500">{quote.provider}</span>
          </div>

          <div className="flex items-center gap-2 text-2xs text-slate-300">
            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
              {quote.inputToken.slice(0, 4).toUpperCase()}
            </span>
            <span className="text-slate-500">→</span>
            <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400">
              {quote.route[0]?.dex || 'Provider route unavailable'}
            </span>
            <span className="text-slate-500">→</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
              {quote.outputToken.slice(0, 4).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Financial Details Table */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Minimum Received:</span>
            <span className="font-bold text-white">
              {new Decimal(quote.minimumReceived).formatToken(4)} {quote.outputToken.slice(0, 4).toUpperCase()}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Price Impact:</span>
            <span
              className={`font-bold ${
                isHighImpact
                  ? 'text-rose-400'
                  : quote.priceImpactRating === 'MEDIUM'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {quote.priceImpactMeasured === false ? 'Unavailable' : `${quote.priceImpact}% (${quote.priceImpactRating})`}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Estimated network fee:</span>
            <span className="font-bold text-slate-200">
              {mainnetSwap ? feeLamports == null ? 'Available after preflight' : `${feeLamports / 1e9} SOL` : `$${quote.fees.totalFeeUsd.toFixed(4)}`}
            </span>
          </div>
        </div>

        {mainnetSwap && <label className="flex min-h-11 items-center gap-2 rounded-md border border-amber-800 bg-amber-950/20 p-3 text-xs text-amber-200">
          <input type="checkbox" checked={acknowledgedMainnet} disabled={actualLoading || pending} onChange={event => setAcknowledgedMainnet(event.target.checked)} />
          I understand this is a Solana mainnet swap using real funds. Priority fee is capped at 0.00005 SOL; account rent may apply. No private MEV relay is configured.
        </label>}
        {txSignature && <a className="block break-all text-xs text-sky-300 underline" href={`https://solscan.io/tx/${txSignature}`} target="_blank" rel="noreferrer">View transaction on Solscan</a>}
        {/* High Price Impact Acknowledgment Checkbox */}
        {isHighImpact && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
            <div className="flex items-start gap-2 text-rose-300 text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{quote.priceImpactMeasured === false ? 'Price impact is unavailable. The provider must measure it before this swap can proceed.' : `High price impact (${quote.priceImpact}%)! Large orders deplete liquidity and result in significant loss.`}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1 text-2xs text-white">
              <input
                type="checkbox"
                checked={acknowledgedImpact}
                onChange={(e) => setAcknowledgedImpact(e.target.checked)}
                className="rounded bg-sentinel-900 border-white/20 text-rose-500 focus:ring-0"
              />
              <span>I understand and accept the execution slippage</span>
            </label>
          </div>
        )}

        {executionLabel && executionState !== 'idle' && (
          <div role={executionState === 'failed' || executionState === 'rejected' || executionState === 'expired' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-xs ${executionState === 'confirmed' ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : executionState === 'failed' || executionState === 'rejected' || executionState === 'expired' ? 'border-rose-800 bg-rose-950/30 text-rose-300' : 'border-sky-800 bg-sky-950/30 text-sky-300'}`}>
            <p className="font-semibold">{executionLabel}</p>
            {executionError && <p className="mt-1 text-2xs text-slate-300">{executionError}</p>}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={actualLoading}
            className="flex-1 border-white/10 text-slate-300 hover:bg-white/5 rounded-xl h-11"
          >
            Cancel
          </Button>

          <Button
            onClick={pending ? onCheckStatus : handleConfirm}
            disabled={actualLoading || executionState === 'confirmed' || (!pending && (!acknowledgedImpact || (mainnetSwap && (!acknowledgedMainnet || quote.priceImpactMeasured === false))))}
            className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold rounded-xl h-11 shadow-[0_0_20px_rgba(56,189,248,0.3)] disabled:opacity-50"
          >
            {actualLoading ? (executionLabel || 'Working…') : pending ? 'Check status' : executionState === 'confirmed' ? 'Confirmed' : executionState === 'failed' || executionState === 'rejected' || executionState === 'expired' ? 'Retry' : 'Confirm & Sign'}
          </Button>
        </div>
      </div>
    </div>
  );
}
