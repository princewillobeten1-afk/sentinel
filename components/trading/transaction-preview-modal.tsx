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
  executionState?: any;
  executionError?: string | null;
  isExecuting?: boolean;
  simulationErrors?: string[];
  simulationWarnings?: string[];
  isSimulationLoading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function TransactionPreviewModal({
  isOpen = true,
  onClose,
  quote,
  onConfirmExecute,
  isExecuting = false,
  onConfirm,
  onCancel,
  isLoading = false,
}: TransactionPreviewModalProps) {
  const [acknowledgedImpact, setAcknowledgedImpact] = useState(
    quote ? (quote.priceImpactRating !== 'HIGH' && quote.priceImpactRating !== 'EXTREME') : true
  );

  if (isOpen === false || !quote) return null;

  const handleConfirm = onConfirm || onConfirmExecute || (() => {});
  const handleCancel = onCancel || onClose || (() => {});
  const actualLoading = isLoading || isExecuting;
  const isHighImpact = quote.priceImpactRating === 'HIGH' || quote.priceImpactRating === 'EXTREME';

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
              {quote.route[0]?.dex || 'Raydium'}
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
              {quote.priceImpact}% ({quote.priceImpactRating})
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Network & DEX Fees:</span>
            <span className="font-bold text-slate-200">
              ${quote.fees.totalFeeUsd.toFixed(4)}
            </span>
          </div>
        </div>

        {/* High Price Impact Acknowledgment Checkbox */}
        {isHighImpact && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
            <div className="flex items-start gap-2 text-rose-300 text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>High price impact ({quote.priceImpact}%)! Large orders deplete liquidity and result in significant loss.</span>
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

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1 border-white/10 text-slate-300 hover:bg-white/5 rounded-xl h-11"
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirm}
            disabled={!acknowledgedImpact || actualLoading}
            className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold rounded-xl h-11 shadow-[0_0_20px_rgba(56,189,248,0.3)] disabled:opacity-50"
          >
            {actualLoading ? 'Simulating...' : 'Confirm & Sign'}
          </Button>
        </div>
      </div>
    </div>
  );
}
