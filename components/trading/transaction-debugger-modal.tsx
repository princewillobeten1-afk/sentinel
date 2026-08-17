'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Sliders,
  Clock,
  Terminal,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TransactionLifecycleState } from '@/lib/transaction/state-machine';

export interface TransactionDebugData {
  id: string;
  txHash?: string;
  symbol: string;
  side: 'buy' | 'sell';
  amountIn: string;
  minAmountOut: string;
  state: TransactionLifecycleState;
  reason?: string;
  network?: string;
  gasFeeSol?: string;
  rpcLatencyMs?: number;
  blockHeight?: number;
  createdAt: string;
  completedAt?: string;
}

interface TransactionDebuggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionDebugData | null;
  onRetry?: () => void;
  onAdjustSlippage?: () => void;
}

const LIFECYCLE_STEPS: TransactionLifecycleState[] = [
  'CREATED',
  'SIMULATING',
  'AUTHORIZED',
  'SIGNED',
  'SUBMITTED',
  'PENDING',
  'CONFIRMED',
];

export function TransactionDebuggerModal({
  isOpen,
  onClose,
  transaction,
  onRetry,
  onAdjustSlippage,
}: TransactionDebuggerModalProps) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const isSuccess = transaction.state === 'CONFIRMED';
  const isFailed =
    transaction.state === 'SIMULATION_FAILED' ||
    transaction.state === 'USER_REJECTED' ||
    transaction.state === 'SIGNATURE_FAILED' ||
    transaction.state === 'BROADCAST_FAILED' ||
    transaction.state === 'CONFIRMATION_FAILED' ||
    transaction.state === 'REVERTED' ||
    transaction.state === 'DROPPED' ||
    transaction.state === 'EXPIRED' ||
    transaction.state === 'RECONCILED_CORRECTION';

  const isPending = transaction.state === 'PENDING' || transaction.state === 'SUBMITTED';

  const handleCopyHash = () => {
    if (transaction.txHash) {
      navigator.clipboard.writeText(transaction.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentStepIndex = LIFECYCLE_STEPS.indexOf(
    isFailed ? 'SIMULATING' : (transaction.state as any)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2 font-bold text-slate-100">
          <Terminal className="h-5 w-5 text-sky-400" /> Transaction Diagnostics & Debugger
        </span>
      }
      subtitle={`Order ID: ${transaction.id}`}
      size="lg"
    >
      <div className="space-y-5 text-xs font-mono text-slate-300">
        {/* Status Header */}
        <div
          className={`flex items-center justify-between p-4 rounded-xl border ${
            isSuccess
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : isFailed
              ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
              : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {isSuccess && <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />}
            {isFailed && <ShieldAlert className="h-6 w-6 text-rose-400 shrink-0" />}
            {isPending && <Clock className="h-6 w-6 text-amber-400 animate-spin shrink-0" />}
            <div>
              <p className="font-bold text-sm text-slate-100 uppercase">
                {transaction.side} {transaction.symbol} — {transaction.state}
              </p>
              <p className="text-2xs text-slate-400 mt-0.5">
                {transaction.reason || (isSuccess ? 'Transaction executed successfully on Solana.' : 'Processing in progress.')}
              </p>
            </div>
          </div>
          <Badge variant={isSuccess ? 'success' : isFailed ? 'danger' : 'warning'} size="md">
            {transaction.state}
          </Badge>
        </div>

        {/* Lifecycle Flow Stepper */}
        <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-4 space-y-3">
          <h4 className="text-2xs font-bold uppercase text-slate-400">Deterministic Lifecycle State</h4>
          <div className="grid grid-cols-7 gap-1 text-center text-2xs">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const passed = isSuccess || (!isFailed && idx <= currentStepIndex);
              const active = transaction.state === step;
              const failedHere = isFailed && idx === Math.max(1, currentStepIndex);

              return (
                <div
                  key={step}
                  className={`p-2 rounded border flex flex-col items-center justify-center gap-1 ${
                    passed
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : failedHere
                      ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                      : active
                      ? 'bg-sky-950/40 border-sky-500 text-sky-200'
                      : 'bg-sentinel-900/50 border-sentinel-800/80 text-slate-500'
                  }`}
                >
                  <span className="font-bold">{idx + 1}</span>
                  <span className="truncate w-full text-2xs">{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostic Telemetry Grid */}
        <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-4 space-y-3">
          <h4 className="text-2xs font-bold uppercase text-slate-400">Execution Telemetry</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-2xs">Network:</span>
              <span className="font-bold text-slate-200">{transaction.network || 'Solana Mainnet-Beta'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-2xs">Estimated Fee:</span>
              <span className="font-bold text-slate-200">{transaction.gasFeeSol || '0.000005 SOL'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-2xs">RPC Latency:</span>
              <span className="font-bold text-emerald-400">{transaction.rpcLatencyMs || 14} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block text-2xs">Block Height:</span>
              <span className="font-bold text-slate-200">{transaction.blockHeight || '289,104,912'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-2xs">Created At:</span>
              <span className="text-slate-300 text-2xs">{new Date(transaction.createdAt).toLocaleTimeString()}</span>
            </div>
            {transaction.completedAt && (
              <div>
                <span className="text-slate-500 block text-2xs">Completed At:</span>
                <span className="text-slate-300 text-2xs">{new Date(transaction.completedAt).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {transaction.txHash && (
            <div className="pt-2 border-t border-sentinel-800/80 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="text-slate-500 block text-2xs">On-Chain Signature:</span>
                <span className="font-mono text-slate-200 truncate">{transaction.txHash}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCopyHash}
                  className="p-1.5 rounded bg-sentinel-900 border border-sentinel-800 text-slate-400 hover:text-slate-200"
                  title="Copy Signature"
                >
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <a
                  href={`https://solscan.io/tx/${transaction.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded bg-sentinel-900 border border-sentinel-800 text-sky-400 hover:text-sky-300"
                  title="View on Solscan"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Actionable Recovery Guidance */}
        {isFailed && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {onAdjustSlippage && (
              <Button
                onClick={() => {
                  onAdjustSlippage();
                  onClose();
                }}
                variant="secondary"
                size="sm"
                leftIcon={<Sliders className="h-3.5 w-3.5" />}
              >
                Increase Slippage
              </Button>
            )}
            {onRetry && (
              <Button
                onClick={() => {
                  onRetry();
                  onClose();
                }}
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Retry Execution
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
