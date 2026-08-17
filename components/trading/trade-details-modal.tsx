'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, CheckCircle2, XCircle, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import type { TradeRecord } from '@/lib/store/trade-history-store';

interface TradeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: TradeRecord | null;
}

export function TradeDetailsModal({ isOpen, onClose, trade }: TradeDetailsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!trade) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(trade.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2 font-bold text-slate-100">
          <ShieldCheck className="h-5 w-5 text-sky-400" /> Transaction Execution Details
        </span>
      }
      subtitle={`Order Signature: ${trade.txHash.slice(0, 8)}...${trade.txHash.slice(-8)}`}
      size="md"
    >
      <div className="space-y-4 text-xs font-mono text-slate-300">
        {/* Status Header */}
        <div className="flex items-center justify-between rounded-xl border border-sentinel-800 bg-sentinel-950 p-4">
          <div className="flex items-center gap-2">
            {trade.status === 'confirmed' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            {trade.status === 'pending' && <Clock className="h-5 w-5 text-amber-400 animate-spin" />}
            {trade.status !== 'confirmed' && trade.status !== 'pending' && (
              <ShieldAlert className="h-5 w-5 text-rose-400" />
            )}
            <div>
              <p className="text-sm font-bold text-slate-100 uppercase">{trade.side} ORDER {trade.status.toUpperCase()}</p>
              <p className="text-2xs text-slate-400">{new Date(trade.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <Badge
          variant={
            trade.status === 'confirmed'
              ? 'success'
              : trade.status === 'pending'
              ? 'warning'
              : 'danger'
          }
          size="md"
        >
          {trade.status.toUpperCase()}
        </Badge>
        </div>

        {/* Transaction Parameters */}
        <div className="rounded-xl border border-sentinel-800 bg-sentinel-900/80 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Token:</span>
            <span className="text-slate-100 font-bold">{trade.tokenName} (${trade.tokenSymbol})</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Input Amount:</span>
            <span className="text-slate-200 font-bold">{trade.inputAmount}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Output Amount:</span>
            <span className="text-emerald-400 font-bold">{trade.outputAmount}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Execution Price:</span>
            <span className="text-slate-200 font-bold">{trade.priceUsd}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Execution Route:</span>
            <span className="text-sky-300 font-bold">{trade.route}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Network Fee:</span>
            <span className="text-slate-200 font-bold">{trade.networkFeeSol}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Provider:</span>
            <span className="text-slate-200 font-bold">{trade.provider}</span>
          </div>
        </div>

        {/* Transaction Signature Link */}
        <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 flex items-center justify-between text-2xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            Signature: <span className="text-slate-200">{trade.txHash.slice(0, 12)}...{trade.txHash.slice(-12)}</span>
            <button onClick={handleCopyHash} className="hover:text-white">
              <Copy className="h-3.5 w-3.5" />
            </button>
            {copied && <span className="text-emerald-400 text-2xs">Copied!</span>}
          </span>
          <a
            href={trade.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:underline flex items-center gap-1 font-bold"
          >
            Solscan <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </Modal>
  );
}
