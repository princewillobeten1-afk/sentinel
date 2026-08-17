'use client';

import React from 'react';
import { CheckCircle2, Loader2, XCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionLifecycleState } from '@/lib/transaction/state-machine';

interface TransactionStatusModalProps {
  state: TransactionLifecycleState;
  txHash?: string;
  errorMessage?: string;
  onClose: () => void;
  onRetry?: () => void;
}

export function TransactionStatusModal({
  state,
  txHash,
  errorMessage,
  onClose,
  onRetry,
}: TransactionStatusModalProps) {
  const isPending =
    state === 'CREATED' ||
    state === 'SIMULATING' ||
    state === 'AUTHORIZED' ||
    state === 'SIGNED' ||
    state === 'SUBMITTED' ||
    state === 'PENDING';

  const isSuccess = state === 'CONFIRMED';
  const isFailed =
    state === 'SIMULATION_FAILED' ||
    state === 'USER_REJECTED' ||
    state === 'SIGNATURE_FAILED' ||
    state === 'BROADCAST_FAILED' ||
    state === 'CONFIRMATION_FAILED' ||
    state === 'REVERTED' ||
    state === 'EXPIRED';

  const steps = [
    { label: 'Quote Verified', done: true },
    {
      label: 'Pre-flight Simulation',
      done: state !== 'SIMULATING' && state !== 'SIMULATION_FAILED',
      active: state === 'SIMULATING',
    },
    {
      label: 'Wallet Signature',
      done: state === 'SUBMITTED' || state === 'PENDING' || state === 'CONFIRMED',
      active: state === 'AUTHORIZED' || state === 'SIGNED',
    },
    {
      label: 'Mempool Broadcast',
      done: state === 'PENDING' || state === 'CONFIRMED',
      active: state === 'SUBMITTED',
    },
    {
      label: 'Blockchain Finalization',
      done: state === 'CONFIRMED',
      active: state === 'PENDING',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-sentinel-950 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 font-mono text-center">
        {/* Status Icon */}
        <div className="flex justify-center">
          {isSuccess ? (
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          ) : isFailed ? (
            <div className="h-16 w-16 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
              <XCircle className="h-8 w-8" />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-[0_0_30px_rgba(56,189,248,0.3)] animate-pulse">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>

        {/* Status Title & Message */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">
            {isSuccess
              ? 'Transaction Confirmed!'
              : isFailed
              ? state === 'USER_REJECTED'
                ? 'Signature Cancelled'
                : 'Transaction Failed'
              : (state === 'AUTHORIZED' || state === 'SIGNED')
              ? 'Awaiting Wallet Signature...'
              : 'Executing Order...'}
          </h3>
          <p className="text-xs text-slate-400">
            {isSuccess
              ? 'Your swap has been finalized on-chain and balances are updated.'
              : isFailed
              ? errorMessage || 'The transaction could not be completed on-chain.'
              : 'Please keep this window open while the blockchain finalizes.'}
          </p>
        </div>

        {/* Step Progress Checklist */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-left text-xs space-y-2.5">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span
                className={`${
                  step.done
                    ? 'text-emerald-300 font-semibold'
                    : step.active
                    ? 'text-sky-300 font-bold animate-pulse'
                    : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
              {step.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : step.active ? (
                <Loader2 className="h-3.5 w-3.5 text-sky-400 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-slate-700" />
              )}
            </div>
          ))}
        </div>

        {/* Explorer Link if Hash exists */}
        {txHash && (
          <div className="pt-1">
            <a
              href={`https://solscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition"
            >
              <span>View on Blockchain Explorer</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {isSuccess || isFailed ? (
            <Button
              onClick={onClose}
              className="w-full bg-sentinel-800 hover:bg-sentinel-700 text-white rounded-xl h-11 border border-white/10"
            >
              Close
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full border-white/10 text-slate-400 hover:text-white rounded-xl h-10 text-xs"
            >
              Dismiss (Execution in background)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
